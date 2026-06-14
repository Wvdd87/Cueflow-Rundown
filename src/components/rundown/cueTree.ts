import type { Cue } from '@/lib/supabase/types'

export interface CueGroupItem {
  type: 'group'
  heading: Cue
  number: string
  children: Cue[]
}
export interface CueLeafItem {
  type: 'cue'
  cue: Cue
  number: string
}
export type CueRowItem = CueGroupItem | CueLeafItem

export interface CueLayout {
  /** Render order: standalone cues + group headers (each carrying its children). */
  items: CueRowItem[]
  /** Flattened document order (heading then its children) — feeds the timing cascade. */
  docOrder: Cue[]
  /** Hierarchical display number for every cue id ("1", "2", "2.1", …). */
  numberOf: Record<string, string>
}

/**
 * Format a raw cue number (e.g. "1", "2.1") using the rundown's numbering settings.
 * Prefix and digit-padding apply to the top-level integer; sub-cue suffixes are kept as-is.
 *
 * Example: raw="2.1", prefix="A-", start=0, digits=2 → "A-01.1"
 */
export function formatCueNumber(
  raw: string,
  prefix: string,
  start: number,
  digits: number
): string {
  if (!raw) return ''
  const parts = raw.split('.')
  const topNum = parseInt(parts[0], 10)
  if (isNaN(topNum)) return raw
  const padded = String(start + topNum - 1).padStart(digits, '0')
  const formatted = prefix + padded
  return parts.length > 1 ? `${formatted}.${parts.slice(1).join('.')}` : formatted
}

/**
 * Turn the flat cue list into a one-level group tree.
 * A "group" is a cue with cue_type='heading'; members reference it via group_id.
 */
export function buildCueLayout(cues: Cue[]): CueLayout {
  const sorted = [...cues].sort((a, b) => a.position - b.position)
  const headingIds = new Set(
    sorted.filter((c) => c.cue_type === 'heading').map((c) => c.id)
  )

  const childrenByGroup = new Map<string, Cue[]>()
  for (const c of sorted) {
    if (c.group_id && headingIds.has(c.group_id) && c.cue_type !== 'heading') {
      const arr = childrenByGroup.get(c.group_id) ?? []
      arr.push(c)
      childrenByGroup.set(c.group_id, arr)
    }
  }

  // top-level = no group, or group_id pointing at a non-heading (orphan → promote)
  const topLevel = sorted.filter(
    (c) => !c.group_id || !headingIds.has(c.group_id) || c.cue_type === 'heading'
  )

  const items: CueRowItem[] = []
  const docOrder: Cue[] = []
  const numberOf: Record<string, string> = {}
  let n = 0

  for (const t of topLevel) {
    if (t.cue_type === 'heading') {
      const children = childrenByGroup.get(t.id) ?? []
      // Headings get no number — children continue the flat counter
      numberOf[t.id] = ''
      children.forEach((ch) => {
        n++
        numberOf[ch.id] = String(n)
      })
      items.push({ type: 'group', heading: t, number: '', children })
      docOrder.push(t, ...children)
    } else {
      n++
      numberOf[t.id] = String(n)
      items.push({ type: 'cue', cue: t, number: String(n) })
      docOrder.push(t)
    }
  }

  return { items, docOrder, numberOf }
}
