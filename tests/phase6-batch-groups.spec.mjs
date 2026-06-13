// Phase 6: batch selection + cue grouping.
// Requires schema_phase6.sql (cues.group_id). Run:
//   node tests/phase6-batch-groups.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `p6.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 850 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

const cueCount = () => page.getByTestId('private-note-cell').count()
const num = (n) => page.locator('div.w-12').getByText(String(n), { exact: true })

try {
  // Setup --------------------------------------------------------------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'P6 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Groups Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
    await page.waitForTimeout(450)
  }
  assert((await cueCount()) === 3, 'Three cues added (auto-numbered 1,2,3)')

  // 1. Selection + batch toolbar --------------------------------------------
  log('Selecting cue 2, then shift-extend to cue 3')
  await num(2).click()
  await page.waitForTimeout(200)
  assert(await page.getByTestId('batch-toolbar').isVisible(), 'Batch toolbar appears on selection')
  assert(
    (await page.getByTestId('batch-toolbar').textContent())?.includes('1 selected'),
    'Toolbar shows "1 selected"'
  )
  await num(3).click({ modifiers: ['Shift'] })
  await page.waitForTimeout(200)
  assert(
    (await page.getByTestId('batch-toolbar').textContent())?.includes('2 selected'),
    'Shift-click range → "2 selected"'
  )

  // 2. Group ----------------------------------------------------------------
  log('Grouping cues 2 & 3')
  await page.getByTestId('batch-group').click()
  await page.waitForTimeout(1200)
  assert(await page.getByText('New group').first().isVisible(), 'Group header "New group" created')
  assert(await page.getByText('2.1', { exact: true }).isVisible(), 'Child renumbered 2.1')
  assert(await page.getByText('2.2', { exact: true }).isVisible(), 'Child renumbered 2.2')

  // 3. Collapse / expand -----------------------------------------------------
  log('Collapsing the group')
  await page.getByTestId('group-collapse').first().click()
  await page.waitForTimeout(400)
  assert((await page.getByText('2.1', { exact: true }).count()) === 0, 'Children hidden when collapsed')
  await page.getByTestId('group-collapse').first().click()
  await page.waitForTimeout(400)
  assert(await page.getByText('2.1', { exact: true }).isVisible(), 'Children shown again when expanded')

  // 4. Ungroup (select the group heading) -----------------------------------
  log('Ungrouping via the group heading')
  await num(2).click() // selects the heading (number "2")
  await page.waitForTimeout(200)
  await page.getByTestId('batch-ungroup').click()
  await page.waitForTimeout(1200)
  assert((await page.getByText('New group').count()) === 0, 'Group removed after ungroup')
  assert((await cueCount()) === 3, 'Three cues remain (ungrouped to top level)')

  // 5. Duplicate ------------------------------------------------------------
  log('Duplicating cue 1')
  await num(1).click()
  await page.waitForTimeout(200)
  await page.getByTestId('batch-duplicate').click()
  await page.waitForTimeout(1200)
  assert((await cueCount()) === 4, 'Duplicate added a cue (now 4)')

  // 6. Background ------------------------------------------------------------
  log('Applying a background colour to a selection')
  await num(1).click()
  await page.waitForTimeout(200)
  await page.getByTestId('batch-bg').click()
  await page.waitForTimeout(200)
  await page.getByTestId('batch-bg-2').click() // red
  await page.waitForTimeout(400)
  const coloured = await page
    .locator('div.group.relative[style*="background"]')
    .count()
  assert(coloured >= 1, 'Background colour applied to a cue row')

  // 7. Delete + select-all/clear --------------------------------------------
  log('Deleting a cue')
  await num(4).click()
  await page.waitForTimeout(200)
  await page.getByTestId('batch-delete').click()
  await page.waitForTimeout(900)
  assert((await cueCount()) === 3, 'Cue deleted (back to 3)')

  log('Select all + clear')
  await num(1).click()
  await page.waitForTimeout(150)
  await page.getByTestId('batch-select-all').click()
  await page.waitForTimeout(200)
  assert(
    (await page.getByTestId('batch-toolbar').textContent())?.includes('3 selected'),
    'Select all selects every cue'
  )
  await page.getByTestId('batch-clear').click()
  await page.waitForTimeout(200)
  assert((await page.getByTestId('batch-toolbar').count()) === 0, 'Clear hides the toolbar')

  await page.screenshot({ path: 'tests/phase6-batch-groups-result.png' })
  ok('Screenshot saved to tests/phase6-batch-groups-result.png')

  console.log('\n🎉 ALL PHASE 6 BATCH + GROUP CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase6-batch-groups-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase6-batch-groups-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}
