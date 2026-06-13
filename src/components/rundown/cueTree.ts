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
    n++
    numberOf[t.id] = String(n)
    if (t.cue_type === 'heading') {
      const children = childrenByGroup.get(t.id) ?? []
      children.forEach((ch, i) => {
        numberOf[ch.id] = `${n}.${i + 1}`
      })
      items.push({ type: 'group', heading: t, number: String(n), children })
      docOrder.push(t, ...children)
    } else {
      items.push({ type: 'cue', cue: t, number: String(n) })
      docOrder.push(t)
    }
  }

  return { items, docOrder, numberOf }
}
