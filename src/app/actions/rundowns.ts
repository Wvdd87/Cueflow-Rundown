'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Rundown, Column, Cue } from '@/lib/supabase/types'

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

/** Deep-copy a rundown's columns, cues (incl. groups) and cells into another. */
async function copyRundownContents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  sourceId: string,
  targetId: string
) {
  // Columns
  const { data: colData } = await supabase
    .from('columns')
    .select('*')
    .eq('rundown_id', sourceId)
    .order('position', { ascending: true })
  const colMap = new Map<string, string>()
  for (const c of (colData ?? []) as Column[]) {
    const { data: nc } = await supabase
      .from('columns')
      .insert({
        rundown_id: targetId,
        name: c.name,
        col_type: c.col_type,
        position: c.position,
        width: c.width,
        options: c.options,
        option_colors: c.option_colors,
      } as never)
      .select('id')
      .single()
    if (nc) colMap.set(c.id, (nc as { id: string }).id)
  }

  // Cues (group_id remapped in a second pass)
  const { data: cueData } = await supabase
    .from('cues')
    .select('*')
    .eq('rundown_id', sourceId)
    .order('position', { ascending: true })
  const srcCues = (cueData ?? []) as Cue[]
  const cueMap = new Map<string, string>()
  for (const cu of srcCues) {
    const { data: ncu } = await supabase
      .from('cues')
      .insert({
        rundown_id: targetId,
        position: cu.position,
        cue_number: cu.cue_number,
        cue_type: cu.cue_type,
        title: cu.title,
        subtitle: cu.subtitle,
        start_type: cu.start_type,
        start_time_override: cu.start_time_override,
        auto_start: cu.auto_start,
        duration_ms: cu.duration_ms,
        background_color: cu.background_color,
        locked: cu.locked,
      } as never)
      .select('id')
      .single()
    if (ncu) cueMap.set(cu.id, (ncu as { id: string }).id)
  }
  for (const cu of srcCues) {
    if (cu.group_id && cueMap.has(cu.group_id) && cueMap.has(cu.id)) {
      await supabase
        .from('cues')
        .update({ group_id: cueMap.get(cu.group_id) } as never)
        .eq('id', cueMap.get(cu.id))
    }
  }

  // Cells
  if (cueMap.size > 0 && colMap.size > 0) {
    const { data: cellData } = await supabase
      .from('cells')
      .select('cue_id, column_id, content')
      .in('cue_id', srcCues.map((c) => c.id))
    const inserts = ((cellData ?? []) as {
      cue_id: string
      column_id: string
      content: string | null
    }[])
      .filter((ce) => cueMap.has(ce.cue_id) && colMap.has(ce.column_id))
      .map((ce) => ({
        cue_id: cueMap.get(ce.cue_id),
        column_id: colMap.get(ce.column_id),
        content: ce.content,
      }))
    if (inserts.length > 0) {
      await supabase.from('cells').insert(inserts as never)
    }
  }
}

export async function createRundown(formData: FormData) {
  const { supabase, teamId, userId } = await getTeamId()

  const name = (formData.get('name') as string)?.trim()
  const eventId = formData.get('event_id') as string | null
  const isTemplate = formData.get('is_template') === 'true'
  const templateId = (formData.get('template_id') as string | null) || null

  if (!name) return { error: 'Name is required' }

  const { data, error } = await supabase
    .from('rundowns')
    .insert({
      name,
      team_id: teamId,
      event_id: eventId || null,
      created_by: userId,
      is_template: isTemplate,
    } as never)
    .select('id')
    .single()

  if (error) return { error: error.message }

  const row = data as { id: string } | null

  // Seed from a chosen template (deep copy of its columns/cues/cells)
  if (templateId && row?.id) {
    await copyRundownContents(supabase, templateId, row.id)
  }

  revalidatePath('/dashboard')

  if (!isTemplate && row?.id) {
    redirect(`/rundown/${row.id}`)
  }

  return { success: true }
}

/** Save an existing rundown as a reusable template (deep copy). */
export async function saveAsTemplate(id: string) {
  const { supabase, teamId, userId } = await getTeamId()

  const { data: src } = await supabase
    .from('rundowns')
    .select('*')
    .eq('id', id)
    .single()
  if (!src) return { error: 'Rundown not found' }
  const source = src as Rundown

  const { data: nr, error } = await supabase
    .from('rundowns')
    .insert({
      name: `${source.name} (template)`,
      team_id: teamId,
      created_by: userId,
      is_template: true,
      timezone: source.timezone,
    } as never)
    .select('id')
    .single()
  if (error) return { error: error.message }

  await copyRundownContents(supabase, id, (nr as { id: string }).id)
  revalidatePath('/dashboard')
  return { success: true }
}

/** Create a working rundown from a template and open it. */
export async function createFromTemplate(templateId: string) {
  const { supabase, teamId, userId } = await getTeamId()

  const { data: src } = await supabase
    .from('rundowns')
    .select('*')
    .eq('id', templateId)
    .single()
  if (!src) return { error: 'Template not found' }
  const source = src as Rundown
  const name = source.name.replace(/\s*\(template\)\s*$/i, '') || 'New rundown'

  const { data: nr, error } = await supabase
    .from('rundowns')
    .insert({
      name,
      team_id: teamId,
      created_by: userId,
      is_template: false,
      timezone: source.timezone,
    } as never)
    .select('id')
    .single()
  if (error) return { error: error.message }

  const newId = (nr as { id: string }).id
  await copyRundownContents(supabase, templateId, newId)
  revalidatePath('/dashboard')
  redirect(`/rundown/${newId}`)
}

export async function moveRundown(id: string, eventId: string | null) {
  const { supabase, teamId } = await getTeamId()

  const { error } = await supabase
    .from('rundowns')
    .update({ event_id: eventId } as never)
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateRundownSettings(
  id: string,
  settings: {
    time_display?: 'auto' | '24h' | '12h' | '12h_no_ampm'
    cue_number_prefix?: string
    cue_number_start?: number
    cue_number_digits?: number
  }
) {
  const { supabase, teamId } = await getTeamId()

  const { error } = await supabase
    .from('rundowns')
    .update(settings as never)
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) return { error: error.message }

  revalidatePath(`/rundown/${id}`)
  return { success: true }
}

export async function renameRundown(id: string, name: string) {
  const { supabase } = await getTeamId()

  const { error } = await supabase
    .from('rundowns')
    .update({ name: name.trim() } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateRundownStatus(
  id: string,
  status: 'draft' | 'awaiting_data' | 'approved' | 'finalized' | 'rejected'
) {
  const { supabase } = await getTeamId()

  const { error } = await supabase
    .from('rundowns')
    .update({ status } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/rundown/${id}`)
  return { success: true }
}

/** Soft-delete: moves the rundown to Trash (recoverable). */
export async function deleteRundown(id: string) {
  const { supabase } = await getTeamId()

  const { error } = await supabase
    .from('rundowns')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/trash')
  return { success: true }
}

export async function restoreRundown(id: string) {
  const { supabase } = await getTeamId()

  const { error } = await supabase
    .from('rundowns')
    .update({ deleted_at: null } as never)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/trash')
  return { success: true }
}

/** Permanently delete a rundown (and its cues/columns/cells via cascade). */
export async function purgeRundown(id: string) {
  const { supabase } = await getTeamId()

  const { error } = await supabase.from('rundowns').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/trash')
  return { success: true }
}

export async function duplicateRundown(id: string) {
  const { supabase, teamId, userId } = await getTeamId()

  const { data, error: fetchError } = await supabase
    .from('rundowns')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !data) return { error: 'Rundown not found' }
  const source = data as Rundown

  const { data: nr, error } = await supabase
    .from('rundowns')
    .insert({
      name: `${source.name} (copy)`,
      team_id: teamId,
      event_id: source.event_id,
      created_by: userId,
      is_template: source.is_template,
      timezone: source.timezone,
    } as never)
    .select('id')
    .single()

  if (error) return { error: error.message }

  await copyRundownContents(supabase, id, (nr as { id: string }).id)
  revalidatePath('/dashboard')
  return { success: true }
}
