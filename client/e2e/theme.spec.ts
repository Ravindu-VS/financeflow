import { test, expect } from '@playwright/test'

test('light theme stays light on a device in dark mode; "match device" follows it live; toggle flips on first tap', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('dashboard')
  await page.evaluate(() => (window as any).__fakeDb.seed('users/e2e-user/meta/migration', { status: 'completed', version: 1 }))
  // default "system" on a dark device → dark
  await page.reload()
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  // first tap on the toggle switches to light (it used to need two taps)
  await page.getByTitle('Switch to light mode').click()
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light')
  // light survives reload even though the device is dark (no flash, native controls light)
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false)
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(249, 250, 251)')
  // the AI advisor page is light in light theme
  await page.goto('ai-advisor')
  const bg = await page.locator('main .rounded-xl').first().evaluate(el => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgb(255, 255, 255)')
  // "Match device" follows the OS live
  await page.goto('settings')
  await page.getByRole('radio', { name: 'Match device' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false)
})
