// Sharing v2: per-link visible columns + live progress sync to the read-only link.
// Requires schema_phase11.sql. Run:  node tests/phase11-sharing.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `sh2.test.${rand}@gmail.com`
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

async function addColumn(name) {
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill(name)
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(700)
}
async function setTitle(index, text) {
  await page.locator('button.text-sm.w-full.truncate').nth(index).click()
  const input = page.locator('input:focus')
  await input.fill(text)
  await input.press('Enter')
  await page.waitForTimeout(200)
}

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Sh2 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Live Share Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(450)
  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(450)
  await setTitle(0, 'Alpha')
  await setTitle(1, 'Bravo')
  await addColumn('Notes')
  await addColumn('Status')
  ok('Rundown ready (2 cues, columns Notes + Status)')

  // Create a link with Status hidden ----------------------------------------
  log('Creating a link with the Status column hidden')
  await page.getByTestId('rundown-menu').click()
  await page.waitForTimeout(200)
  await page.getByTestId('share-menu-item').click()
  await page.waitForTimeout(400)
  await page.getByTestId('create-share').click()
  await page.waitForTimeout(800)
  // toggle off "Status" column chip in the share row
  await page.getByTestId('share-row').getByRole('button', { name: 'Status' }).click()
  await page.waitForTimeout(600)
  const shareUrl = (await page.getByTestId('share-url').first().textContent())?.trim()
  log('share url:', shareUrl)
  assert(!!shareUrl, 'Link created')

  // Guest sees Notes but not Status -----------------------------------------
  log('Opening as guest — Status should be hidden')
  const guestCtx = await browser.newContext()
  const guest = await guestCtx.newPage()
  await guest.goto(shareUrl, { waitUntil: 'networkidle' })
  await guest.waitForTimeout(800)
  assert(await guest.getByText('Notes').first().isVisible(), 'Guest sees the Notes column')
  assert(
    (await guest.getByText('Status', { exact: true }).count()) === 0,
    'Status column hidden from this link'
  )

  // Live progress sync ------------------------------------------------------
  log('Operator starts the show — guest should follow live')
  await page.keyboard.press('Escape') // close the share dialog first
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /run show/i }).click()
  await page.waitForTimeout(3500) // allow broadcast + periodic re-broadcast
  assert(
    await guest.getByText('Live', { exact: true }).isVisible(),
    'Guest shows LIVE indicator'
  )
  assert(
    (await guest.locator('.bg-emerald-950\\/40').count()) >= 1,
    'Guest highlights the current (active) cue'
  )

  log('Operator advances to next cue — guest follows')
  await page.getByRole('button', { name: /^next$/i }).dispatchEvent('click')
  await page.waitForTimeout(3000)
  const activeNum = await guest
    .locator('.bg-emerald-950\\/40')
    .first()
    .locator('span')
    .first()
    .textContent()
  log('guest active cue number:', activeNum)
  assert(activeNum?.trim() === '2', 'Guest live-advanced to cue 2 when operator hit Next')

  await guest.screenshot({ path: 'tests/phase11-sharing-result.png' })
  ok('Screenshot saved')
  await guestCtx.close()

  console.log('\n🎉 ALL SHARING v2 (visible columns + live sync) CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase11-sharing-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
