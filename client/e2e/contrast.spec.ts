import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'

// Measures WCAG contrast of every visible text node against its effective background, per page and theme.
const ROUTES = ['dashboard', 'transactions', 'cashflow', 'calendar', 'accounts', 'loans', 'planning', 'income', 'expenses', 'savings', 'investments',
  'budgets', 'analytics', 'insights', 'market', 'global-markets', 'crypto', 'settings', 'settings?tab=services', 'profile', 'ai-advisor',
  'voice', 'reports', 'health-score', 'advisor', 'family']

const AUDIT = () => {
  const parse = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lum = (c: any) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const blend = (top: any, bot: any) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 })
  const bgOf = (el: Element | null): any => {
    const layers: any[] = []
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { gradient: true }
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break }
    }
    let out = { r: 255, g: 255, b: 255, a: 1 }
    if (document.documentElement.classList.contains('dark')) out = { r: 17, g: 24, b: 39, a: 1 }
    for (let i = layers.length - 1; i >= 0; i--) out = blend(layers[i], out)
    return out
  }
  const bad: any[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set<Element>()
  while (walker.nextNode()) {
    const n = walker.currentNode as Text
    const txt = n.textContent?.trim(); if (!txt || txt.length < 2) continue
    const el = n.parentElement!; if (seen.has(el)) continue; seen.add(el)
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight * 3) continue
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
    if (el.closest('svg, [aria-hidden=true], .recharts-wrapper, #ff-cap, #ff-card')) continue
    const fg = parse(cs.color); if (!fg) continue
    const bg = bgOf(el); if (bg.gradient) continue
    const f = blend(fg, bg)
    const L1 = lum(f), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const large = parseFloat(cs.fontSize) >= 18.66 || (parseFloat(cs.fontSize) >= 14 && Number(cs.fontWeight) >= 700)
    if (ratio < (large ? 2.6 : 3.0)) bad.push({ ratio: Math.round(ratio * 100) / 100, text: txt.slice(0, 60), cls: (el.getAttribute('class') || '').slice(0, 120), tag: el.tagName })
  }
  return bad
}

test('contrast audit', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('dashboard')
  const seed = JSON.parse(readFileSync(new URL('./fixtures/demo-seed.json', import.meta.url), 'utf8'))
  await page.evaluate(seed => {
    const db = (window as any).__fakeDb, U = 'users/e2e-user'
    const T = (k: string) => new db.Timestamp(Math.floor(new Date(k + 'T00:00:00').getTime() / 1000), 0)
    const fix = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]: any) => [k, v && v.__ts ? T(v.__ts) : v]))
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
    db.seed(`${U}/meta/settings`, seed.settings)
    for (const t of seed.txs) db.seed(`${U}/transactions/${t.id}`, t)
    for (const [id, a] of Object.entries(seed.accounts)) db.seed(`${U}/accounts/${id}`, a)
    for (const [id, r] of Object.entries(seed.rules)) db.seed(`${U}/recurringRules/${id}`, r)
    for (const [id, g] of Object.entries(seed.goals)) db.seed(`${U}/savingsGoals/${id}`, fix(g))
    for (const [id, h] of Object.entries(seed.holdings)) db.seed(`${U}/investments/${id}`, fix(h))
    for (const [id, b] of Object.entries(seed.budgets)) db.seed(`${U}/budgets/${id}`, b)
    db.seed(`${U}/loans/L1`, { direction: 'borrowed', counterparty: 'Commercial Bank', principal: 300000, currency: 'LKR', startDate: '2026-06-01', dueDate: '2027-06-01', status: 'active' })
  }, seed)
  const out: Record<string, any[]> = {}
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: t }, version: 0 })), theme)
    for (const r of ROUTES) {
      await page.goto(r); await page.waitForTimeout(900)
      const bad = await page.evaluate(AUDIT)
      if (bad.length) out[`${theme} ${r}`] = bad
    }
  }
  writeFileSync(new URL('../test-results/contrast.json', import.meta.url), JSON.stringify(out, null, 1))
  console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join('\n'))
  expect(out, 'text with low contrast').toEqual({})
})
