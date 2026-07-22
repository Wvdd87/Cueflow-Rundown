'use server'

import { createClient } from '@/lib/supabase/server'
import type { CollaborationLink } from '@/lib/supabase/types'

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return supabase
}

export interface CollabLinkPermissions {
  editableColumns: string[]
  canAddDeleteCues: boolean
  canAddDeleteColumns: boolean
  canRunShow: boolean
}

/** All collaboration links for a rundown, newest last. */
export async function listCollabLinks(rundownId: string) {
  const supabase = await requireAuth()
  const { data, error } = await supabase
    .from('collaboration_links')
    .select('*')
    .eq('rundown_id', rundownId)
    .order('created_at', { ascending: true })
  if (error) return { error: error.message, links: [] as CollaborationLink[] }
  return { links: (data ?? []) as CollaborationLink[] }
}

/** Create a new collaboration link with a label + permission set. */
export async function createCollabLink(
  rundownId: string,
  label: string,
  permissions: CollabLinkPermissions
) {
  const supabase = await requireAuth()
  const token = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await supabase
    .from('collaboration_links')
    .insert({
      id: token,
      rundown_id: rundownId,
      label: label.trim() || 'Untitled link',
      editable_columns: permissions.editableColumns,
      can_add_delete_cues: permissions.canAddDeleteCues,
      can_add_delete_columns: permissions.canAddDeleteColumns,
      can_run_show: permissions.canRunShow,
    } as never)
    .select('*')
    .single()
  if (error) return { error: error.message }
  return { link: data as CollaborationLink }
}

export async function updateCollabLink(
  id: string,
  updates: Partial<{ label: string } & CollabLinkPermissions>
) {
  const supabase = await requireAuth()
  const patch: Record<string, unknown> = {}
  if (updates.label !== undefined) patch.label = updates.label.trim() || 'Untitled link'
  if (updates.editableColumns !== undefined) patch.editable_columns = updates.editableColumns
  if (updates.canAddDeleteCues !== undefined) patch.can_add_delete_cues = updates.canAddDeleteCues
  if (updates.canAddDeleteColumns !== undefined) patch.can_add_delete_columns = updates.canAddDeleteColumns
  if (updates.canRunShow !== undefined) patch.can_run_show = updates.canRunShow
  const { error } = await supabase.from('collaboration_links').update(patch as never).eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

/** Toggle access without deleting the link record. */
export async function setCollabLinkActive(id: string, active: boolean) {
  const supabase = await requireAuth()
  const { error } = await supabase
    .from('collaboration_links')
    .update({ active } as never)
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteCollabLink(id: string) {
  const supabase = await requireAuth()
  const { error } = await supabase.from('collaboration_links').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
