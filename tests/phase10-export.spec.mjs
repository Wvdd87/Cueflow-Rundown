// Outputs: CSV + server-generated PDF export. No migration needed. Run:
//   node tests/phase10-export.spec.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `exp.test.${rand}@gmail.com`
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
  await page.fill('input[name="full_name"]', 'Exp Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(400)
  await page.fill('input[name="name"]', 'Export Show')
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /add (first )?cue/i }).first().click()
    await page.waitForTimeout(450)
  }
  await setTitle(0, 'Opening')
  await setTitle(1, 'Main segment')
  const id = page.url().match(/rundown\/([^/?]+)/)[1]
  ok('Rundown ready: ' + id)

  // CSV ---------------------------------------------------------------------
  log('GET CSV export')
  const csv = await page.request.get(`${BASE}/rundown/${id}/export/csv`)
  assert(csv.status() === 200, 'CSV route returns 200')
  assert(
    (csv.headers()['content-type'] || '').includes('text/csv'),
    'CSV content-type is text/csv'
  )
  const csvText = await csv.text()
  log('csv first line:', csvText.split('\r\n')[0])
  assert(/"#","Start","Duration","Title"/.test(csvText), 'CSV has the expected header')
  assert(csvText.includes('Opening') && csvText.includes('Main segment'), 'CSV includes cue titles')

  // PDF ---------------------------------------------------------------------
  log('GET PDF export')
  const pdf = await page.request.get(`${BASE}/rundown/${id}/export/pdf`)
  assert(pdf.status() === 200, 'PDF route returns 200')
  assert(
    (pdf.headers()['content-type'] || '').includes('application/pdf'),
    'PDF content-type is application/pdf'
  )
  const buf = await pdf.body()
  assert(buf.length > 800, `PDF has content (${buf.length} bytes)`)
  assert(buf.subarray(0, 4).toString('latin1') === '%PDF', 'PDF starts with %PDF magic bytes')

  console.log('\n🎉 ALL EXPORT (CSV + PDF) CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
