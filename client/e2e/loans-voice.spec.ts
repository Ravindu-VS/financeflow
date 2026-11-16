import { test, expect } from '@playwright/test'

const U = 'users/e2e-user'
const errors: string[] = []
test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
})
const clean = () => errors.filter(e => !/favicon|manifest|DevTools|net::ERR|localhost:8080|Failed to load resource|Network Error|ERR_CONNECTION/.test(e))

async function seed(page: any) {
  await page.goto('dashboard')
  await page.evaluate((U: string) => {
    const db = (window as any).__fakeDb
    db.seed(`${U}/accounts/main`, { name: 'Main Account', type: 'bank', currency: 'LKR', openingBalance: 100000, balance: 100000 })
    db.seed(`${U}/meta/migration`, { status: 'completed', version: 1 })
  }, U)
  await page.reload()
}
const doc = (page: any, path: string) => page.evaluate(([U, p]: string[]) => (window as any).__fakeDb.list(`${U}/${p.split('/')[0]}`).find((d: any) => !p.includes('/') || d.id === p.split('/')[1]), [U, path])
const list = (page: any, c: string) => page.evaluate(([U, c]: string[]) => (window as any).__fakeDb.list(`${U}/${c}`), [U, c])

test('borrow a loan, repay part with interest, repay the rest → closed; balances and net worth correct', async ({ page }) => {
  await seed(page)
  await page.getByRole('link', { name: 'Loans' }).first().click()
  await page.getByRole('button', { name: '🏦 I borrowed' }).click()
  await page.getByLabel('Lender (bank or person)').fill('Commercial Bank')
  await page.getByLabel('Amount').fill('50000')
  await page.getByRole('button', { name: 'Add loan' }).click()
  await expect(page.getByText('From Commercial Bank')).toBeVisible()
  await expect.poll(async () => (await doc(page, 'accounts/main')).balance).toBe(150000)
  const loanTx = (await list(page, 'transactions')).find((t: any) => t.type === 'loan_received')
  expect(loanTx.amount).toBe(50000)

  // net worth unchanged by borrowing (cash +50k, debt +50k)
  await page.getByRole('link', { name: 'Accounts & Net Worth' }).first().click()
  await expect(page.getByText(/Rs\. 100,000/).first()).toBeVisible()

  await page.getByRole('link', { name: 'Loans' }).first().click()
  await page.getByRole('button', { name: 'Record repayment' }).click()
  await page.getByLabel('Principal amount').fill('20000')
  await page.getByLabel('Interest paid (optional)').fill('750')
  await page.getByRole('button', { name: 'Save repayment' }).click()
  await expect(page.getByText(/Rs\. 20,000 repaid · 40%/)).toBeVisible()
  await expect.poll(async () => (await doc(page, 'accounts/main')).balance).toBe(150000 - 20000 - 750)
  const interest = (await list(page, 'transactions')).find((t: any) => t.category === 'loan_interest')
  expect(interest).toMatchObject({ type: 'expense', amount: 750 })

  // over-repayment is refused
  await page.getByRole('button', { name: 'Record repayment' }).click()
  await page.getByLabel('Principal amount').fill('40000')
  await page.getByRole('button', { name: 'Save repayment' }).click()
  await page.getByLabel('Principal amount').fill('30000')
  await page.getByRole('button', { name: 'Save repayment' }).click()
  await expect(page.getByText(/Fully repaid/)).toBeVisible()
  await expect.poll(async () => (await list(page, 'loans'))[0].status).toBe('repaid')
  await expect(page.getByText('From Commercial Bank')).toHaveCount(0) // hidden until "Show repaid"
  await page.getByLabel('Show repaid').check()
  await expect(page.getByText('Repaid', { exact: true })).toBeVisible()

  // loan money is not income/expense on the dashboard
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page.getByText('Rs. 750').first()).toBeVisible()
  expect(clean()).toEqual([])
})

test('lend money and mark repaid manually', async ({ page }) => {
  await seed(page)
  await page.goto('loans')
  await page.getByRole('button', { name: '🤝 I lent money' }).click()
  await page.getByLabel('Borrower').fill('Nimal')
  await page.getByLabel('Amount').fill('8000')
  await page.getByRole('button', { name: 'Add loan' }).click()
  await page.getByRole('tab', { name: 'I lent' }).click()
  await expect(page.getByText('To Nimal')).toBeVisible()
  await expect.poll(async () => (await doc(page, 'accounts/main')).balance).toBe(92000)
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Mark as repaid' }).click()
  await expect.poll(async () => (await list(page, 'loans'))[0].status).toBe('repaid')
  expect(clean()).toEqual([])
})

test('Sinhala text input is understood and categorised', async ({ page }) => {
  await seed(page)
  await page.goto('voice')
  await page.getByRole('radio', { name: 'සිංහල' }).click()
  await page.getByPlaceholder(/උදා/).fill('ඊයේ ත්‍රීවීල් එකට 600ක් ගෙව්වා')
  await page.getByRole('button', { name: 'Process' }).click()
  await expect(page.getByText(/Review a expense of Rs\. 600 in Transport/)).toBeVisible()
  await page.getByRole('button', { name: /Review & save/ }).click()
  await expect(page.getByRole('heading', { name: 'Add transaction' })).toBeVisible()
  await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('600')
  expect(clean()).toEqual([])
})

test('mobile-style recogniser that ends without a final result still works and never sticks on listening', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRec {
      lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
      onstart: any; onresult: any; onend: any; onerror: any; onspeechend: any
      start() {
        (window as any).__lastLang = this.lang
        setTimeout(() => this.onstart?.(), 50)
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'අද කෑමට 450ක් වියදම් කළා' }], { isFinal: false })] }), 300)
        setTimeout(() => this.onend?.(), 600) // ends with no final result, like Android
      }
      stop() {}
      abort() {}
    }
    ;(window as any).webkitSpeechRecognition = FakeRec; (window as any).SpeechRecognition = FakeRec
  })
  await seed(page)
  await page.goto('voice')
  await page.getByRole('radio', { name: 'සිංහල' }).click()
  await page.locator('button.rounded-full.w-28').click()
  await expect(page.getByText(/Review a expense of Rs\. 450 in Food/)).toBeVisible()
  await expect(page.getByText('කතා කිරීමට ඔබන්න')).toBeVisible() // back to "tap to speak"
  expect(await page.evaluate(() => (window as any).__lastLang)).toBe('si-LK')
  expect(clean()).toEqual([])
})
