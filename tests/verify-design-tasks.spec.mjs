// Verifies the design-task batch: first-cue gap fix, shared-view redesign,
// multi-select dropdown + variable rendering on the share link, modal restyle.
// Run: node tests/verify-design-tasks.spec.mjs   (dev server must be on :3000)
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `verify.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'
const ok = (m) => console.log('  ✅', m)
const warn = (m) => console.log('  ⚠️ ', m)
const log = (...a) => console.log('•', ...a)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

async function clickTitle(text) {
  const btn = page.getByRole('button', { name: 'Untitled cue' }).first()
  await btn.click()
  const input = page.locator('input:focus')
  await input.fill(text)
  await input.press('Enter')
  await page.waitForTimeout(250)
}
async function openRundownMenu() {
  await page.getByTestId('rundown-menu').click()
  await page.waitForTimeout(300)
}
async function openAddColumn() {
  // The "+" became a COLUMNS dropdown (task #22) → Add column lives inside it.
  await page.getByTestId('edit-columns-btn').click()
  await page.waitForTimeout(250)
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
}

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Verify Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 20000 })
  ok('signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Verify Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 20000 })
  await page.waitForTimeout(600)

  await page.getByRole('button', { name: /add first cue/i }).first().click()
  await page.waitForTimeout(700)
  await clickTitle('Alpha')
  await page.getByTestId('add-cue-dropdown-trigger').click()
  await page.waitForTimeout(250)
  await page.getByTestId('add-cue-menu-item').click()
  await page.waitForTimeout(700)
  await clickTitle('Bravo')
  ok('rundown with two cues (Alpha, Bravo)')

  // dropdown column + multi-select on cue 1
  await openAddColumn()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Role')
  await page.getByTestId('coltype-dropdown').click()
  await page.getByTestId('opt-value-0').fill('Host')
  await page.getByTestId('add-option-row').click()
  await page.getByTestId('opt-value-1').fill('Guest')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(900)

  await page.getByTestId('dropdown-cell').first().click()
  await page.getByRole('menuitem', { name: 'Host' }).click()
  await page.waitForTimeout(300)
  await page.getByTestId('dropdown-add').first().click()
  await page.getByRole('menuitem', { name: 'Guest' }).click()
  await page.waitForTimeout(500)
  ok('cue 1 dropdown = [Host, Guest] (multi-select)')

  // richtext column + variable
  await openAddColumn()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Info')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(900)

  let varInserted = false
  openRundownMenu: {
    await openRundownMenu()
    await page.getByRole('menuitem', { name: /variables/i }).first().click()
    await page.waitForTimeout(500)
  }
  if (await page.getByTestId('new-variable-key').count()) {
    await page.getByTestId('new-variable-key').fill('venue')
    await page.getByTestId('new-variable-value').fill('Studio A')
    await page.getByTestId('add-variable-btn').click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'tests/verify-modal-mentions.png' })
    ok('variable $venue=Studio A added (modal captured)')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    const infoCell = page.getByTestId('richtext-cell').first()
    await infoCell.click()
    await page.waitForTimeout(300)
    await page.keyboard.type('$venue')
    await page.waitForTimeout(700)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    varInserted = true
  } else warn('variables modal did not open')

  // first-cue gap fix: make cue 1 a hard start
  await page.getByText('00:00:00').first().click().catch(() => warn('start tile not found'))
  await page.waitForTimeout(250)
  const startInput = page.locator('input:focus')
  if (await startInput.count()) {
    await startInput.fill('09:00:00')
    await startInput.press('Enter')
    await page.waitForTimeout(600)
  }
  const gapCount = await page.getByText(/gap/i).count()
  if (gapCount === 0) ok('first cue (hard start 09:00) shows NO gap indicator')
  else warn(`found ${gapCount} gap element(s) near first cue — check screenshot`)
  await page.screenshot({ path: 'tests/verify-editor.png', fullPage: true })

  // modals: settings + share + trash
  await openRundownMenu()
  await page.getByRole('menuitem', { name: /^settings$/i }).first().click()
  await page.waitForTimeout(400)
  if (await page.getByText(/rundown settings/i).count()) {
    await page.screenshot({ path: 'tests/verify-modal-settings.png' }); ok('settings modal captured')
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  } else warn('settings modal not opened')

  await openRundownMenu()
  await page.getByTestId('share-menu-item').click()
  await page.waitForTimeout(500)
  let shareUrl = null
  if (await page.getByTestId('create-share').count()) {
    await page.getByTestId('create-share').click()
    await page.waitForTimeout(1000)
    shareUrl = await page.getByTestId('share-url').first().innerText().catch(() => null)
    await page.screenshot({ path: 'tests/verify-modal-share.png' }); ok('share modal captured; url=' + shareUrl)
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  } else warn('share modal not opened')

  await openRundownMenu()
  await page.getByTestId('open-trash-menu-item').click()
  await page.waitForTimeout(400)
  if (await page.getByText(/rundown trash/i).count()) {
    await page.screenshot({ path: 'tests/verify-modal-trash.png' }); ok('trash modal captured')
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  } else warn('trash modal not opened')

  // shared view
  if (shareUrl) {
    const sp = await ctx.newPage()
    sp.on('pageerror', (e) => console.log('  [share pageerror]', e.message))
    const url = shareUrl.startsWith('http') ? shareUrl : `${BASE}/${shareUrl.replace(/^\//, '')}`
    await sp.goto(url, { waitUntil: 'networkidle' })
    await sp.waitForTimeout(1500)
    const body = await sp.locator('body').innerText()
    if (body.includes('["') || body.includes('","')) warn('shared view shows raw JSON dropdown!')
    else ok('shared view: dropdown not rendered as raw JSON')
    if (body.includes('Host') && body.includes('Guest')) ok('shared view shows both dropdown values')
    else warn('shared view missing Host/Guest')
    if (varInserted) {
      if (body.includes('Studio A')) ok('shared view: variable resolved to "Studio A"')
      else warn('shared view: variable NOT resolved')
    }
    if (await sp.getByPlaceholder(/search cues/i).count()) ok('shared view has search bar')
    else warn('shared view missing search bar')
    if (await sp.getByText(/read-only/i).count()) ok('shared view shows Read-only badge')
    await sp.screenshot({ path: 'tests/verify-share.png', fullPage: true })
    ok('shared view captured')
  } else warn('no share url — skipping shared view checks')

  console.log('\nDONE — review tests/verify-*.png')
} catch (e) {
  console.log('SCRIPT ERROR:', e.message)
  await page.screenshot({ path: 'tests/verify-error.png', fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}
