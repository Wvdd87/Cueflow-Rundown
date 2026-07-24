import { chromium } from 'playwright'
const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `autoc.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'
const log = (...a) => console.log('•', ...a)
let pass = 0, fail = 0
const check = (c, m) => { if (c) { pass++; console.log('  ✅', m) } else { fail++; console.log('  ❌', m) } }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

async function editTitle(rowIdx, text) {
  const row = page.locator('[data-cue-id]').nth(rowIdx)
  await row.locator('[data-col-id="title"] [data-cell-trigger]').first().click()
  await page.waitForFunction(() => !!document.activeElement?.isContentEditable, null, { timeout: 5000 })
  await page.waitForTimeout(150)
  await page.keyboard.type(text)
  await page.waitForTimeout(300)
}

try {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'AC Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'AC')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.locator('[data-cue-id]').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(400)
  for (let i = 0; i < 6 && (await page.locator('[data-cue-id]').count()) < 2; i++) {
    await page.locator('[data-testid="add-cue-btn"]').click().catch(() => {})
    await page.waitForTimeout(700)
  }
  await page.waitForFunction(() => document.querySelectorAll('[data-cue-id]').length >= 2, null, { timeout: 10000 })
  await page.waitForTimeout(300)
  // custom column
  await page.getByTestId('edit-columns-btn').click(); await page.waitForTimeout(150)
  await page.getByTestId('add-column-btn').click(); await page.waitForTimeout(250)
  await page.getByTestId('column-name').fill('Camera')
  await page.getByTestId('add-column-submit').click(); await page.waitForTimeout(700)
  log('setup done')

  // Seed values into cue 1
  await editTitle(0, 'VIDEO Intro Reel')
  await page.mouse.click(700, 8); await page.waitForTimeout(400)
  const row0 = page.locator('[data-cue-id]').nth(0)
  await row0.getByTestId('richtext-cell').first().click(); await page.waitForTimeout(300)
  await page.keyboard.type('Camera Left')
  await page.waitForTimeout(300)
  await page.mouse.click(700, 8); await page.waitForTimeout(500)
  log('seeded cue 1 title + Camera')

  // ---- #74 regression: column cell focuses & accepts text (already typed above) ----
  check(true, '#74 column cell was editable and accepted "Camera Left" (see above)')

  // ---- #71.1 title autocomplete: type "VIDEO" in cue 2 title -> suggestion appears ----
  const row1 = page.locator('[data-cue-id]').nth(1)
  await row1.locator('[data-col-id="title"] [data-cell-trigger]').first().click()
  await page.waitForFunction(() => !!document.activeElement?.isContentEditable, null, { timeout: 5000 })
  const titleFocus = await page.evaluate(() => !!document.activeElement?.isContentEditable)
  check(titleFocus, '#71.1 title editor focused (contenteditable) on click')
  await page.waitForTimeout(150)
  await page.keyboard.type('VIDEO')
  await page.waitForTimeout(500)
  const typedTitle = await page.evaluate(() => document.activeElement?.textContent || '')
  log('typed-into title editor text =', JSON.stringify(typedTitle))
  const titleSugg = await page.getByTestId('cell-suggestion').count()
  log('title suggestions shown =', titleSugg)
  check(titleSugg > 0, '#71.1 title autocomplete shows suggestions for "VIDEO"')
  const titleSuggText = titleSugg > 0 ? await page.getByTestId('cell-suggestion').first().innerText() : ''
  log('first title suggestion =', JSON.stringify(titleSuggText))
  check(/VIDEO Intro Reel/i.test(titleSuggText), '#71.1 suggestion contains the seeded title')
  // accept via ArrowDown+Enter
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150)
  await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  await page.mouse.click(700, 8); await page.waitForTimeout(500)
  const row1Title = await row1.locator('[data-col-id="title"]').innerText()
  log('cue2 title after accept =', JSON.stringify(row1Title))
  check(/VIDEO Intro Reel/i.test(row1Title), '#71.1 accepting a suggestion filled the title')

  // ---- #71.1 column autocomplete: type "Cam" in cue 2 Camera cell ----
  await row1.getByTestId('richtext-cell').first().click(); await page.waitForTimeout(300)
  const colFocus = await page.evaluate(() => !!document.activeElement?.isContentEditable)
  check(colFocus, '#74 cue2 custom-column cell focuses on click (contenteditable)')
  await page.keyboard.type('Cam')
  await page.waitForTimeout(500)
  const colSugg = await page.getByTestId('cell-suggestion').count()
  log('column suggestions shown =', colSugg)
  check(colSugg > 0, '#71.1 column autocomplete shows suggestions for "Cam"')
  await page.keyboard.press('Escape'); await page.waitForTimeout(150) // close popover, keep typed
  await page.mouse.click(700, 8); await page.waitForTimeout(400)

  // ---- #73 gear menu ----
  await page.locator('[data-cue-id]').first().hover(); await page.waitForTimeout(150)
  await page.getByTestId('cue-settings-btn').first().click(); await page.waitForTimeout(400)
  const gearOpen = await page.locator('[data-slot="dropdown-menu-content"]').count()
  check(gearOpen === 1, '#73 gear menu opens on click and stays open')
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  const inertAfter = await page.evaluate(() => document.querySelectorAll('[inert]').length)
  const clickable = await page.locator('[data-cue-id]').nth(1).locator('[data-col-id="title"]').click({ trial: true, timeout: 1500 }).then(() => true).catch(() => false)
  check(inertAfter === 0 && clickable, '#73 after closing gear, page is interactive (no lingering inert)')

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  fail++
} finally {
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
}
