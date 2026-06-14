// Todo #8 — Trash for deleted cues and columns
// Run with:  node tests/todo8-trash.spec.mjs
// Requires dev server on localhost:3000 AND phase13 migration applied.

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo8.test.${rand}@gmail.com`
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
  await page.fill('input[name="full_name"]', 'Todo8 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  // 2. Create rundown
  log('Creating rundown')
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Trash Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown open in editor')

  // 3. Add a cue
  log('Adding first cue')
  const addCueBtn = page.getByRole('button', { name: /add first cue/i }).first()
  await addCueBtn.waitFor({ state: 'visible', timeout: 5000 })
  await addCueBtn.click()
  await page.waitForTimeout(800)
  ok('Cue added')

  // 4. Trash is initially empty
  log('Checking initial trash state')
  const menuTrigger = page.locator('[data-testid="rundown-menu"]')
  await menuTrigger.click()
  await page.waitForTimeout(300)

  const trashMenuItem = page.locator('[data-testid="open-trash-menu-item"]')
  await trashMenuItem.waitFor({ state: 'visible', timeout: 3000 })
  ok('"Trash" option visible in Rundown menu')

  await trashMenuItem.click()
  await page.waitForTimeout(600)

  const dialogTitle = page.getByText('Rundown trash').first()
  await dialogTitle.waitFor({ state: 'visible', timeout: 3000 })
  ok('Trash dialog opened')

  const emptyMsg = page.getByText('Trash is empty').first()
  await emptyMsg.waitFor({ state: 'visible', timeout: 3000 })
  ok('Trash is empty initially')

  const notice = page.getByText(/30 days/).first()
  await notice.waitFor({ state: 'visible', timeout: 2000 })
  ok('30-day notice shown')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // 5. Delete the cue via its settings dropdown
  log('Deleting the cue')
  // Hover over the cue row to reveal the settings button
  const cueSettingsBtn = page.locator('[data-testid="cue-settings-btn"]').first()
  await cueSettingsBtn.waitFor({ state: 'visible', timeout: 3000 })
  await cueSettingsBtn.click()
  await page.waitForTimeout(300)

  const deleteCueItem = page.locator('[data-testid="delete-cue-menu-item"]').first()
  await deleteCueItem.waitFor({ state: 'visible', timeout: 2000 })
  await deleteCueItem.click()
  await page.waitForTimeout(600)
  ok('Cue deleted (soft-delete)')

  // 6. Cue should disappear from editor
  const cueSettingsBtnGone = await page.locator('[data-testid="cue-settings-btn"]').count()
  assert(cueSettingsBtnGone === 0, 'Deleted cue is gone from editor')

  // 7. Open trash and verify deleted cue appears
  log('Verifying cue in trash')
  await menuTrigger.click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="open-trash-menu-item"]').click()
  await page.waitForTimeout(800)

  // Cues section with at least one item
  const cueSection = page.getByText('Cues', { exact: true }).first()
  await cueSection.waitFor({ state: 'visible', timeout: 3000 })
  ok('Cues section appears in trash after deleting a cue')

  // Days remaining should show "30d remaining"
  const daysRemaining = page.getByText(/\d+d remaining/).first()
  await daysRemaining.waitFor({ state: 'visible', timeout: 2000 })
  ok('Days remaining shown for trashed cue')

  // 8. Restore the cue
  log('Restoring the cue')
  const restoreCueBtn = page.locator('[data-testid^="restore-cue-"]').first()
  await restoreCueBtn.waitFor({ state: 'visible', timeout: 3000 })
  await restoreCueBtn.click()
  await page.waitForTimeout(1000)
  ok('Restore button clicked')

  // Dialog should now show empty trash again
  const emptyAfterRestore = page.getByText('Trash is empty').first()
  await emptyAfterRestore.waitFor({ state: 'visible', timeout: 3000 })
  ok('Trash is empty after restoring the cue')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // 9. Restored cue appears back in editor
  const restoredCueSetting = page.locator('[data-testid="cue-settings-btn"]').first()
  await restoredCueSetting.waitFor({ state: 'visible', timeout: 5000 })
  ok('Restored cue reappears in editor')

  // 10. Add and delete a column
  log('Testing column trash')
  const addColBtn = page.locator('[data-testid="add-column-btn"]').first()
  await addColBtn.waitFor({ state: 'visible', timeout: 3000 })
  await addColBtn.click()
  await page.waitForTimeout(600)

  // Fill column name and submit
  const colNameInput = page.locator('[data-testid="column-name"]').first()
  const hasColInput = await colNameInput.isVisible({ timeout: 1000 }).catch(() => false)
  if (hasColInput) {
    await colNameInput.fill('Test Column')
    await page.locator('[data-testid="add-column-submit"]').first().click()
    await page.waitForTimeout(600)
    ok('Column "Test Column" added')
  } else {
    // Column added without a name dialog
    ok('Column added (no name dialog)')
  }

  // Hover the column header to reveal the menu button
  const colHeaders = page.locator('[data-testid="column-menu-btn"]')
  await colHeaders.first().waitFor({ state: 'attached', timeout: 3000 })
  // Force hover to reveal opacity-0 button
  await colHeaders.first().hover({ force: true })
  await page.waitForTimeout(200)
  await colHeaders.first().click({ force: true })
  await page.waitForTimeout(300)

  const deleteColItem = page.getByRole('menuitem', { name: /^Delete$/i }).first()
  await deleteColItem.waitFor({ state: 'visible', timeout: 2000 })
  await deleteColItem.click()
  await page.waitForTimeout(600)
  ok('Column deleted (soft-delete)')

  // 11. Open trash and verify column appears
  await menuTrigger.click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="open-trash-menu-item"]').click()
  await page.waitForTimeout(800)

  const colSection = page.getByText('Columns', { exact: true }).first()
  await colSection.waitFor({ state: 'visible', timeout: 3000 })
  ok('Columns section appears in trash after deleting a column')

  const restoreColBtn = page.locator('[data-testid^="restore-column-"]').first()
  await restoreColBtn.waitFor({ state: 'visible', timeout: 3000 })
  await restoreColBtn.click()
  await page.waitForTimeout(1000)
  ok('Column restored from trash')

  const emptyFinal = page.getByText('Trash is empty').first()
  await emptyFinal.waitFor({ state: 'visible', timeout: 3000 })
  ok('Trash empty after restoring column')

  console.log('\n• === VERDICT: ✅ PASS ===')
} catch (err) {
  console.error('\n❌ Test error:', err.message)
  await page.screenshot({ path: '/tmp/todo8-fail.png' }).catch(() => {})
  console.log('• Screenshot: /tmp/todo8-fail.png')
  console.log('\n• === VERDICT: ❌ FAIL ===')
} finally {
  await browser.close()
}
