// Trash / recovery: soft-delete → Trash → restore / purge.
// Requires schema_phase9.sql (rundowns.deleted_at). Run:
//   node tests/phase9-trash.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `trash.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1300, height: 820 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

async function createRundown(name) {
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', name)
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('link', { name: /dashboard/i }).first().click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.waitForTimeout(500)
}

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Trash Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  await createRundown('Trash Me')
  assert(await page.getByText('Trash Me').first().isVisible(), 'Rundown on dashboard')

  // Soft-delete -------------------------------------------------------------
  log('Deleting the rundown (soft-delete)')
  await page.getByTestId('rundown-menu-btn').first().click()
  await page.waitForTimeout(200)
  await page.getByTestId('rundown-delete').click()
  await page.waitForTimeout(1000)
  assert(
    (await page.getByText('Trash Me').count()) === 0,
    'Rundown removed from dashboard after delete'
  )

  // Appears in Trash --------------------------------------------------------
  log('Opening Trash')
  await page.getByRole('link', { name: /^trash$/i }).first().click()
  await page.waitForURL('**/trash', { timeout: 15000 })
  await page.waitForTimeout(700)
  assert(await page.getByText('Trash Me').first().isVisible(), 'Rundown listed in Trash')

  // Restore -----------------------------------------------------------------
  log('Restoring')
  await page.getByTestId('restore-rundown').first().click()
  await page.waitForTimeout(1000)
  assert(
    (await page.getByText('Trash Me').count()) === 0,
    'Rundown left Trash after restore'
  )
  await page.getByRole('link', { name: /dashboard/i }).first().click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.waitForTimeout(700)
  assert(
    await page.getByText('Trash Me').first().isVisible(),
    'Rundown back on dashboard after restore'
  )

  // Delete again → purge ----------------------------------------------------
  log('Deleting again, then purging permanently')
  await page.getByTestId('rundown-menu-btn').first().click()
  await page.waitForTimeout(200)
  await page.getByTestId('rundown-delete').click()
  await page.waitForTimeout(800)
  await page.getByRole('link', { name: /^trash$/i }).first().click()
  await page.waitForURL('**/trash', { timeout: 15000 })
  await page.waitForTimeout(700)
  await page.getByTestId('purge-rundown').first().click()
  await page.waitForTimeout(1000)
  assert(
    (await page.getByText('Trash Me').count()) === 0,
    'Rundown permanently deleted (gone from Trash)'
  )

  await page.screenshot({ path: 'tests/phase9-trash-result.png' })
  ok('Screenshot saved')
  console.log('\n🎉 ALL TRASH CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase9-trash-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase9-trash-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}
