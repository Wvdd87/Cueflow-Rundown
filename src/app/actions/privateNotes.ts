'use server'

import { createClient } from '@/lib/supabase/server'

/** Upsert the signed-in user's private note for a cue (visible only to them). */
export async function upsertPrivateNote(
  cueId: string,
  _rundownId: string,
  content: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('private_notes')
    .upsert(
      { cue_id: cueId, user_id: user.id, content } as never,
      { onConflict: 'cue_id,user_id' }
    )

  if (error) return { error: error.message }
  return { success: true }
}
