'use server'

import { createClient } from '@/lib/supabase/server'
import { stripHtml } from '@/lib/utils'
import { parseDropdownCellValues } from '@/lib/dropdownValues'

export interface FieldSuggestionIndex {
  /** Distinct values used per column NAME across the user's OTHER rundowns. */
  byColumnName: Record<string, string[]>
  /** Distinct cue titles across the user's other rundowns. */
  titles: string[]
}

const EMPTY: FieldSuggestionIndex = { byColumnName: {}, titles: [] }
const MAX_PER_FIELD = 250
const MAX_TITLES = 1500

/**
 * Build an autocomplete index from the user's *other* rundowns (the current one
 * is excluded — its values are computed live on the client). Values are keyed by
 * column name so a column matches across rundowns. Owner-only: collaboration
 * links have no auth user and get an empty index (current-rundown suggestions
 * still work client-side). Fetched once per session and cached. (#71.1)
 */
export async function getFieldSuggestionIndex(currentRundownId: string): Promise<FieldSuggestionIndex> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPTY

  const { data: profileData } = await supabase.from('profiles').select('team_id').eq('id', user.id).single()
  const teamId = (profileData as { team_id: string | null } | null)?.team_id
  if (!teamId) return EMPTY

  const { data: rundownData } = await supabase
    .from('rundowns')
    .select('id')
    .eq('team_id', teamId)
    .is('deleted_at', null)
  const rundownIds = ((rundownData ?? []) as { id: string }[]).map((r) => r.id).filter((id) => id !== currentRundownId)
  if (rundownIds.length === 0) return EMPTY

  const { data: colData } = await supabase
    .from('columns')
    .select('id, name, col_type')
    .in('rundown_id', rundownIds)
    .is('deleted_at', null)
  const colMeta = new Map<string, { name: string; type: string }>()
  for (const c of (colData ?? []) as { id: string; name: string; col_type: string }[]) {
    colMeta.set(c.id, { name: c.name, type: c.col_type })
  }

  const byColumnName: Record<string, string[]> = {}
  const colIds = [...colMeta.keys()]
  if (colIds.length > 0) {
    const { data: cellData } = await supabase.from('cells').select('column_id, content').in('column_id', colIds)
    for (const cell of (cellData ?? []) as { column_id: string; content: string | null }[]) {
      const meta = colMeta.get(cell.column_id)
      if (!meta) continue
      const raw = cell.content ?? ''
      const values = meta.type === 'dropdown' ? parseDropdownCellValues(raw) : [stripHtml(raw)]
      for (const v of values) {
        const val = v.trim()
        if (!val) continue
        const arr = (byColumnName[meta.name] ??= [])
        if (arr.length < MAX_PER_FIELD && !arr.includes(val)) arr.push(val)
      }
    }
  }

  const titleSet = new Set<string>()
  const { data: cueData } = await supabase
    .from('cues')
    .select('title')
    .in('rundown_id', rundownIds)
    .eq('cue_type', 'cue')
    .is('deleted_at', null)
  for (const cu of (cueData ?? []) as { title: string | null }[]) {
    const t = stripHtml(cu.title ?? '').trim()
    if (t && titleSet.size < MAX_TITLES) titleSet.add(t)
  }

  return { byColumnName, titles: [...titleSet] }
}
