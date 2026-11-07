import { test, expect, Page } from '@playwright/test'

const U = 'users/e2e-user'
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const today = `${ym(now)}-${pad(now.getDate())}`
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const P = ym(prev) // previous month YYYY-MM

async function seedLegacy(page: Page) {
  await page.evaluate(([U, P, ts]) => {
    const T = (k: string) => new (window as any).__fakeDb.Timestamp(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 1000, 0)
    const db = (window as any).__fakeDb
    db.seed(`${U}`, { email: 'tester@example.lk', profile: { firstName: 'Test' }, preferences: { currency: 'LKR' } })
    db.seed(`${U}/incomes/i1`, { amount: 100000, category: 'salary', source: 'Company', date: T(`${P}-01`), isRecurring: true, recurringFrequency: 'monthly' })
    db.seed(`${U}/incomes/i2`, { amount: 15000, category: 'freelance', source: 'Upwork', date: T(`${P}-12`), isRecurring: false, recurringFrequency: 'monthly' })
    db.seed(`${U}/expenses/e1`, { amount: 850, category: 'Food & Dining', description: 'Lunch', date: T(`${P}-03`), isRecurring: false })
    db.seed(`${U}/expenses/e2`, { amount: 25000, category: 'Housing', description: 'Rent', date: T(`${P}-05`), isRecurring: true, recurringFrequency: 'monthly' })
    db.seed(`${U}/savingsGoals/g1`, { name: 'Emergency', targetAmount: 100000, currentAmount: 5000, contributions: [{ amount: 5000, date: T(`${P}-20`) }] })
    db.seed(`${U}/investments/v1`, { name: 'FD', type: 'fixed_deposit', amount: 20000, currentValue: 20500, purchaseDate: T(`${P}-25`) })
    db.seed(`${U}/budgets/b1`, { category: 'Food & Dining', limit: 15000, period: 'monthly' })
  }, [U, P, ''] as const)
}

const errors: string[] = []
test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
})

test('migrate legacy data, add one-time entries, transfer, period navigation, voice', async ({ page }) => {
  await page.goto('dashboard')
  await seedLegacy(page)
  await page.reload() // fake Firestore persists to sessionStorage

  // Dashboard defaults to the current month
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard')
  await expect(page.getByText(`${monthName} ${now.getFullYear()}`, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Current', { exact: true })).toBeVisible()

  // Migration flow: backup → analyse → upgrade
  const banner = page.getByText('Upgrade your data to the new transaction model')
  await expect(banner).toBeVisible({ timeout: 10_000 })
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: '1. Download backup' }).click()
  expect((await dl).suggestedFilename()).toMatch(/financeflow-backup-.*\.json/)
  await page.getByRole('button', { name: '2. Analyse my data' }).click()
  await expect(page.getByText(/→ 6 transactions/)).toBeVisible()
  await page.getByRole('button', { name: '3. Upgrade now' }).click()
  await expect(page.getByText(/6 transactions migrated and verified/)).toBeVisible({ timeout: 10_000 })

  const txs = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/transactions`), U)
  expect(txs.filter((t: any) => t.source === 'migration')).toHaveLength(6)
  expect(txs.find((t: any) => t.id === 'legacy_incomes_i2').recurrenceId).toBeUndefined()
  // legacy docs untouched
  const legacy = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/incomes`), U)
  expect(legacy).toHaveLength(2)

  // Quick add a one-time expense in seconds: amount + category + save
  await page.getByRole('button', { name: 'Quick add' }).click()
  await page.getByRole('button', { name: 'Expense' }).last().click()
  await page.getByPlaceholder('0', { exact: true }).fill('450')
  await page.getByRole('button', { name: /Food & Dining/ }).first().click()
  await page.getByPlaceholder(/Description/).fill('Lunch')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  // Custom category: "Other…" → type → saved and reusable
  await page.getByRole('button', { name: 'Quick add' }).click()
  await page.getByRole('button', { name: 'Expense' }).last().click()
  await page.getByPlaceholder('0', { exact: true }).fill('1200')
  await page.getByRole('button', { name: /Other…/ }).click()
  await page.getByPlaceholder(/Type a category/).fill('Pet care')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('button', { name: /Pet care/ })).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible()
  const pet = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/transactions`).find((t: any) => t.amount === 1200), U)
  expect(pet.category).toBe('cus_pet_care')
  const settings = await page.evaluate(U => (window as any).__fakeDb.dump(`${U}/meta/settings`), U)
  expect(JSON.stringify(settings)).toContain('Pet care')

  // Transfer between accounts must not change income/expenses
  await page.getByRole('button', { name: 'Quick add' }).click()
  await page.getByRole('button', { name: 'Transfer' }).last().click()
  await page.getByPlaceholder('0', { exact: true }).fill('20000')
  const selects = page.locator('form select')
  await selects.nth(1).selectOption({ label: 'Main Account' }) // from (index 0 is "More…")
  await page.locator('form select').filter({ hasText: 'Select…' }).selectOption({ label: 'Cash' })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible()

  const all = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/transactions`), U)
  const cur = all.filter((t: any) => t.date.startsWith(ym(now)))
  expect(cur.find((t: any) => t.type === 'expense' && t.amount === 450 && t.date === today)).toBeTruthy()
  expect(cur.find((t: any) => t.type === 'transfer' && t.amount === 20000)).toBeTruthy()
  const accounts = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/accounts`), U)
  const main = accounts.find((a: any) => a.id === 'main'), cash = accounts.find((a: any) => a.id === 'cash')
  // main: +115000 −25850 −5000 −20000 (migration) −450 −1200 −20000 = 42500 ; cash: +20000
  expect(main.balance).toBe(42500)
  expect(cash.balance).toBe(20000)

  // Current-month cards: expenses = 450 (transfer excluded), income = 0
  const card = (label: string) => page.locator('div.card').filter({ has: page.getByText(label, { exact: true }) }).first()
  await expect(card('Expenses')).toContainText('Rs. 1,650')
  await expect(card('Income')).toContainText('Rs. 0')

  // Previous month: migrated history
  await page.getByRole('button', { name: 'Previous period' }).click()
  await expect(card('Income')).toContainText('Rs. 115,000')
  await expect(card('Expenses')).toContainText('Rs. 25,850')
  await expect(card('Savings')).toContainText('Rs. 5,000')
  await expect(card('Investments')).toContainText('Rs. 20,000')

  // Voice → preview → existing form → confirm
  await page.goto('voice')
  await page.getByPlaceholder(/e.g. Add expense/).fill('Paid 3,500 for vehicle repair today')
  await page.getByRole('button', { name: 'Process' }).click()
  await page.getByRole('button', { name: /Review & save/ }).click()
  await expect(page.getByPlaceholder('0', { exact: true })).toHaveValue('3500')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible()
  const v = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/transactions`).filter((t: any) => t.source === 'voice'), U)
  expect(v).toHaveLength(1); expect(v[0]).toMatchObject({ type: 'expense', amount: 3500, category: 'transport' })

  // AI assistant answers from real data (on-device fallback, FACT label)
  await page.goto('ai-advisor')
  await page.getByRole('button', { name: 'How much did I save this month?' }).first().click()
  await expect(page.getByText(/FACT/).last()).toBeVisible()

  // Every route renders without crashing
  for (const r of ['transactions', 'income', 'expenses', 'cashflow', 'calendar', 'accounts', 'budgets', 'planning', 'savings', 'investments', 'analytics', 'insights', 'reports', 'dashboard']) {
    await page.goto(r)
    await expect(page.locator('main')).not.toBeEmpty()
    await expect(page.getByText(/Something went wrong|Unexpected Application Error/)).toHaveCount(0)
  }
  const real = errors.filter(e => !/favicon|manifest|Download the React DevTools|net::ERR|localhost:8080|Failed to load resource/.test(e))
  expect(real, real.join('\n')).toEqual([])
})
