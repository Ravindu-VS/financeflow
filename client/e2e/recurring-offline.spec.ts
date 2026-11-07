import { test, expect } from '@playwright/test'

const U = 'users/e2e-user'
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const start = key(new Date(now.getFullYear(), now.getMonth() - 2, 1))

test('auto-generating recurring rule creates each occurrence once (idempotent across reloads)', async ({ page }) => {
  await page.goto('dashboard')
  await page.evaluate(([U, start]) => {
    const db = (window as any).__fakeDb
    db.seed(`${U}/accounts/main`, { name: 'Main Account', type: 'bank', currency: 'LKR', openingBalance: 0, balance: 0 })
    db.seed(`${U}/recurringRules/sal`, { type: 'income', amount: 100000, currency: 'LKR', category: 'salary', description: 'Salary', accountId: 'main', frequency: 'monthly', startDate: start, autoGenerate: true, active: true })
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
  }, [U, start] as const)
  await page.reload()
  await page.waitForTimeout(1500)
  const gen = async () => page.evaluate(U => (window as any).__fakeDb.list(`${U}/transactions`).filter((t: any) => t.recurrenceId === 'sal'), U)
  expect(await gen()).toHaveLength(3) // start month, last month, this month (the 1st has passed)
  await page.reload(); await page.waitForTimeout(1500)
  expect(await gen()).toHaveLength(3)
  const acc = await page.evaluate(U => (window as any).__fakeDb.list(`${U}/accounts`).find((a: any) => a.id === 'main'), U)
  expect(acc.balance).toBe(300000)

  // Editing the rule changes only the future: history keeps 100,000
  await page.evaluate(U => (window as any).__fakeDb.seed(`${U}/recurringRules/sal`, { ...(window as any).__fakeDb.list(`${U}/recurringRules`)[0], amount: 120000 }), U)
  await page.reload(); await page.waitForTimeout(1000)
  expect((await gen()).every((t: any) => t.amount === 100000)).toBe(true)

  // Dashboard shows salary as this month's income
  await expect(page.locator('div.card').filter({ has: page.getByText('Income', { exact: true }) }).first()).toContainText('Rs. 100,000')
})

test('offline entry is accepted and flagged for sync', async ({ page, context }) => {
  await page.goto('dashboard')
  await page.evaluate(U => {
    const db = (window as any).__fakeDb
    db.seed(`${U}/accounts/main`, { name: 'Main Account', type: 'bank', currency: 'LKR', openingBalance: 0, balance: 0 })
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
  }, U)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible() // let lazy chunks load (prod: precached by SW)
  await page.getByRole('button', { name: 'Quick add' }).click(); await page.getByRole('button', { name: 'Quick add' }).click() // preload form chunk
  await context.setOffline(true)
  await expect(page.getByText(/Offline/)).toBeVisible()
  await page.getByRole('button', { name: 'Quick add' }).click()
  await page.getByRole('button', { name: 'Expense' }).last().click()
  await page.getByPlaceholder('0', { exact: true }).fill('850')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/Saved offline/)).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText(/Offline/)).toHaveCount(0)
})
