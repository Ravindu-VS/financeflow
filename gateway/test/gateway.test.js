// Gateway integration test: gateway → FastAPI backend → PostgreSQL.
// Requires the backend running at AI_BACKEND_URL (see docs/UPGRADE_REPORT.md §18).
process.env.NODE_ENV = 'test'
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const crypto = require('node:crypto')
const jwt = require('jsonwebtoken')
const app = require('../src/index.js')

// Keys may be shared with the backend under test via env (FIREBASE_TEST_PRIVATE_KEY / FIREBASE_TEST_PUBLIC_KEY)
const pair = process.env.FIREBASE_TEST_PRIVATE_KEY
  ? { privateKey: crypto.createPrivateKey(process.env.FIREBASE_TEST_PRIVATE_KEY), publicKey: crypto.createPublicKey(process.env.FIREBASE_TEST_PUBLIC_KEY) }
  : crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const { privateKey, publicKey } = pair
const PROJECT = 'financeflow-a6aa0'
const token = (sub = 'gw-user', aud = PROJECT) => jwt.sign(
  { sub, email: `${sub}@example.lk`, email_verified: true, name: 'GW Test' },
  privateKey, { algorithm: 'RS256', keyid: 'k1', audience: aud, issuer: `https://securetoken.google.com/${aud}`, expiresIn: 600 })

let server, base
before(async () => {
  app.__setFirebaseCerts({ k1: publicKey.export({ type: 'spki', format: 'pem' }) })
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

test('health and end-to-end status', async () => {
  const h = await (await fetch(`${base}/health`)).json()
  assert.equal(h.status, 'online')
  const s = await (await fetch(`${base}/gateway/health`)).json()
  assert.equal(s.ai_backend.status, 'online')
  assert.equal(s.database.status, 'online')
})

test('rejects unauthenticated and foreign-project tokens', async () => {
  assert.equal((await fetch(`${base}/api/v1/sync/status`)).status, 401)
  const r = await fetch(`${base}/api/v1/sync/status`, { headers: { Authorization: `Bearer ${token('x', 'other-project')}` } })
  assert.equal(r.status, 401)
})

test('proxies authenticated POST bodies with the full path', async () => {
  const body = { since: '2026-11-01', until: '2026-11-30', transactions: [{ id: 'gw1', type: 'expense', amount: 450, date: '2026-11-07', category: 'food_dining', status: 'cleared', source: 'manual' }] }
  const r = await fetch(`${base}/api/v1/sync/firestore`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) })
  assert.equal(r.status, 200, await r.clone().text())
  assert.equal((await r.json()).synced.transactions, 1)
  assert.equal(r.headers.get('x-proxied-by'), 'FinAI-WSO2-Gateway')
  assert.ok(r.headers.get('ratelimit-limit') || r.headers.get('ratelimit'))
  const st = await (await fetch(`${base}/api/v1/sync/status`, { headers: { Authorization: `Bearer ${token()}` } })).json()
  assert.equal(st.transactions, 1)
})

test('CORS allows the GitHub Pages origin only', async () => {
  const ok = await fetch(`${base}/health`, { headers: { Origin: 'https://ravindu-vs.github.io' } })
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://ravindu-vs.github.io')
  const bad = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example' } })
  assert.equal(bad.headers.get('access-control-allow-origin'), null)
})
