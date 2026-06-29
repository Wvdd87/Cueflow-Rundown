import { buildCueLayout } from '@/components/rundown/cueTree'
import {
  calculateTimings,
  formatMsToTime,
  formatDuration,
  type CueTimingOutput,
} from '@/lib/timing'
import { cellToPlainText, stripHtml } from '@/lib/cellHtml'
import type { Cue, Column, Cell, Variable, Mention } from '@/lib/supabase/types'

export { stripHtml }

export interface ExportRow {
  number: string
  isGroup: boolean
  start: string
  duration: string
  title: string
  subtitle: string
  cells: string[] // one plain-text value per column, in column order
}

function rowFor(
  cue: Cue,
  number: string,
  timedMap: Record<string, CueTimingOutput>,
  columns: Column[],
  cellMap: Record<string, string>,
  varMap: Record<string, string>,
  mentionNameById: Record<string, string>
): ExportRow {
  const t = timedMap[cue.id]
  return {
    number,
    isGroup: false,
    start: formatMsToTime(t?.calculated_start_ms ?? 0),
    duration: formatDuration(cue.duration_ms),
    title: stripHtml(cue.title) || '',
    subtitle: stripHtml(cue.subtitle) || '',
    cells: columns.map((col) =>
      cellToPlainText(cellMap[`${cue.id}:${col.id}`], varMap, col.col_type, mentionNameById)
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
      const dur = item.children.reduce((s, c) => s + c.duration_ms, 0)
      const startMs = item.children.length
        ? timedMap[item.children[0].id]?.calculated_start_ms ?? 0
        : 0
      rows.push({
        number: item.number,
        isGroup: true,
        start: formatMsToTime(startMs),
        duration: formatDuration(dur),
        title: stripHtml(item.heading.title) || 'Group',
        subtitle: '',
        cells: columns.map(() => ''),
      })
      for (const ch of item.children) {
        rows.push(rowFor(ch, layout.numberOf[ch.id] ?? '', timedMap, columns, cellMap, varMap, mentionNameById))
      }
    } else {
      rows.push(rowFor(item.cue, item.number, timedMap, columns, cellMap, varMap, mentionNameById))
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
