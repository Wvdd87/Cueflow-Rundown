'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getTeamId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  const profile = data as { team_id: string | null } | null
  if (!profile?.team_id) throw new Error('No team found')
  return { supabase, teamId: profile.team_id, userId: user.id }
}

export async function createEvent(formData: FormData) {
  const { supabase, teamId, userId } = await getTeamId()

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const { error } = await supabase
    .from('events')
    .insert({ name, team_id: teamId, created_by: userId } as never)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function renameEvent(id: string, name: string) {
  const { supabase } = await getTeamId()

  const { error } = await supabase
    .from('events')
    .update({ name: name.trim() } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEvent(id: string) {
  const { supabase } = await getTeamId()

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
