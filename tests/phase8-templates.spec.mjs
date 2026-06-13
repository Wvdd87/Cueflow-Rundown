// Templates: save a rundown as a template, then create a new rundown from it.
// No migration needed (uses existing is_template). Run:
//   node tests/phase8-templates.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `tpl.test.${rand}@gmail.com`
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
const cueCount = () => page.getByTestId('private-note-cell').count()

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Tpl Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Master Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
    await page.waitForTimeout(450)
  }
  assert((await cueCount()) === 2, 'Master rundown has 2 cues')

  // Save as template ---------------------------------------------------------
  log('Saving as template via the Rundown menu')
  await page.getByTestId('rundown-menu').click()
  await page.waitForTimeout(200)
  await page.getByTestId('save-as-template').click()
  await page.waitForTimeout(1200)

  // Dashboard shows the template --------------------------------------------
  log('Checking Templates section on dashboard')
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  assert(
    await page.getByText('Templates', { exact: true }).isVisible(),
    'Templates section visible'
  )
  assert(
    await page.getByText('Master Show (template)').first().isVisible(),
    'Template "Master Show (template)" listed'
  )

  // Use the template → new rundown with copied cues -------------------------
  log('Using the template')
  await page.getByTestId('use-template').first().click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.waitForTimeout(900)
  assert((await cueCount()) === 2, 'New rundown from template copied the 2 cues')

  await page.screenshot({ path: 'tests/phase8-templates-result.png' })
  ok('Screenshot saved')
  console.log('\n🎉 ALL TEMPLATE CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase8-templates-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase8-templates-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}
