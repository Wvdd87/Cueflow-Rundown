'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getFieldSuggestionIndex, type FieldSuggestionIndex } from '@/app/actions/suggestions'
import { parseDropdownCellValues } from '@/lib/dropdownValues'
import { stripHtml } from '@/lib/utils'
import type { Cue, Column } from '@/lib/supabase/types'

export interface Suggestion {
  value: string
  /** current rundown · other rundowns · a smart (pattern) suggestion. */
  source: 'current' | 'other' | 'smart'
}

const MAX_MATCHES = 8
const MAX_SMART = 3

interface Args {
  rundownId: string
  columns: Column[]
  getCues: () => Cue[]
  getCells: () => Record<string, string>
}

/**
 * Field-value autocomplete + smart title suggestions (#71.1, #71.6). Current-
 * rundown values are computed live; other-rundown values come from a server
 * index fetched once per session. `getSuggestions(field, query)` where field is
 * 'title' | 'subtitle' | a column id.
 */
export function useFieldSuggestions({ rundownId, columns, getCues, getCells }: Args) {
  const [index, setIndex] = useState<FieldSuggestionIndex>({ byColumnName: {}, titles: [] })
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  // Fetch the cross-rundown index once per mount (session-cached upstream).
  useEffect(() => {
    let alive = true
    getFieldSuggestionIndex(rundownId).then((r) => { if (alive) setIndex(r) }).catch(() => {})
    return () => { alive = false }
  }, [rundownId])

  const currentValuesFor = useCallback((field: string): string[] => {
    const cues = getCues()
    const cells = getCells()
    const out: string[] = []
    const seen = new Set<string>()
    const push = (v: string) => {
      const val = v.trim()
      if (!val || seen.has(val.toLowerCase())) return
      seen.add(val.toLowerCase())
      out.push(val)
    }
    // Later cues first, approximating "most recently used".
    const ordered = [...cues].reverse()
    if (field === 'title' || field === 'subtitle') {
      for (const c of ordered) push(stripHtml((field === 'title' ? c.title : c.subtitle) ?? ''))
    } else {
      const col = columnsRef.current.find((c) => c.id === field)
      for (const c of ordered) {
        const raw = cells[`${c.id}:${field}`] ?? ''
        if (col?.col_type === 'dropdown') parseDropdownCellValues(raw).forEach(push)
        else push(stripHtml(raw))
      }
      // Merge the column's predefined dropdown options.
      if (col?.col_type === 'dropdown') (col.options ?? []).forEach(push)
    }
    return out
  }, [getCues, getCells])

  const getSuggestions = useCallback((field: string, query: string): Suggestion[] => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const matches = (v: string) => {
      const lv = v.toLowerCase()
      return lv.includes(q) && lv !== q
    }

    const current = currentValuesFor(field).filter(matches)

    // Other-rundown values: titles for title/subtitle, else keyed by column name.
    let otherPool: string[] = []
    if (field === 'title' || field === 'subtitle') otherPool = index.titles
    else {
      const col = columnsRef.current.find((c) => c.id === field)
      otherPool = col ? (index.byColumnName[col.name] ?? []) : []
    }
    const currentLower = new Set(current.map((v) => v.toLowerCase()))
    const other = otherPool.filter((v) => matches(v) && !currentLower.has(v.toLowerCase()))

    const result: Suggestion[] = []
    for (const v of current) { if (result.length >= MAX_MATCHES) break; result.push({ value: v, source: 'current' }) }
    for (const v of other) { if (result.length >= MAX_MATCHES) break; result.push({ value: v, source: 'other' }) }

    // Smart title suggestions (#71.6): frequency-ranked prefix completions from
    // the whole corpus, surfaced below plain matches and not already shown.
    if (field === 'title') {
      const shown = new Set(result.map((r) => r.value.toLowerCase()))
      const freq = new Map<string, { value: string; n: number }>()
      const corpus = [...currentValuesFor('title'), ...index.titles]
      for (const t of corpus) {
        const lt = t.toLowerCase()
        if (!lt.startsWith(q) || lt === q || shown.has(lt)) continue
        const e = freq.get(lt)
        if (e) e.n++
        else freq.set(lt, { value: t, n: 1 })
      }
      const smart = [...freq.values()].sort((a, b) => b.n - a.n).slice(0, MAX_SMART)
      for (const s of smart) result.push({ value: s.value, source: 'smart' })
    }

    return result
  }, [index, currentValuesFor])

  return { getSuggestions }
}
