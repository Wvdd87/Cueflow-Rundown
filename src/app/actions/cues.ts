'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Cue, Cell, CellAttachment } from '@/lib/supabase/types'

async function getRundownAccess(rundownId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, userId: user.id, rundownId }
}

export async function addCue(rundownId: string, afterPosition: number, groupId?: string) {
  const { supabase } = await getRundownAccess(rundownId)

  // Shift positions of cues after insert point
  await supabase.rpc('shift_cue_positions' as never, {
    p_rundown_id: rundownId,
    p_after_position: afterPosition,
  } as never)

  const { data, error } = await supabase
    .from('cues')
    .insert({
      rundown_id: rundownId,
      position: afterPosition + 1,
      cue_number: '',
      title: '',
      duration_ms: 0,
      ...(groupId ? { group_id: groupId } : {}),
    } as never)
    .select('*')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { cue: data as Cue }
}

export async function addHeading(rundownId: string, afterPosition: number) {
  const { supabase } = await getRundownAccess(rundownId)

  await supabase.rpc('shift_cue_positions' as never, {
    p_rundown_id: rundownId,
    p_after_position: afterPosition,
  } as never)

  const { data, error } = await supabase
    .from('cues')
    .insert({
      rundown_id: rundownId,
      position: afterPosition + 1,
      cue_number: '',
      cue_type: 'heading',
      title: '',
      duration_ms: 0,
    } as never)
    .select('*')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { cue: data as Cue }
}

export async function convertHeadingToCue(id: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)
  const { error } = await supabase
    .from('cues')
    .update({ cue_type: 'cue' } as never)
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function convertCueToHeading(id: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('cues')
    .update({
      cue_type: 'heading',
      start_type: 'soft',
      start_time_override: null,
      duration_ms: 0,
      group_id: null,
    } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function updateCue(
  id: string,
  rundownId: string,
  updates: Partial<Pick<Cue, 'title' | 'subtitle' | 'cue_number' | 'duration_ms' | 'duration_mode' | 'scripts' | 'not_final' | 'start_type' | 'start_time_override' | 'auto_start' | 'background_color' | 'locked' | 'group_id'>>
) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('cues')
    .update(updates as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function deleteCue(id: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('cues')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function restoreCue(id: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('cues')
    .update({ deleted_at: null } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function reorderCues(rundownId: string, orderedIds: string[]) {
  const { supabase } = await getRundownAccess(rundownId)

  const updates = orderedIds.map((id, index) => ({
    id,
    position: index,
    rundown_id: rundownId,
  }))

  const { error } = await supabase
    .from('cues')
    .upsert(updates as never, { onConflict: 'id' })

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

/** Refetch all cues + cells for a rundown (used to resync the client after
 *  structural batch operations that create/reposition rows). */
export async function getRundownCues(rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)
  const { data: cuesData } = await supabase
    .from('cues')
    .select('*')
    .eq('rundown_id', rundownId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
  const cues = (cuesData ?? []) as Cue[]
  let cells: Cell[] = []
  if (cues.length > 0) {
    const { data: cellData } = await supabase
      .from('cells')
      .select('*')
      .in(
        'cue_id',
        cues.map((c) => c.id)
      )
    cells = (cellData ?? []) as Cell[]
  }
  return { cues, cells }
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

export async function deleteCues(rundownId: string, ids: string[]) {
  const { supabase } = await getRundownAccess(rundownId)
  const { error } = await supabase
    .from('cues')
    .update({ deleted_at: new Date().toISOString() } as never)
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function getTrashedCues(rundownId: string): Promise<Cue[]> {
  const { supabase } = await getRundownAccess(rundownId)

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // Hard-purge anything older than 30 days
  await supabase.from('cues').delete().eq('rundown_id', rundownId).lt('deleted_at', cutoff)

  const { data } = await supabase
    .from('cues')
    .select('*')
    .eq('rundown_id', rundownId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  return (data ?? []) as Cue[]
}

export async function setCuesBackground(
  rundownId: string,
  ids: string[],
  color: string | null
) {
  const { supabase } = await getRundownAccess(rundownId)
  const { error } = await supabase
    .from('cues')
    .update({ background_color: color } as never)
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

/** Duplicate cues (and their cells); copies appear right after each source. */
export async function duplicateCues(rundownId: string, ids: string[]) {
  const { supabase } = await getRundownAccess(rundownId)

  const { data: srcData } = await supabase
    .from('cues')
    .select('*')
    .in('id', ids)
    .order('position', { ascending: true })
  const srcCues = (srcData ?? []) as Cue[]
  if (srcCues.length === 0) return { error: 'Nothing to duplicate' }

  // Insert duplicates one at a time so source→copy id mapping is reliable
  const idMap = new Map<string, string>()
  for (const c of srcCues) {
    const { data: dup, error } = await supabase
      .from('cues')
      .insert({
        rundown_id: rundownId,
        position: 1_000_000,
        cue_number: '',
        cue_type: c.cue_type,
        group_id: c.group_id,
        title: c.title,
        subtitle: c.subtitle,
        start_type: c.start_type,
        start_time_override: c.start_time_override,
        duration_ms: c.duration_ms,
        duration_mode: c.duration_mode,
        scripts: c.scripts,
        not_final: c.not_final,
        background_color: c.background_color,
        locked: c.locked,
      } as never)
      .select('id')
      .single()
    if (error) return { error: error.message }
    idMap.set(c.id, (dup as { id: string }).id)
  }

  // Copy cells
  const { data: cellData } = await supabase
    .from('cells')
    .select('cue_id, column_id, content, attachments')
    .in('cue_id', ids)
  const cells = (cellData ?? []) as Pick<Cell, 'cue_id' | 'column_id' | 'content' | 'attachments'>[]
  if (cells.length > 0) {
    const cellInserts = cells.map((cell) => ({
      cue_id: idMap.get(cell.cue_id)!,
      column_id: cell.column_id,
      content: cell.content,
      attachments: cell.attachments,
    }))
    await supabase.from('cells').insert(cellInserts as never)
  }

  // Re-thread positions: each copy follows its source
  const { data: allData } = await supabase
    .from('cues')
    .select('id, position')
    .eq('rundown_id', rundownId)
    .order('position', { ascending: true })
  // build order from originals; each copy follows its source (skip temp-positioned copies)
  const copyIds = new Set(idMap.values())
  const order: string[] = []
  for (const c of (allData ?? []) as { id: string }[]) {
    if (copyIds.has(c.id)) continue
    order.push(c.id)
    if (idMap.has(c.id)) order.push(idMap.get(c.id)!)
  }
  await supabase
    .from('cues')
    .upsert(
      order.map((id, i) => ({ id, position: i, rundown_id: rundownId })) as never,
      { onConflict: 'id' }
    )

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

/** Wrap the selected cues in a new "New group" heading. */
export async function groupCues(rundownId: string, ids: string[]) {
  const { supabase } = await getRundownAccess(rundownId)

  const { data: allData } = await supabase
    .from('cues')
    .select('id, position')
    .eq('rundown_id', rundownId)
    .order('position', { ascending: true })
  const all = (allData ?? []) as { id: string }[]
  const selected = new Set(ids)
  const selectedInOrder = all.filter((c) => selected.has(c.id)).map((c) => c.id)
  if (selectedInOrder.length === 0) return { error: 'Nothing to group' }

  const { data: heading, error: hErr } = await supabase
    .from('cues')
    .insert({
      rundown_id: rundownId,
      position: 1_000_000,
      cue_type: 'heading',
      title: 'New group',
      cue_number: '',
      duration_ms: 0,
    } as never)
    .select('id')
    .single()
  if (hErr) return { error: hErr.message }
  const headingId = (heading as { id: string }).id

  await supabase
    .from('cues')
    .update({ group_id: headingId } as never)
    .in('id', ids)

  const firstSelIdx = all.findIndex((c) => selected.has(c.id))
  const order: string[] = []
  all.forEach((c, i) => {
    if (i === firstSelIdx) {
      order.push(headingId, ...selectedInOrder)
    }
    if (!selected.has(c.id)) order.push(c.id)
  })
  await supabase
    .from('cues')
    .upsert(
      order.map((id, i) => ({ id, position: i, rundown_id: rundownId })) as never,
      { onConflict: 'id' }
    )

  revalidatePath(`/rundown/${rundownId}`)
  return { groupId: headingId }
}

/** Ungroup selected members; deleting a selected heading ungroups its children. */
export async function ungroupCues(rundownId: string, ids: string[]) {
  const { supabase } = await getRundownAccess(rundownId)

  const { data: selData } = await supabase
    .from('cues')
    .select('id, cue_type')
    .in('id', ids)
  const sel = (selData ?? []) as { id: string; cue_type: string }[]
  const headingIds = sel.filter((c) => c.cue_type === 'heading').map((c) => c.id)
  const memberIds = sel.filter((c) => c.cue_type !== 'heading').map((c) => c.id)

  if (memberIds.length > 0) {
    const { error } = await supabase
      .from('cues')
      .update({ group_id: null } as never)
      .in('id', memberIds)
    if (error) return { error: error.message }
  }
  if (headingIds.length > 0) {
    // FK on_delete set null ungroups the children automatically
    const { error } = await supabase.from('cues').delete().in('id', headingIds)
    if (error) return { error: error.message }
  }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

/** Remove a single cue from its group (set group_id = null) and apply the new order. */
export async function removeFromGroup(cueId: string, rundownId: string, newOrderIds: string[]) {
  const { supabase } = await getRundownAccess(rundownId)

  await supabase.from('cues').update({ group_id: null } as never).eq('id', cueId)

  const { error } = await supabase
    .from('cues')
    .upsert(
      newOrderIds.map((id, i) => ({ id, position: i, rundown_id: rundownId })) as never,
      { onConflict: 'id' }
    )

  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function upsertCell(
  cueId: string,
  columnId: string,
  content: string,
  rundownId: string,
  attachments?: CellAttachment[]
) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('cells')
    .upsert(
      {
        cue_id: cueId,
        column_id: columnId,
        content,
        ...(attachments !== undefined ? { attachments } : {}),
      } as never,
      { onConflict: 'cue_id,column_id' }
    )

  if (error) return { error: error.message }
  return { success: true }
}
