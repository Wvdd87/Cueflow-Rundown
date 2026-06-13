'use server'

import { createClient } from '@/lib/supabase/server'
import type { RundownShare } from '@/lib/supabase/types'

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return supabase
}

/** All read-only share links for a rundown. */
export async function listShares(rundownId: string) {
  const supabase = await requireAuth()
  const { data, error } = await supabase
    .from('rundown_shares')
    .select('*')
    .eq('rundown_id', rundownId)
    .eq('mode', 'view')
    .order('created_at', { ascending: true })
  if (error) return { error: error.message, shares: [] as RundownShare[] }
  return { shares: (data ?? []) as RundownShare[] }
}

/** Create a new read-only link with a label + visible columns (null = all). */
export async function createShare(
  rundownId: string,
  label: string,
  visibleColumns: string[] | null
) {
  const supabase = await requireAuth()
  const token = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await supabase
    .from('rundown_shares')
    .insert({
      rundown_id: rundownId,
      token,
      mode: 'view',
      label: label.trim() || null,
      visible_columns: visibleColumns,
    } as never)
    .select('*')
    .single()
  if (error) return { error: error.message }
  return { share: data as RundownShare }
}

export async function updateShare(
  id: string,
  updates: { label?: string | null; visibleColumns?: string[] | null }
) {
  const supabase = await requireAuth()
  const patch: Record<string, unknown> = {}
  if (updates.label !== undefined) patch.label = updates.label?.trim() || null
  if (updates.visibleColumns !== undefined)
    patch.visible_columns = updates.visibleColumns
  const { error } = await supabase
    .from('rundown_shares')
    .update(patch as never)
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function revokeShare(id: string) {
  const supabase = await requireAuth()
  const { error } = await supabase.from('rundown_shares').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
