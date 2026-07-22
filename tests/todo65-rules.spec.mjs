// Todo #65 — conditional rules: text-column condition -> background color +
// badge action, reactive re-evaluation on cell edit, manual-color precedence
// (and the override toggle), rule active/inactive toggling, and collaborator
// read-only visibility (no Rules menu item, but sees the visual result).
// Run with:  node tests/todo65-rules.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo65.test.${rand}@gmail.com`
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
let guest = null

async function addColumn(name) {
  await page.getByTestId('edit-columns-btn').click()
  await page.waitForTimeout(200)
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill(name)
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(700)
}

async function openRules() {
  await page.locator('[data-testid="rundown-menu"]').click()
  await page.waitForTimeout(150)
  await page.locator('[data-testid="open-rules-menu-item"]').click()
  await page.waitForTimeout(300)
}

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo65 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Rules Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown open')

  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.locator('[data-cue-id]').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.keyboard.press('Escape')
  await addColumn('Status')
  ok('1 cue + Status column ready')

  // Type "URGENT" into the Status cell for the cue. Private notes also use a
  // ".tiptap-cell"-classed editor, so scope strictly to the dynamic-column
  // wrapper (excludes both "title" and the "__private-notes__" sentinel).
  const cueRow = page.locator('[data-cue-id]').first()
  const statusWrapper = cueRow.locator(
    '[data-col-id]:not([data-col-id="title"]):not([data-col-id="__private-notes__"]):not([data-col-id="start"]):not([data-col-id="dur"])'
  )
  // NOTE: re-entering edit mode a *second* time on the same RichTextCell
  // instance without an intervening page reload is a pre-existing bug
  // (reproduces on main, unrelated to #65 — confirmed by stashing this
  // branch's changes and re-running the same repro). Reloading before each
  // edit after the first sidesteps it cleanly since state is persisted.
  let editedOnce = false
  async function setStatusCellText(text) {
    if (editedOnce) {
      await page.reload({ waitUntil: 'networkidle' })
      await page.locator('[data-cue-id]').first().waitFor({ state: 'visible', timeout: 10000 })
    }
    editedOnce = true
    console.log('   [debug] pre-click tiptap-cell count:', await statusWrapper.locator('.tiptap-cell').count())
    await statusWrapper.locator('.tiptap-cell').first().click()
    console.log('   [debug] post-click contenteditable count:', await statusWrapper.locator('[contenteditable]').count())
    const editor = statusWrapper.locator('.tiptap-cell[contenteditable="true"]').first()
    await editor.waitFor({ state: 'visible', timeout: 5000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await editor.pressSequentially(text, { delay: 15 })
    await page.mouse.click(700, 10)
    await page.waitForTimeout(500)
  }

  log('Setting Status cell content')
  await setStatusCellText('URGENT update')
  ok('Status cell set to "URGENT update"')

  // Create the rule.
  log('Creating rule: Status contains URGENT -> red background + badge')
  await openRules()
  await page.locator('[data-testid="add-rule-btn"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="rule-name-input"]').fill('Flag urgent')
  await page.locator('[data-testid="condition-target-select"]').selectOption({ label: 'Status' })
  await page.locator('[data-testid="condition-operator-select"]').selectOption('contains')
  await page.locator('[data-testid="condition-value-input"]').fill('URGENT')
  await page.locator('[data-testid="rule-action-bg-toggle"]').click()
  await page.waitForTimeout(150)
  await page.locator('[data-testid="rule-bg-swatch-#7f1d1d"]').click()
  await page.locator('[data-testid="rule-action-badge-toggle"]').click()
  await page.waitForTimeout(150)
  await page.locator('[data-testid^="rule-badge-icon-"]').first().click()
  await page.locator('[data-testid="save-rule-btn"]').click()
  await page.waitForTimeout(500)
  assert(await page.locator('[data-testid="rule-row"]').first().isVisible(), 'Rule appears in the list')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // Reactive evaluation: the row should now be colored + badged.
  log('Checking the rule applied to the matching row')
  await page.waitForTimeout(600) // debounce
  const rowBg = await cueRow.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(rowBg === 'rgb(127, 29, 29)', `Row background is rule red (got ${rowBg})`)
  assert(await cueRow.locator('[data-testid="rule-badges"]').isVisible(), 'Badge renders on the matching row')

  // Reactivity: editing the cell to no longer match should clear both.
  log('Checking reactive re-evaluation when the cell no longer matches')
  await setStatusCellText('all clear')
  await page.waitForTimeout(400) // debounce
  const rowBgAfter = await cueRow.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(rowBgAfter !== 'rgb(127, 29, 29)', 'Row background cleared once the cell no longer matches')
  assert(!(await cueRow.locator('[data-testid="rule-badges"]').isVisible().catch(() => false)), 'Badge cleared once the cell no longer matches')

  // Put it back to matching for the remaining checks.
  await setStatusCellText('URGENT again')
  await page.waitForTimeout(400)
  assert(await cueRow.locator('[data-testid="rule-badges"]').isVisible(), 'Badge re-applies once matching again')

  // Manual color precedence: manually color the row, rule (no override) must not win.
  log('Checking manual color takes precedence over a non-overriding rule')
  await cueRow.locator('[data-testid="cue-settings-btn"]').click()
  await page.waitForTimeout(200)
  await page.locator('button[style*="background: rgb(30, 58, 138)"]').first().click() // blue swatch
  await page.waitForTimeout(700)
  const manualBg = await cueRow.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(manualBg === 'rgb(30, 58, 138)', 'Manual blue color wins over the (non-overriding) rule')

  // Enable "override manual color" on the rule -> rule red should now win.
  log('Checking the override-manual-color toggle lets the rule win')
  await openRules()
  await page.locator('[data-testid="edit-rule-btn"]').first().click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="rule-override-manual"]').check()
  await page.locator('[data-testid="save-rule-btn"]').click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  const overriddenBg = await cueRow.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(overriddenBg === 'rgb(127, 29, 29)', 'Rule color overrides the manual color once "override" is enabled')

  // Disabling the rule clears the visual effect entirely.
  log('Checking the rule active/inactive toggle')
  await openRules()
  await page.locator('[data-testid="rule-active-toggle"]').click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  const disabledBg = await cueRow.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(disabledBg === 'rgb(30, 58, 138)', 'Disabling the rule reverts to the manual color')
  assert(!(await cueRow.locator('[data-testid="rule-badges"]').isVisible().catch(() => false)), 'Badge disappears once the rule is disabled')

  // Re-enable for the collaborator check below.
  await openRules()
  await page.locator('[data-testid="rule-active-toggle"]').click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)

  // Collaborator: sees the visual result, but the Rules menu item is gone.
  log('Checking collaborator visibility (read-only)')
  await page.locator('[data-testid="rundown-menu"]').click()
  await page.locator('[data-testid="share-menu-item"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="new-collab-link-btn"]').click()
  await page.waitForTimeout(150)
  await page.locator('[data-testid="collab-link-label"]').fill('Viewer')
  await page.locator('[data-testid="create-collab-link"]').click()
  await page.waitForTimeout(700)
  const collabUrl = (await page.locator('[data-testid="collab-link-url"]').first().textContent())?.trim()
  assert(!!collabUrl, `Collab link created (${collabUrl})`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  const guestCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  guest = await guestCtx.newPage()
  guest.on('pageerror', (e) => console.log('  [guest pageerror]', e.message))
  await guest.goto(collabUrl, { waitUntil: 'networkidle' })
  await guest.waitForTimeout(800)

  const guestRow = guest.locator('[data-cue-id]').first()
  const guestBg = await guestRow.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(guestBg === 'rgb(127, 29, 29)', `Collaborator sees the rule-driven color (got ${guestBg})`)
  assert(await guestRow.locator('[data-testid="rule-badges"]').isVisible(), 'Collaborator sees the badge')

  await guest.locator('[data-testid="rundown-menu"]').click()
  await guest.waitForTimeout(200)
  assert(
    (await guest.locator('[data-testid="open-rules-menu-item"]').count()) === 0,
    'Collaborator does NOT see the Rules menu item (owner-only editing)'
  )

  await guestCtx.close()
  console.log('\n✅ ALL TODO#65 CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ FAILED:', err.message)
  await page.screenshot({ path: 'tests/todo65-failure-owner.png' }).catch(() => {})
  if (guest) await guest.screenshot({ path: 'tests/todo65-failure-guest.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
