'use server'

import { createClient } from '@/lib/supabase/server'
import type { Cue, CellAttachment } from '@/lib/supabase/types'

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
