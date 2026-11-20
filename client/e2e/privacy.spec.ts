import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

const U = 'users/e2e-user'
const errors: string[] = []
test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
})
const clean = () => errors.filter(e => !/favicon|manifest|DevTools|net::ERR|localhost:8080|Failed to load resource|Network Error|ERR_CONNECTION/.test(e))
const cloud = (page: any, c: string) => page.evaluate(([U, c]: string[]) => (window as any).__fakeDb.list(`${U}/${c}`), [U, c])
const cloudProfile = (page: any) => page.evaluate((U: string) => (window as any).__fakeDb.dump(U)[U], U)

async function lend(page: any, who: string, amount: string) {
  await page.goto('loans')
  await page.getByRole('button', { name: '🤝 I lent money' }).click()
  await page.getByLabel('Borrower').fill(who)
  await page.getByLabel('Amount').fill(amount)
  await page.getByRole('button', { name: 'Add loan' }).click()
  await page.getByRole('tab', { name: 'I lent' }).click()
  await expect(page.getByText(`To ${who}`)).toBeVisible()
}

test('local-only mode: move data to the device, encrypted backup, restore on a new device, move back to cloud', async ({ page, browser }) => {
  // A cloud account with some data
  await page.goto('dashboard')
  await page.evaluate((U: string) => {
    const db = (window as any).__fakeDb
    db.seed(U, { email: 'tester@example.lk', profile: { firstName: 'Test', lastName: 'User' } })
    db.seed(`${U}/accounts/main`, { name: 'Main Account', type: 'bank', currency: 'LKR', openingBalance: 100000, balance: 100000 })
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
  }, U)
  await page.reload()
  await lend(page, 'Nimal', '8000')
  expect(await cloud(page, 'loans')).toHaveLength(1)

  // Move everything to this device
  await page.goto('settings?tab=privacy')
  await expect(page.getByTestId('storage-mode')).toContainText('Cloud sync')
  await page.getByRole('button', { name: /Keep my data only on this device/ }).click()
  const move = page.getByRole('button', { name: 'Move to this device' })
  await expect(move).toBeDisabled()
  await page.getByLabel('I understand and will keep backups.').check()
  await move.click()
  await expect(page.getByTestId('storage-mode')).toContainText('This device only', { timeout: 15000 })

  // Nothing financial is left in the cloud — only the local-only marker
  expect(await cloud(page, 'loans')).toEqual([])
  expect(await cloud(page, 'accounts')).toEqual([])
  expect(await cloud(page, 'transactions')).toEqual([])
  expect(await cloud(page, 'auditLogs')).toEqual([])
  expect(Object.keys(await cloudProfile(page)).sort()).toEqual(['storageMode', 'updatedAt'])

  // The app keeps working from the device, and new data stays on the device
  await lend(page, 'Kamal', '3000')
  await page.reload()
  await page.getByRole('tab', { name: 'I lent' }).click()
  await expect(page.getByText('To Nimal')).toBeVisible()
  await expect(page.getByText('To Kamal')).toBeVisible()
  expect(await cloud(page, 'loans')).toEqual([])
  expect(await cloud(page, 'transactions')).toEqual([])

  // Encrypted backup file
  await page.goto('settings?tab=privacy')
  await page.getByLabel('Backup password', { exact: true }).fill('my secret pass')
  await page.getByLabel('Repeat password').fill('my secret pass')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download backup file/ }).click()])
  expect(download.suggestedFilename()).toMatch(/^FinanceFlow-backup-.*\.ffbackup$/)
  const path = await download.path()
  const text = readFileSync(path!, 'utf8')
  expect(text).toContain('"format":"financeflow-backup"')
  expect(text).not.toMatch(/Nimal|Kamal|Main Account|8000/)
  await expect(page.getByTestId('last-backup')).not.toContainText('never')
  expect(clean()).toEqual([])

  // A new device: same account, empty device, cloud has only the marker
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4173/financeflow/', timezoneId: 'Asia/Colombo' })
  const p2 = await ctx.newPage()
  await p2.goto('dashboard')
  await p2.evaluate((U: string) => { (window as any).__fakeDb.seed(U, { storageMode: 'local' }) }, U)
  await p2.reload()
  await expect(p2.getByText(/this device has none yet/)).toBeVisible()
  await p2.getByRole('link', { name: 'Restore a backup' }).click()
  await expect(p2.getByTestId('storage-mode')).toContainText('This device only')
  await p2.getByLabel('Choose backup file').setInputFiles(path!)
  await p2.getByRole('dialog').getByLabel('Backup password').fill('wrong password')
  await p2.getByRole('button', { name: 'Unlock' }).click()
  await expect(p2.getByText('Wrong password, or the backup file is damaged.')).toBeVisible()
  await p2.getByRole('dialog').getByLabel('Backup password').fill('my secret pass')
  await p2.getByRole('button', { name: 'Unlock' }).click()
  await p2.getByRole('button', { name: 'Replace my data' }).click()
  await p2.waitForLoadState('load')
  await p2.waitForTimeout(1500)
  await p2.goto('loans')
  await p2.getByRole('tab', { name: 'I lent' }).click()
  await expect(p2.getByText('To Nimal')).toBeVisible()
  await expect(p2.getByText('To Kamal')).toBeVisible()
  expect(await cloud(p2, 'loans')).toEqual([])

  // Back to cloud sync: everything is uploaded again
  await p2.goto('settings?tab=privacy')
  await p2.getByRole('button', { name: /Move my data back to cloud sync/ }).click()
  await p2.getByRole('button', { name: 'Move to cloud' }).click()
  await expect(p2.getByTestId('storage-mode')).toContainText('Cloud sync', { timeout: 15000 })
  expect(await cloud(p2, 'loans')).toHaveLength(2)
  expect((await cloud(p2, 'accounts')).find((a: any) => a.id === 'main').balance).toBe(89000)
  expect((await cloudProfile(p2)).storageMode).toBeUndefined()
  await ctx.close()
})

test('sign-up can choose to keep data only on the device', async ({ page }) => {
  // A brand-new visitor: signed out on first load only
  await page.addInitScript(() => { if (!sessionStorage.getItem('e2e-once')) { sessionStorage.setItem('e2e-once', '1'); localStorage.setItem('e2e-signed-out', '1') } })
  await page.goto('register')
  await page.evaluate(() => localStorage.removeItem('e2e-signed-out'))
  await page.getByLabel(/Keep my financial data only on this device/).check()
  await page.getByPlaceholder('John').fill('Asha')
  await page.getByPlaceholder('Doe').fill('Perera')
  await page.locator('input[type="email"]').fill('asha@example.lk')
  await page.locator('input[type="password"]').nth(0).fill('Str0ng!Pass')
  await page.locator('input[type="password"]').nth(1).fill('Str0ng!Pass')
  await page.locator('#terms').check()
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.waitForURL(/dashboard/)
  await page.goto('settings?tab=privacy')
  await expect(page.getByTestId('storage-mode')).toContainText('This device only')
  expect(Object.keys(await cloudProfile(page)).sort()).toEqual(['storageMode', 'updatedAt'])
})
