'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeKey, VARIABLE_KEY_RE as KEY_RE } from '@/lib/variables'
import type { Variable } from '@/lib/supabase/types'

async function requireUser(rundownId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, rundownId }
}

export async function addVariable(
  rundownId: string,
  key: string,
  value: string = ''
) {
  const { supabase } = await requireUser(rundownId)
  const k = normalizeKey(key)
  if (!k || !KEY_RE.test(k)) {
    return { error: 'Key must be lowercase letters, numbers and hyphens' }
  }

  const { data, error } = await supabase
    .from('variables')
    .insert({ rundown_id: rundownId, key: k, value } as never)
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') return { error: `Variable "${k}" already exists` }
    return { error: error.message }
  }
  revalidatePath(`/rundown/${rundownId}`)
  return { variable: data as Variable }
}

export async function updateVariable(
  id: string,
  rundownId: string,
  updates: { key?: string; value?: string }
) {
  const { supabase } = await requireUser(rundownId)

  const patch: { key?: string; value?: string } = {}
  if (updates.value !== undefined) patch.value = updates.value
  if (updates.key !== undefined) {
    const k = normalizeKey(updates.key)
    if (!k || !KEY_RE.test(k)) {
      return { error: 'Key must be lowercase letters, numbers and hyphens' }
    }
    patch.key = k
  }

  const { error } = await supabase
    .from('variables')
    .update(patch as never)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'A variable with that key already exists' }
    return { error: error.message }
  }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function deleteVariable(id: string, rundownId: string) {
  const { supabase } = await requireUser(rundownId)

  const { error } = await supabase.from('variables').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}
