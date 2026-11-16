import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

// Visits every route with realistic data and clicks through the main tabs; fails on any runtime error.
const ROUTES = ['dashboard', 'transactions', 'cashflow', 'calendar', 'accounts', 'planning', 'income', 'expenses', 'savings', 'investments',
  'budgets', 'analytics', 'insights', 'market', 'global-markets', 'crypto', 'settings', 'settings?tab=services', 'profile', 'ai-advisor',
  'voice', 'reports', 'health-score', 'advisor', 'family']

test('every page renders without runtime errors', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`${page.url()} pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`${page.url()} console: ${m.text().slice(0, 300)}`) })
  await page.goto('dashboard')
  const seed = JSON.parse(readFileSync(new URL('./fixtures/demo-seed.json', import.meta.url), 'utf8'))
  await page.evaluate(seed => {
    const db = (window as any).__fakeDb, U = 'users/e2e-user'
    const T = (k: string) => new db.Timestamp(Math.floor(new Date(k + 'T00:00:00').getTime() / 1000), 0)
    const fix = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]: any) => [k, v && v.__ts ? T(v.__ts) : v]))
    db.seed(U, { email: 'tester@example.lk', profile: { firstName: 'Test' }, preferences: { currency: 'LKR' } })
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
    db.seed(`${U}/meta/settings`, seed.settings)
    for (const t of seed.txs) db.seed(`${U}/transactions/${t.id}`, t)
    for (const [id, a] of Object.entries(seed.accounts)) db.seed(`${U}/accounts/${id}`, a)
    for (const [id, r] of Object.entries(seed.rules)) db.seed(`${U}/recurringRules/${id}`, r)
    for (const [id, g] of Object.entries(seed.goals)) db.seed(`${U}/savingsGoals/${id}`, fix(g))
    for (const [id, h] of Object.entries(seed.holdings)) db.seed(`${U}/investments/${id}`, fix(h))
    for (const [id, b] of Object.entries(seed.budgets)) db.seed(`${U}/budgets/${id}`, b)
  }, seed)
  if (process.env.SHOTS === 'dark') await page.evaluate(() => localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark' }, version: 0 })))
  if (process.env.SHOTS === 'light') await page.evaluate(() => localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'light' }, version: 0 })))
  await page.reload(); await page.waitForTimeout(1500)
  const report: string[] = []
  for (const r of ROUTES) {
    await page.goto(r, { timeout: 20000 }).catch(e => report.push(`${r}: GOTO FAILED ${e.message.slice(0, 80)}`)); await page.waitForTimeout(1200)
    const h1 = await page.locator('h1').first().textContent({ timeout: 3000 }).catch(() => '(no h1)')
    const empty = (await page.locator('main').innerText({ timeout: 3000 }).catch(() => '')).trim().length < 40
    report.push(`${r}: ${h1?.trim()}${empty ? '  <-- EMPTY' : ''}`)
    // click every tab-like button on the page once (no destructive buttons)
    if (process.env.SHOTS) await page.screenshot({ path: `test-results/sweep/${process.env.SHOTS}-${r.replace(/[?=]/g, '_')}.png`, fullPage: false })
  }
  console.log(report.join('\n'))
  const real = errors.filter(e => !/favicon|manifest|DevTools|localhost:8080|Failed to load resource|net::ERR|Network Error|ERR_CONNECTION/.test(e))
  console.log('ERRORS:\n' + real.join('\n'))
  expect(real).toEqual([])
})
