// Todo #64 (Phase 1) — Collaboration links: data model, admin management UI,
// and a permission-gated collaborator view (editable columns, locked columns,
// add/delete-cue gating, revoke messaging, unknown-token 404).
// Requires supabase/schema_phase20.sql to have been run.
// Run with:  node tests/todo64-collab-links.spec.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const rand = Math.floor(Math.random() * 1e6)
const EMAIL = `todo64.test.${rand}@gmail.com`
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

async function addColumn(name) {
  await page.getByTestId('edit-columns-btn').click()
  await page.waitForTimeout(200)
  await page.getByTestId('add-column-btn').click()
  await page.waitForTimeout(300)
  await page.getByTestId('column-name').fill(name)
  await page.getByTestId('add-column-submit').click()
  await page.waitForTimeout(700)
}

try {
  log('Signing up', EMAIL)
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.fill('input[name="full_name"]', 'Todo64 Tester')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
  ok('Signed up')

  await page.getByRole('button', { name: /new rundown/i }).first().click()
  await page.waitForTimeout(300)
  await page.fill('input[name="name"]', 'Collab Links Test')
  await page.getByRole('button', { name: /^Create$/i }).click()
  await page.waitForURL('**/rundown/**', { timeout: 15000 })
  ok('Rundown open')

  await page.getByRole('button', { name: /add first cue/i }).click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await addColumn('Camera')
  await addColumn('Notes')
  ok('Cue + 2 columns (Camera, Notes) ready')

  // Create a collaboration link — only "Camera" editable, can add/delete cues.
  log('Creating a collaboration link')
  await page.locator('[data-testid="rundown-menu"]').click()
  await page.locator('[data-testid="share-menu-item"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="new-collab-link-btn"]').click()
  await page.waitForTimeout(150)
  await page.locator('[data-testid="collab-link-label"]').fill('Stage Manager')
  await page.locator('[data-testid="collab-toggle-add-delete-cues"]').click()

  // The "Camera" editable-columns chip's testid embeds the real column id —
  // read it off the DOM so the guest-side lookups below are unambiguous.
  const cameraColBtn = page.getByTestId(/^collab-col-/).filter({ hasText: 'Camera' })
  const cameraColId = (await cameraColBtn.getAttribute('data-testid'))?.replace('collab-col-', '')
  const notesColBtn = page.getByTestId(/^collab-col-/).filter({ hasText: 'Notes' })
  const notesColId = (await notesColBtn.getAttribute('data-testid'))?.replace('collab-col-', '')
  assert(!!cameraColId && !!notesColId, `Resolved column ids (Camera=${cameraColId}, Notes=${notesColId})`)
  await cameraColBtn.click()

  await page.locator('[data-testid="create-collab-link"]').click()
  await page.waitForTimeout(700)
  const collabUrl = (await page.locator('[data-testid="collab-link-url"]').first().textContent())?.trim()
  assert(!!collabUrl && collabUrl.includes('/share/collab/'), `Collab link created (${collabUrl})`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // ── Guest (collaborator) session ──────────────────────────────────────────
  const guestCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const guest = await guestCtx.newPage()
  guest.on('pageerror', (e) => console.log('  [guest pageerror]', e.message))
  await guest.goto(collabUrl, { waitUntil: 'networkidle' })

  log('Checking collaborator view identity + permissions')
  const labelBadge = await guest.locator('[data-testid="collab-label-badge"]').textContent()
  assert(labelBadge?.trim() === 'Stage Manager', `Header shows the link label ("${labelBadge}")`)
  assert(await guest.locator('[data-testid="collab-add-cue"]').isVisible(), '"Add cue" visible (canAddDeleteCues granted)')
  assert(await guest.locator('svg.lucide-lock').first().isVisible(), 'Locked-column icon visible in the header')

  log('Editing the permitted "Camera" column')
  const cameraCell = guest.locator(`[data-col-id="${cameraColId}"]`).first()
  await cameraCell.click()
  const cameraEditor = cameraCell.locator('[contenteditable="true"]')
  await cameraEditor.waitFor({ state: 'visible', timeout: 3000 })
  await guest.keyboard.type('Wide shot, stage left')
  await guest.mouse.click(700, 10) // click outside to save (RichNoteCell saves on outside click)
  await guest.waitForTimeout(600)
  const cameraText = await cameraCell.innerText()
  assert(cameraText.includes('Wide shot, stage left'), `Camera cell saved ("${cameraText}")`)

  log('Confirming the "Notes" column is locked (not editable)')
  const notesCell = guest.locator(`[data-col-id="${notesColId}"]`).first()
  await notesCell.click()
  await guest.waitForTimeout(300)
  const notesEditorCount = await notesCell.locator('[contenteditable="true"]').count()
  assert(notesEditorCount === 0, 'Clicking the locked "Notes" cell does not open an editor')

  log('Reloading to confirm the edit persisted server-side')
  await guest.reload({ waitUntil: 'networkidle' })
  await guest.waitForTimeout(500)
  const reloadedText = await guest.locator(`[data-col-id="${cameraColId}"]`).first().innerText()
  assert(reloadedText.includes('Wide shot, stage left'), `Camera cell persisted after reload ("${reloadedText}")`)

  log('Adding a cue via the collaborator "Add cue" button')
  const cuesBefore = await guest.locator('[data-cue-id]').count()
  await guest.locator('[data-testid="collab-add-cue"]').click()
  await guest.waitForTimeout(800)
  const cuesAfter = await guest.locator('[data-cue-id]').count()
  assert(cuesAfter === cuesBefore + 1, `Cue added (${cuesBefore} -> ${cuesAfter})`)

  log('Deleting a cue via the collaborator delete control')
  await guest.locator('[data-cue-id]').first().hover()
  await guest.locator('[data-testid="collab-delete-cue"]').first().click()
  await guest.waitForTimeout(600)
  const cuesAfterDelete = await guest.locator('[data-cue-id]').count()
  assert(cuesAfterDelete === cuesAfter - 1, `Cue deleted (${cuesAfter} -> ${cuesAfterDelete})`)

  // ── Revoke, and confirm the guest is locked out ─────────────────────────────
  log('Revoking the link from the admin side')
  await page.locator('[data-testid="rundown-menu"]').click()
  await page.locator('[data-testid="share-menu-item"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="toggle-collab-active"]').click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')

  await guest.reload({ waitUntil: 'networkidle' })
  await guest.waitForTimeout(300)
  assert(
    (await guest.getByText('This link has been revoked').count()) > 0,
    'Revoked link shows the revoked message'
  )

  // ── Unknown token 404s ───────────────────────────────────────────────────
  log('Checking an unknown token 404s')
  const notFoundResp = await guest.goto(`${BASE}/share/collab/does-not-exist-token`, { waitUntil: 'networkidle' })
  assert(notFoundResp?.status() === 404, `Unknown token returns 404 (got ${notFoundResp?.status()})`)

  await guestCtx.close()
  console.log('\n✅ ALL TODO#64 (PHASE 1) CHECKS PASSED\n')
} catch (err) {
  console.error('\n❌ FAILED:', err.message)
  await page.screenshot({ path: 'tests/todo64-failure.png' }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
