'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Column } from '@/lib/supabase/types'

async function getRundownAccess(rundownId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, userId: user.id, rundownId }
}

export async function addColumn(
  rundownId: string,
  name: string,
  afterPosition: number,
  colType: 'richtext' | 'dropdown' = 'richtext',
  options: string[] | null = null,
  optionColors: Record<string, string> | null = null
) {
  const { supabase } = await getRundownAccess(rundownId)

  const { data, error } = await supabase
    .from('columns')
    .insert({
      rundown_id: rundownId,
      name,
      position: afterPosition + 1,
      col_type: colType,
      options: colType === 'dropdown' ? options ?? [] : null,
      option_colors: colType === 'dropdown' ? optionColors : null,
    } as never)
    .select('*')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { column: data as Column }
}

export async function updateColumnWidth(
  id: string,
  width: number,
  rundownId: string
) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('columns')
    .update({ width: Math.round(width) } as never)
    .eq('id', id)

  if (error) return { error: error.message }
  // no revalidate: width is persisted optimistically, avoids a full reload
  return { success: true }
}

export async function updateColumnOptions(
  id: string,
  options: string[],
  rundownId: string,
  optionColors: Record<string, string> | null = null
) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('columns')
    .update({ options, option_colors: optionColors } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function renameColumn(id: string, name: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('columns')
    .update({ name } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function deleteColumn(id: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('columns')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function restoreColumn(id: string, rundownId: string) {
  const { supabase } = await getRundownAccess(rundownId)

  const { error } = await supabase
    .from('columns')
    .update({ deleted_at: null } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}

export async function getTrashedColumns(rundownId: string): Promise<Column[]> {
  const { supabase } = await getRundownAccess(rundownId)

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('columns').delete().eq('rundown_id', rundownId).lt('deleted_at', cutoff)

  const { data } = await supabase
    .from('columns')
    .select('*')
    .eq('rundown_id', rundownId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  return (data ?? []) as Column[]
}

export async function reorderColumns(rundownId: string, orderedIds: string[]) {
  const { supabase } = await getRundownAccess(rundownId)

  const updates = orderedIds.map((id, index) => ({
    id,
    position: index,
    rundown_id: rundownId,
  }))

  const { error } = await supabase
    .from('columns')
    .upsert(updates as never, { onConflict: 'id' })

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${rundownId}`)
  return { success: true }
}
