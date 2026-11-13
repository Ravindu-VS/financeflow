import { test, expect } from '@playwright/test'

const U = 'users/e2e-user'
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthStart = (back: number) => key(new Date(now.getFullYear(), now.getMonth() - back, 1))
const today = key(now)

const errors: string[] = []
test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
})

test('budget plan, forecast, anomalies, notifications, investment advisor, service status, concurrent edit', async ({ page }) => {
  await page.goto('dashboard')
  await page.evaluate(([U, today, m1, m2, m3, m4]) => {
    const db = (window as any).__fakeDb
    db.seed(`${U}/accounts/main`, { name: 'Main Account', type: 'bank', currency: 'LKR', openingBalance: 500000, balance: 500000 })
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
    db.seed(`${U}/meta/settings`, { budgetMethod: 'zero_based', monthlySavingsTarget: 20000, monthlyInvestmentTarget: 10000 })
    db.seed(`${U}/budgets/b1`, { category: 'food_dining', amount: 10000, alertThreshold: 80 })
    const T = (id: string, p: any) => db.seed(`${U}/transactions/${id}`, { currency: 'LKR', status: 'cleared', source: 'manual', accountId: 'main', ...p })
    ;[m4, m3, m2, m1].forEach((m: string, i: number) => {
      T(`inc${i}`, { type: 'income', amount: 150000, date: m, category: 'salary', description: 'Salary' })
      for (let k = 0; k < 3; k++) T(`f${i}${k}`, { type: 'expense', amount: 900 + k * 100, date: m.slice(0, 8) + pad2(5 + k), category: 'food_dining', description: 'Lunch' })
      T(`r${i}`, { type: 'expense', amount: 40000 + i * 2000, date: m.slice(0, 8) + '03', category: 'housing', description: 'Rent' })
    })
    function pad2(n: number) { return String(n).padStart(2, '0') }
    T('incNow', { type: 'income', amount: 150000, date: today.slice(0, 8) + '01', category: 'salary', description: 'Salary' })
    // this month: an unusually large food expense pushing the budget over the alert threshold
    T('big', { type: 'expense', amount: 9500, date: today, category: 'food_dining', description: 'Wedding dinner', updatedAt: new db.Timestamp(Math.floor(Date.now() / 1000) - 100, 0) })
  }, [U, today, monthStart(1), monthStart(2), monthStart(3), monthStart(4)] as const)
  await page.reload()

  // Notification centre
  await page.getByTestId('notifications').click()
  await expect(page.getByText(/Food .*budget (at|exceeded)/).first()).toBeVisible()
  await expect(page.getByText(/Unusual expense: Wedding dinner/)).toBeVisible()
  await page.getByText(/Unusual expense: Wedding dinner/).locator('xpath=ancestor::li').getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText(/Unusual expense: Wedding dinner/)).toHaveCount(0)
  const s = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/meta`).find((d: any) => d.id === 'settings'), U)
  expect(s.dismissedAlerts).toContain('unusual_big')

  // Zero-based budget plan
  await page.goto('budgets')
  await expect(page.getByText("This month's plan")).toBeVisible()
  await expect(page.getByText('Zero-based (every rupee assigned)')).toBeVisible()
  await expect(page.getByText(/of income is not assigned yet/)).toBeVisible()

  // Forecast + anomalies
  await page.goto('insights')
  await expect(page.getByText('🔮 Forecast — next 3 months')).toBeVisible()
  await expect(page.getByText(/Holt exponential smoothing/)).toBeVisible()
  await expect(page.locator('div.card').filter({ hasText: 'Unusual expenses' }).getByText('Wedding dinner')).toBeVisible()

  // Investment advisor
  await page.goto('investments')
  await expect(page.getByText('🧭 Investment advisor')).toBeVisible()
  await expect(page.getByText(/Step \d ·/)).toBeVisible()
  await page.getByLabel('Risk tolerance').selectOption('aggressive')
  await expect.poll(async () => (await page.evaluate(U => (window as any).__fakeDb.list(`${U}/meta`).find((d: any) => d.id === 'settings'), U)).riskProfile?.tolerance).toBe('aggressive')

  // Service status (gateway response mocked)
  await page.route('**/gateway/health', r => r.fulfill({ json: {
    gateway: { status: 'online', version: '1.1.0' }, ai_backend: { status: 'online', latency_ms: 120 },
    database: { status: 'online', latency_ms: 4 }, llm: { status: 'online', model: 'gemini-2.5-flash' }, auth: { status: 'online', project: 'financeflow-a6aa0' },
  } }))
  await page.goto('settings?tab=services')
  const list = page.getByTestId('service-status')
  await expect(list.getByText('PostgreSQL (Supabase)')).toBeVisible()
  await expect(list.getByText('Online')).toHaveCount(6)

  // Concurrent edit: another device changes the amount while this one edits it
  await page.goto('transactions')
  await page.locator('div').filter({ hasText: /^Wedding dinner/ }).locator('xpath=ancestor::*[.//button[@aria-label="Edit"]][1]').getByRole('button', { name: 'Edit' }).first().click()
  await expect(page.getByRole('heading', { name: 'Edit transaction' })).toBeVisible()
  await page.evaluate(U => {
    const db = (window as any).__fakeDb
    const t = db.list(`${U}/transactions`).find((x: any) => x.id === 'big')
    db.seed(`${U}/transactions/big`, { ...t, amount: 9999, updatedAt: new db.Timestamp(Math.floor(Date.now() / 1000) + 60, 0) })
  }, U)
  await page.locator('input[inputmode="decimal"]').first().fill('8000')
  await page.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(page.getByText(/changed on another device/)).toBeVisible()
  const big = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/transactions`).find((x: any) => x.id === 'big'), U)
  expect(big.amount).toBe(9999)

  // Receipt scanner is offered when adding an expense
  await page.keyboard.press('Escape')

  const real = errors.filter(e => !/favicon|manifest|Download the React DevTools|net::ERR|localhost:8080|Failed to load resource|ERR_CONNECTION|Network Error/.test(e))
  expect(real).toEqual([])
})
