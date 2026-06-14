// Todo #6 — Remove aside sidebar; sign-out on dashboard
// Run with:  node tests/todo6-no-sidebar.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo6.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

try {
  // 1. Sign up
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo6 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up and on dashboard')

  // 2. Sidebar should be gone
  const aside = page.locator('aside')
  assert(!(await aside.isVisible()), 'No <aside> sidebar on dashboard')

  // 3. User menu (avatar) should be visible in the dashboard header
  const avatar = page.locator('.rounded-full button, button.rounded-full').first()
  // Look for the avatar button — it has initials inside
  const userMenuBtn = page.locator('button').filter({ has: page.locator('.rounded-full') }).first()
  // Actually just look for the Avatar component which renders initials
  const avatarEl = page.locator('[class*="AvatarFallback"], [data-slot="avatar-fallback"]').first()
  // More robustly: find the avatar by the initials "TT" (Todo6 Tester)
  const initialsEl = page.locator('button').filter({ hasText: 'TT' }).first()
  await initialsEl.waitFor({ state: 'visible', timeout: 3000 })
  ok('User avatar with initials visible in dashboard header')

  // 4. Click avatar to open dropdown
  await initialsEl.click()
  await page.waitForTimeout(300)

  // 5. "Sign out" option should appear
  const signOutItem = page.getByText('Sign out').first()
  await signOutItem.waitFor({ state: 'visible', timeout: 2000 })
  ok('"Sign out" option in user menu dropdown')

  // 6. User name/email should show in dropdown
  const emailText = page.getByText(EMAIL).first()
  await emailText.waitFor({ state: 'visible', timeout: 2000 })
  ok('User email shown in dropdown')

  // 7. Click sign out
  await signOutItem.click()
  await page.waitForURL('**/login', { timeout: 10000 })
  ok('Sign out navigates to /login')

  // 8. Verify rundown editor still works full-width (no sidebar space reserved)
  // Sign back in
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Test Show')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })

  // Editor should render without sidebar
  const asideInEditor = page.locator('aside')
  assert(!(await asideInEditor.isVisible()), 'No sidebar in rundown editor either')

  // Editor header should be full-width (RundownEditor renders)
  const editorHeader = page.locator('[data-testid="rundown-menu"]')
  await editorHeader.waitFor({ state: 'visible', timeout: 3000 })
  ok('Rundown editor renders correctly without sidebar')

  // Dashboard link in "Rundown" menu still works
  await editorHeader.click()
  await page.waitForTimeout(300)
  const dashLink = page.getByRole('menuitem', { name: /Dashboard/i }).first()
  await dashLink.waitFor({ state: 'visible', timeout: 2000 })
  ok('"Dashboard" link in editor top-right menu')

  console.log('\n• === VERDICT: ✅ PASS ===')
} catch (err) {
  console.error('\n❌ Test error:', err.message)
  await page.screenshot({ path: '/tmp/todo6-fail.png' }).catch(() => {})
  console.log('• Screenshot: /tmp/todo6-fail.png')
  console.log('\n• === VERDICT: ❌ FAIL ===')
} finally {
  await browser.close()
}
