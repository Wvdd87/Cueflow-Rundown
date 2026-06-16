'use server'

import { createClient } from '@/lib/supabase/server'

export async function upsertSharePrivateNote(
  token: string,
  cueId: string,
  content: string
) {
  const supabase = await createClient()
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: unknown }>)(
    'upsert_share_private_note',
    { p_token: token, p_cue_id: cueId, p_content: content }
  )
  if (error) return { error: String(error) }
  return { success: true }
}
