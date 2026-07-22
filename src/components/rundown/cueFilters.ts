import { stripHtml } from '@/lib/utils'
import { parseDropdownCellValues } from '@/lib/dropdownValues'
import type { CueLayout } from './cueTree'
import type { Cue, Column } from '@/lib/supabase/types'

export type CueKind = 'cue' | 'grouped' | 'heading'

export interface CueFilterState {
  text: string
  /** dropdown columnId -> selected option values (OR within a column, AND across columns) */
  columnValues: Record<string, string[]>
  cueTypes: Set<CueKind>
  /** null = "no color" */
  colors: Set<string | null>
  notFinalOnly: boolean
  durationMinMs: number | null
  durationMaxMs: number | null
}

export function emptyFilters(): CueFilterState {
  return {
    text: '',
    columnValues: {},
    cueTypes: new Set(),
    colors: new Set(),
    notFinalOnly: false,
    durationMinMs: null,
    durationMaxMs: null,
  }
}

export function hasActiveFilters(f: CueFilterState): boolean {
  return (
    f.text.trim() !== '' ||
    Object.values(f.columnValues).some((v) => v.length > 0) ||
    f.cueTypes.size > 0 ||
    f.colors.size > 0 ||
    f.notFinalOnly ||
    f.durationMinMs != null ||
    f.durationMaxMs != null
  )
}

export function cueKind(cue: Cue): CueKind {
  if (cue.cue_type === 'heading') return 'heading'
  return cue.group_id ? 'grouped' : 'cue'
}

/** Whether a single leaf cue matches the active filters (headings are handled
 *  separately via group/standalone visibility in computeCueVisibility). */
export function cueMatchesFilters(
  cue: Cue,
  filters: CueFilterState,
  cells: Record<string, string>
): boolean {
  const kind = cueKind(cue)
  if (filters.cueTypes.size > 0 && !filters.cueTypes.has(kind)) return false
  if (kind === 'heading') return true

  if (filters.notFinalOnly && !cue.not_final) return false

  if (filters.durationMinMs != null && cue.duration_ms < filters.durationMinMs) return false
  if (filters.durationMaxMs != null && cue.duration_ms > filters.durationMaxMs) return false

  if (filters.colors.size > 0 && !filters.colors.has(cue.background_color ?? null)) return false

  if (filters.text.trim()) {
    const q = filters.text.trim().toLowerCase()
    const inTitle = stripHtml(cue.title).toLowerCase().includes(q)
    const inSubtitle = stripHtml(cue.subtitle ?? '').toLowerCase().includes(q)
    const inScript = cue.scripts.some((s) => stripHtml(s.content).toLowerCase().includes(q))
    if (!inTitle && !inSubtitle && !inScript) return false
  }

  for (const [columnId, selected] of Object.entries(filters.columnValues)) {
    if (selected.length === 0) continue
    const cellValues = parseDropdownCellValues(cells[`${cue.id}:${columnId}`] ?? '')
    if (!selected.some((v) => cellValues.includes(v))) return false
  }

  return true
}

export interface CueVisibility {
  /** Leaf (non-heading) cue ids that should render. */
  cueIds: Set<string>
  /** Heading ids (standalone dividers and group headers) that should render. */
  headingIds: Set<string>
}

/**
 * Decide which rows render while filters are active — matches every cue
 * independently, then applies two distinct visibility rules: a group header
 * shows if ≥1 of its children match (regardless of the "Cue type" filter —
 * it's structural chrome for children that already matched, not itself being
 * filtered); a *standalone* heading divider always shows unless the "Cue
 * type" filter explicitly excludes headings.
 */
export function computeCueVisibility(
  layout: CueLayout,
  filters: CueFilterState,
  cells: Record<string, string>
): CueVisibility {
  const cueIds = new Set<string>()
  const headingIds = new Set<string>()
  const standaloneHeadingIncluded = filters.cueTypes.size === 0 || filters.cueTypes.has('heading')

  for (const item of layout.items) {
    if (item.type === 'group') {
      if (item.children.length === 0) {
        if (standaloneHeadingIncluded) headingIds.add(item.heading.id)
        continue
      }
      let anyChildMatched = false
      for (const child of item.children) {
        if (cueMatchesFilters(child, filters, cells)) {
          cueIds.add(child.id)
          anyChildMatched = true
        }
      }
      if (anyChildMatched) headingIds.add(item.heading.id)
    } else {
      if (cueMatchesFilters(item.cue, filters, cells)) cueIds.add(item.cue.id)
    }
  }

  return { cueIds, headingIds }
}

export interface DropdownFilterDimension {
  columnId: string
  columnName: string
  values: string[]
  optionColors: Record<string, string> | null
}

/** One filter dimension per dropdown-type column, listing only the values
 *  actually in use somewhere in the rundown (e.g. "Who"/"Where"/"Screen" columns). */
export function computeDropdownDimensions(
  columns: Column[],
  cues: Cue[],
  cells: Record<string, string>
): DropdownFilterDimension[] {
  const leafCues = cues.filter((c) => c.cue_type !== 'heading')
  return columns
    .filter((c) => c.col_type === 'dropdown')
    .map((col) => {
      const used = new Set<string>()
      for (const cue of leafCues) {
        for (const v of parseDropdownCellValues(cells[`${cue.id}:${col.id}`] ?? '')) used.add(v)
      }
      const ordered = (col.options ?? []).filter((o) => used.has(o))
      const extra = [...used].filter((v) => !ordered.includes(v))
      return {
        columnId: col.id,
        columnName: col.name,
        values: [...ordered, ...extra],
        optionColors: col.option_colors,
      }
    })
    .filter((d) => d.values.length > 0)
}

/** Distinct background colors currently used by leaf cues (null = "no color"), used-first order. */
export function computeUsedColors(cues: Cue[]): (string | null)[] {
  const leafCues = cues.filter((c) => c.cue_type !== 'heading')
  const used: (string | null)[] = []
  const seen = new Set<string | null>()
  let hasNoColor = false
  for (const cue of leafCues) {
    const c = cue.background_color ?? null
    if (c === null) {
      hasNoColor = true
      continue
    }
    if (!seen.has(c)) {
      seen.add(c)
      used.push(c)
    }
  }
  if (hasNoColor) used.push(null)
  return used
}
