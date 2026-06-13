'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Mention } from '@/lib/supabase/types'

async function requireUser(rundownId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, rundownId }
}

export async function addMention(
  rundownId: string,
  name: string,
  description: string | null = null,
  color: string | null = null
) {
  const { supabase } = await requireUser(rundownId)
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }

  const { data, error } = await supabase
    .from('mentions')
    .insert({ rundown_id: rundownId, name: trimmed, description, color } as never)
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { mention: data as Mention }
}

export async function updateMention(
  id: string,
  rundownId: string,
  updates: { name?: string; description?: string | null; color?: string | null }
) {
  const { supabase } = await requireUser(rundownId)

  const { error } = await supabase
    .from('mentions')
    .update(updates as never)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function deleteMention(id: string, rundownId: string) {
  const { supabase } = await requireUser(rundownId)

  const { error } = await supabase.from('mentions').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}
