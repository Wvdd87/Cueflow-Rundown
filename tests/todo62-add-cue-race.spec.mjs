// Todo #62 — Text typed immediately after adding a new cue must not disappear
// once the optimistic (temp-id) row is swapped for the real DB row.
// Run with:  node tests/todo62-add-cue-race.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo62.test.${rand}@gmail.com`
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
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo62 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Add Cue Race Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown open')

  // Throttle the network so the addCue() round-trip takes a while — this widens
  // the race window the original bug depended on ("disappears after ~1-1.5s").
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 1200,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })

  // 1. Click "Add first cue" and type into the title IMMEDIATELY — before the
  // insert has had any chance to resolve.
  log('Adding cue and typing immediately (throttled network)')
  await page.getByRole('button', { name: /add first cue/i }).click()
  const titleEditor = page.locator('.tiptap-cell[contenteditable="true"]').first()
  await titleEditor.waitFor({ state: 'visible', timeout: 5000 })
  await titleEditor.click()
  await page.keyboard.type('Race condition test title', { delay: 20 })

  // 2. Wait well past the reported ~1-1.5s disappearance window, while still
  // editing (not yet blurred) — confirms the row wasn't remounted mid-type.
  await page.waitForTimeout(2500)
  const midEditText = await titleEditor.innerText()
  assert(midEditText.includes('Race condition test title'), `text survived mid-edit (got "${midEditText}")`)

  // 3. Now confirm the edit and verify it persisted.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)
  const savedText = await page.locator('[data-col-id="title"]').first().innerText()
  assert(savedText.includes('Race condition test title'), `title saved after commit (got "${savedText}")`)

  // 4. Reload to confirm it actually made it to the DB (not just local state).
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const reloadedText = await page.locator('[data-col-id="title"]').first().innerText()
  assert(reloadedText.includes('Race condition test title'), `title persisted after reload (got "${reloadedText}")`)

  console.log('\n✅ ALL TODO#62 CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ FAILED:', err.message)
  await page.screenshot({ path: 'tests/todo62-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
