// Todo #65 — conditional rules: text-column condition -> background color +
// badge action, reactive re-evaluation on a cell edit, manual-color
// precedence (and the override toggle), rule active/inactive toggling, and
// collaborator read-only visibility (no Rules menu item, but sees the
// visual result). Requires supabase/schema_phase25.sql to have been run.
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

// RulesPanel's own Dialog auto-reopens the moment the nested RuleBuilderModal
// closes (its `open` prop is `open && !builderOpen`) — a single Escape can
// land on the builder layer and leave the list dialog's backdrop stuck
// intercepting clicks. Press Escape repeatedly until the rundown menu is
// actually clickable again.
async function closeAnyDialogs() {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const clickable = await page.locator('[data-testid="rundown-menu"]').click({ trial: true, timeout: 500 }).then(() => true).catch(() => false)
    if (clickable) return
  }
}

// Scope to the Status column's wrapper only — excludes "title",
// "__private-notes__", "start" and "dur", all of which also carry
// ".tiptap-cell"-classed editors.
function statusWrapperFor(row) {
  return row.locator(
    '[data-col-id]:not([data-col-id="title"]):not([data-col-id="__private-notes__"]):not([data-col-id="start"]):not([data-col-id="dur"])'
  )
}

// Sets a Status cell's text. NOTE: only ever called once per cue — clicking
// a RichTextCell a *second* time to re-enter edit mode is a pre-existing bug
// (reproduces on main with zero rules involved, confirmed by stashing this
// branch's changes and re-running the same repro), so this test drives
// reactivity via a second, never-before-edited cue rather than re-editing
// the same cell.
async function setStatusCellText(row, text) {
  const wrapper = statusWrapperFor(row)
  await wrapper.locator('.tiptap-cell').first().click()
  const editor = wrapper.locator('.tiptap-cell[contenteditable="true"]').first()
  await editor.waitFor({ state: 'visible', timeout: 5000 })
  await editor.click()
  await editor.pressSequentially(text, { delay: 15 })
  await page.mouse.click(700, 10)
  await page.waitForTimeout(500)
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
  await page.getByTestId('save-indicator').getByText(/saved/i).waitFor({ timeout: 10000 }).catch(() => null)
  await page.waitForTimeout(300)
  await page.locator('[data-testid="add-cue-btn"]').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-cue-id]').length >= 2, null, { timeout: 10000 })
  await page.keyboard.press('Escape')
  await addColumn('Status')
  assert((await page.locator('[data-cue-id]').count()) === 2, '2 cues + Status column ready')

  const cue1 = page.locator('[data-cue-id]').nth(0)
  const cue2 = page.locator('[data-cue-id]').nth(1)

  log('Setting cue 1\'s Status cell to "URGENT update"')
  await setStatusCellText(cue1, 'URGENT update')
  ok('Cue 1 Status set')

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
  await closeAnyDialogs()
  await page.waitForTimeout(200)

  // Reactive evaluation: cue 1 (matching) gets colored + badged, cue 2
  // (empty Status, no match yet) does not.
  log('Checking the rule applied only to the matching row')
  await page.waitForTimeout(600) // debounce
  const rowBg = await cue1.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(rowBg === 'rgb(127, 29, 29)', `Cue 1 background is rule red (got ${rowBg})`)
  assert(await cue1.locator('[data-testid="rule-badges"]').isVisible(), 'Cue 1 shows the badge')
  const cue2BgBefore = await cue2.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(cue2BgBefore !== 'rgb(127, 29, 29)', 'Cue 2 (no match yet) is not colored')
  assert(!(await cue2.locator('[data-testid="rule-badges"]').isVisible().catch(() => false)), 'Cue 2 (no match yet) has no badge')

  // Reactivity: editing cue 2's (fresh, never-before-edited) Status cell to
  // match should pick it up live, proving rules react to new edits.
  log('Checking reactive re-evaluation when a different cell starts matching')
  await setStatusCellText(cue2, 'URGENT too')
  await page.waitForTimeout(600) // debounce
  const cue2BgAfter = await cue2.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(cue2BgAfter === 'rgb(127, 29, 29)', 'Cue 2 picks up the rule color once it matches')
  assert(await cue2.locator('[data-testid="rule-badges"]').isVisible(), 'Cue 2 shows the badge once it matches')

  // Manual color precedence: manually color cue 1, rule (no override) must not win.
  log('Checking manual color takes precedence over a non-overriding rule')
  await cue1.locator('[data-testid="cue-settings-btn"]').click()
  await page.waitForTimeout(200)
  await page.locator('button[style*="background: rgb(30, 58, 138)"]').first().click() // blue swatch
  // The swatch is a plain button inside the dropdown, not a menu item, so
  // selecting it doesn't auto-close the menu — close it explicitly or its
  // portal/backdrop is still there to intercept the next section's clicks.
  await closeAnyDialogs()
  await page.waitForTimeout(700)
  const manualBg = await cue1.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(manualBg === 'rgb(30, 58, 138)', 'Manual blue color wins over the (non-overriding) rule')

  // Enable "override manual color" on the rule -> rule red should now win.
  log('Checking the override-manual-color toggle lets the rule win')
  await openRules()
  await page.locator('[data-testid="edit-rule-btn"]').first().click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="rule-override-manual"]').check()
  await page.locator('[data-testid="save-rule-btn"]').click()
  await page.waitForTimeout(300)
  await closeAnyDialogs()
  await page.waitForTimeout(700)
  const overriddenBg = await cue1.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(overriddenBg === 'rgb(127, 29, 29)', 'Rule color overrides the manual color once "override" is enabled')

  // Disabling the rule clears the visual effect entirely.
  log('Checking the rule active/inactive toggle')
  await openRules()
  await page.locator('[data-testid="rule-active-toggle"]').click()
  await page.waitForTimeout(300)
  await closeAnyDialogs()
  await page.waitForTimeout(700)
  const disabledBg = await cue1.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(disabledBg === 'rgb(30, 58, 138)', 'Disabling the rule reverts cue 1 to its manual color')
  assert(!(await cue1.locator('[data-testid="rule-badges"]').isVisible().catch(() => false)), 'Badge disappears once the rule is disabled')

  // Re-enable for the collaborator check below.
  await openRules()
  await page.locator('[data-testid="rule-active-toggle"]').click()
  await page.waitForTimeout(300)
  await closeAnyDialogs()
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

  const guestCue2 = guest.locator('[data-cue-id]').nth(1)
  const guestBg = await guestCue2.locator('[data-col-id="title"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  assert(guestBg === 'rgb(127, 29, 29)', `Collaborator sees the rule-driven color (got ${guestBg})`)
  assert(await guestCue2.locator('[data-testid="rule-badges"]').isVisible(), 'Collaborator sees the badge')

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
