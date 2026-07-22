'use server'

import { createClient } from '@/lib/supabase/server'
import type { Cue, CellAttachment, Mention, Variable } from '@/lib/supabase/types'

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

export async function collabAddCue(token: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase.rpc as unknown as RpcFn)('collab_add_cue', { p_token: token })
  if (error) return { error: String(error) }
  return { cue: data as Cue }
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

/** Title is a cue-level field, not a column — always editable regardless of
 *  editable_columns (see collab_update_title in schema_phase21.sql). */
export async function collabUpdateTitle(token: string, cueId: string, title: string) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as RpcFn)('collab_update_title', {
    p_token: token,
    p_cue_id: cueId,
    p_title: title,
  })
  if (error) return { error: String(error) }
  return { success: true }
}

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
