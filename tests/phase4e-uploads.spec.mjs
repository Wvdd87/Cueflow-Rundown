// Phase 4e: inline image + file attachment uploads to Supabase storage.
// Requires schema_phase4.sql (cell-attachments bucket). Run:
//   node tests/phase4e-uploads.spec.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `p4e.test.${rand}@gmail.com`
const PASSWORD = 'TestPass123!'

const log = (...a) => console.log('•', ...a)
const ok = (m) => console.log('  ✅', m)
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
  ok(msg)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

try {
  // Setup: signup → rundown → cue → Notes column ----------------------------
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'P4E Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Uploads Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
  await page.waitForTimeout(500)
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill('Notes')
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(700)
  ok('Rundown ready')

  // 1. Upload an image into the cell ----------------------------------------
  log('Uploading an image into the Notes cell')
  await page.getByTestId('richtext-cell').first().click()
  await page.waitForSelector('.ProseMirror', { timeout: 5000 })
  await page.waitForTimeout(300)
  await page
    .locator('input[type="file"][accept="image/*"]')
    .setInputFiles(join(__dirname, 'fixtures', 'pixel.png'))
  // wait for the uploaded <img> to appear in the editor
  await page.waitForSelector('.ProseMirror img', { timeout: 20000 })
  const imgSrc = await page.locator('.ProseMirror img').first().getAttribute('src')
  log('image src:', imgSrc)
  assert(
    !!imgSrc && /cell-attachments/.test(imgSrc),
    'Image uploaded to cell-attachments bucket + inserted'
  )

  // 2. Attach a CSV file -----------------------------------------------------
  log('Attaching a CSV file')
  await page
    .locator('input[type="file"]:not([accept])')
    .setInputFiles(join(__dirname, 'fixtures', 'data.csv'))
  await page.waitForSelector('.ProseMirror a.file-attachment', { timeout: 20000 })
  const attHref = await page
    .locator('.ProseMirror a.file-attachment')
    .first()
    .getAttribute('href')
  const attText = await page
    .locator('.ProseMirror a.file-attachment')
    .first()
    .textContent()
  log('attachment:', attText, attHref)
  assert(
    !!attHref && /cell-attachments/.test(attHref),
    'File attachment uploaded to bucket'
  )
  assert(attText?.includes('data.csv'), 'Attachment chip shows filename')

  // 3. Save + reload → persists ---------------------------------------------
  log('Saving + reloading')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  assert(
    (await page.locator('[data-testid="richtext-cell"] img').count()) >= 1,
    'Image persisted after reload'
  )
  assert(
    (await page.locator('[data-testid="richtext-cell"] a.file-attachment').count()) >= 1,
    'Attachment persisted after reload'
  )

  await page.screenshot({ path: 'tests/phase4e-uploads-result.png' })
  ok('Screenshot saved to tests/phase4e-uploads-result.png')

  console.log('\n🎉 ALL PHASE 4e UPLOAD CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  await page.screenshot({ path: 'tests/phase4e-uploads-failure.png' }).catch(() => {})
  console.error('   Screenshot: tests/phase4e-uploads-failure.png')
  process.exitCode = 1
} finally {
  await browser.close()
}
