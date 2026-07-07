import { buildCueLayout } from '@/components/rundown/cueTree'
import {
  calculateTimings,
  formatMsToTime,
  type CueTimingOutput,
} from '@/lib/timing'
import {
  cellToPlainText,
  cellToRichLines,
  parseRichHtml,
  stripHtml,
  type RichLine,
} from '@/lib/cellHtml'
import type { Cue, Column, Cell, Variable, Mention } from '@/lib/supabase/types'

export { stripHtml }
export type { RichLine, RichSegment } from '@/lib/cellHtml'

export interface ExportRow {
  number: string
  isGroup: boolean
  /** True for cues nested under a group heading (numbered n.1, n.2, …). */
  isChild: boolean
  /** True when the row carries no content (no title, no duration, no cells). */
  isEmpty: boolean
  /** Row colour from the app's CUE_COLORS palette (hex), null = uncoloured. */
  color: string | null
  start: string
  duration: string
  title: string
  subtitle: string
  cells: string[] // one plain-text value per column, in column order
  // Styled variants used by the PDF so rich-text formatting is preserved;
  // the plain fields above stay as-is for CSV and emptiness checks.
  titleRich: RichLine[]
  subtitleRich: RichLine[]
  cellsRich: RichLine[][]
}

/** Duration with zero-padded minutes so columns align: "09:00", "35:21", "1:02:15". */
export function formatExportDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function rowFor(
  cue: Cue,
  number: string,
  isChild: boolean,
  timedMap: Record<string, CueTimingOutput>,
  columns: Column[],
  cellMap: Record<string, string>,
  varMap: Record<string, string>,
  mentionNameById: Record<string, string>
): ExportRow {
  const t = timedMap[cue.id]
  const title = stripHtml(cue.title) || ''
  const subtitle = stripHtml(cue.subtitle) || ''
  const cells = columns.map((col) =>
    cellToPlainText(cellMap[`${cue.id}:${col.id}`], varMap, col.col_type, mentionNameById)
  )
  return {
    number,
    isGroup: false,
    isChild,
    isEmpty:
      !title && !subtitle && cue.duration_ms === 0 && cells.every((c) => !c.trim()),
    color: cue.background_color ?? null,
    start: formatMsToTime(t?.calculated_start_ms ?? 0),
    duration: formatExportDuration(cue.duration_ms),
    title,
    subtitle,
    cells,
    titleRich: parseRichHtml(cue.title),
    subtitleRich: parseRichHtml(cue.subtitle),
    cellsRich: columns.map((col) =>
      cellToRichLines(cellMap[`${cue.id}:${col.id}`], varMap, col.col_type, mentionNameById)
    ),
  }
}

/** Flatten a rundown into export rows (groups become header rows, children numbered #.#). */
export function buildExportRows(
  columns: Column[],
  cues: Cue[],
  cells: Cell[],
  variables: Variable[] = [],
  mentions: Mention[] = []
): ExportRow[] {
  const cellMap: Record<string, string> = Object.fromEntries(
    cells.map((c) => [`${c.cue_id}:${c.column_id}`, c.content ?? ''])
  )
  const varMap: Record<string, string> = Object.fromEntries(
    variables.map((v) => [v.key, v.value])
  )
  const mentionNameById: Record<string, string> = Object.fromEntries(
    mentions.map((m) => [m.id, m.name])
  )
  const layout = buildCueLayout(cues)
  const timed = calculateTimings(layout.docOrder)
  const timedMap = Object.fromEntries(
    timed.map((t) => [t.id, t])
  ) as Record<string, CueTimingOutput>

  const rows: ExportRow[] = []
  for (const item of layout.items) {
    if (item.type === 'group') {
      const title = stripHtml(item.heading.title) || ''
      const hasChildren = item.children.length > 0
      // A heading is a section divider — wall-clock start/duration only make
      // sense when it wraps children (section total); otherwise leave blank.
      const dur = item.children.reduce((s, c) => s + c.duration_ms, 0)
      const startMs = hasChildren
        ? timedMap[item.children[0].id]?.calculated_start_ms ?? 0
        : 0
      rows.push({
        number: item.number,
        isGroup: true,
        isChild: false,
        isEmpty: !title && !hasChildren,
        color: item.heading.background_color ?? null,
        start: hasChildren ? formatMsToTime(startMs) : '',
        duration: hasChildren ? formatExportDuration(dur) : '',
        title: title || (hasChildren ? 'Group' : ''),
        subtitle: '',
        cells: columns.map(() => ''),
        titleRich: [],
        subtitleRich: [],
        cellsRich: columns.map(() => []),
      })
      for (const ch of item.children) {
        rows.push(rowFor(ch, layout.numberOf[ch.id] ?? '', true, timedMap, columns, cellMap, varMap, mentionNameById))
      }
    } else {
      rows.push(rowFor(item.cue, item.number, false, timedMap, columns, cellMap, varMap, mentionNameById))
    }
  }
  return rows
}

export function rowsToCsv(columns: Column[], rows: ExportRow[]): string {
  const header = ['#', 'Start', 'Duration', 'Title', 'Subtitle', ...columns.map((c) => c.name)]
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [header.map(esc).join(',')]
  for (const r of rows) {
    lines.push(
      [r.number, r.start, r.duration, r.title, r.subtitle, ...r.cells]
        .map(esc)
        .join(',')
    )
  }
  return lines.join('\r\n')
}
