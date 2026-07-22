'use server'

import { createClient } from '@/lib/supabase/server'
import type { Cue, Cell, Column, CellAttachment, Mention, Variable } from '@/lib/supabase/types'

// rpc isn't in the generated types for these hand-written functions, so each
// call site is cast (keeps `this` bound to the client instance).
type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

/** Writes a cell from a collaboration link — the RPC itself checks the link
 *  is active and that the column is in its editable set. */
export async function collabUpsertCell(
  token: string,
  cueId: string,
  columnId: string,
  content: string,
  attachments?: CellAttachment[]
) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_upsert_cell', {
    p_token: token,
    p_cue_id: cueId,
    p_column_id: columnId,
    p_content: content,
    ...(attachments !== undefined ? { p_attachments: attachments } : {}),
  })
  if (error) return { error: String(error) }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Cues — mirrors src/app/actions/cues.ts, token-gated instead of auth-gated.
// The one real restriction left is editable_columns (collab_upsert_cell).
// ---------------------------------------------------------------------------

export async function collabAddCue(token: string, afterPosition: number, groupId?: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_add_cue', {
    p_token: token,
    p_after_position: afterPosition,
    p_group_id: groupId ?? null,
    p_cue_type: 'cue',
  })
  if (error) return { error: String(error) }
  return { cue: data as Cue }
}

export async function collabAddHeading(token: string, afterPosition: number) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_add_cue', {
    p_token: token,
    p_after_position: afterPosition,
    p_group_id: null,
    p_cue_type: 'heading',
  })
  if (error) return { error: String(error) }
  return { cue: data as Cue }
}

export async function collabUpdateCue(
  token: string,
  cueId: string,
  updates: Partial<Pick<Cue, 'title' | 'subtitle' | 'cue_number' | 'duration_ms' | 'duration_mode' | 'scripts' | 'not_final' | 'start_type' | 'start_time_override' | 'auto_start' | 'background_color' | 'locked' | 'group_id' | 'cue_type'>>
) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_update_cue', {
    p_token: token,
    p_cue_id: cueId,
    p_updates: updates,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

/** Title is a cue-level field, not a column — always editable regardless of
 *  editable_columns. Thin convenience wrapper over collabUpdateCue. */
export async function collabUpdateTitle(token: string, cueId: string, title: string) {
  return collabUpdateCue(token, cueId, { title })
}

export async function collabDeleteCue(token: string, cueId: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_delete_cue', {
    p_token: token,
    p_cue_id: cueId,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabRestoreCue(token: string, cueId: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_restore_cue', {
    p_token: token,
    p_cue_id: cueId,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabDeleteCues(token: string, ids: string[]) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_delete_cues', {
    p_token: token,
    p_ids: ids,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabReorderCues(token: string, orderedIds: string[]) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_reorder_cues', {
    p_token: token,
    p_ordered_ids: orderedIds,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabSetCuesBackground(token: string, ids: string[], color: string | null) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_set_cues_background', {
    p_token: token,
    p_ids: ids,
    p_color: color,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabDuplicateCues(token: string, ids: string[]) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_duplicate_cues', {
    p_token: token,
    p_ids: ids,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabGetRundownCues(token: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_get_rundown_cues', { p_token: token })
  if (error) return { cues: [] as Cue[], cells: [] as Cell[], error: String(error) }
  const d = data as { cues: Cue[]; cells: Cell[] }
  return { cues: d.cues ?? [], cells: d.cells ?? [] }
}

export async function collabGroupCues(token: string, ids: string[]) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_group_cues', {
    p_token: token,
    p_ids: ids,
  })
  if (error) return { error: String(error) }
  return { groupId: data as string }
}

export async function collabUngroupCues(token: string, ids: string[]) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_ungroup_cues', {
    p_token: token,
    p_ids: ids,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Private notes — scoped to this one collaboration link, not shared with the
// owner or any other link (reuses the share_private_notes table).
// ---------------------------------------------------------------------------

export async function collabGetPrivateNotes(token: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('get_collab_private_notes', { p_token: token })
  if (error) return { notes: {} as Record<string, string>, error: String(error) }
  const arr = (data as { cue_id: string; content: string }[] | null) ?? []
  return { notes: Object.fromEntries(arr.map((n) => [n.cue_id, n.content])) }
}

export async function collabUpsertPrivateNote(token: string, cueId: string, content: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('upsert_collab_private_note', {
    p_token: token,
    p_cue_id: cueId,
    p_content: content,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Columns — mirrors src/app/actions/columns.ts.
// ---------------------------------------------------------------------------

export async function collabAddColumn(
  token: string,
  name: string,
  colType: 'richtext' | 'dropdown' = 'richtext',
  options: string[] | null = null,
  optionColors: Record<string, string> | null = null
) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_add_column', {
    p_token: token,
    p_name: name,
    p_col_type: colType,
    p_options: options,
    p_option_colors: optionColors,
  })
  if (error) return { error: String(error) }
  return { column: data as Column }
}

export async function collabRenameColumn(token: string, id: string, name: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_rename_column', {
    p_token: token,
    p_id: id,
    p_name: name,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabDeleteColumn(token: string, id: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_delete_column', { p_token: token, p_id: id })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabUpdateColumnOptions(
  token: string,
  id: string,
  options: string[],
  optionColors: Record<string, string> | null
) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_update_column_options', {
    p_token: token,
    p_id: id,
    p_options: options,
    p_option_colors: optionColors,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabUpdateColumnWidth(token: string, id: string, width: number) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_update_column_width', {
    p_token: token,
    p_id: id,
    p_width: width,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabReorderColumns(token: string, orderedIds: string[]) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_reorder_columns', {
    p_token: token,
    p_ordered_ids: orderedIds,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Mentions & variables
// ---------------------------------------------------------------------------

export async function collabAddMention(token: string, name: string, description: string | null = null) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_add_mention', {
    p_token: token,
    p_name: name,
    p_description: description,
  })
  if (error) return { error: String(error) }
  return { mention: data as Mention }
}

export async function collabUpdateMention(
  token: string,
  id: string,
  updates: { name?: string; description?: string | null }
) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_update_mention', {
    p_token: token,
    p_id: id,
    p_name: updates.name ?? null,
    p_description: updates.description ?? null,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabDeleteMention(token: string, id: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_delete_mention', { p_token: token, p_id: id })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabAddVariable(token: string, key: string, value: string = '') {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_add_variable', {
    p_token: token,
    p_key: key,
    p_value: value,
  })
  if (error) return { error: String(error) }
  return { variable: data as Variable }
}

export async function collabUpdateVariable(
  token: string,
  id: string,
  updates: { key?: string; value?: string }
) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_update_variable', {
    p_token: token,
    p_id: id,
    p_key: updates.key ?? null,
    p_value: updates.value ?? null,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

export async function collabDeleteVariable(token: string, id: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_delete_variable', { p_token: token, p_id: id })
  if (error) return { error: String(error) }
  return { success: true }
}

/** Take show control — the RPC checks can_run_show. */
export async function collabTakeControl(token: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_take_control', { p_token: token })
  if (error) return { error: String(error) }
  return { success: true }
}
