// ── CueFlow block-model geometry ──
// Shared so cue rows, column headers, group/heading bands stay pixel-aligned.
// Each row is: [ control gutter (c1, no tile) ] gap [ tiles … ] with ROW_PAD
// on each side and GAP between every block. Tiles: #, Start, Dur, Title,
// dynamic columns, Private notes.
export const CF = {
  c1: 50, // control gutter (drag handle / settings / select checkbox)
  num: 56,
  start: 110,
  dur: 104,
  pn: 210, // private notes
  gap: 6,
  rowPad: 10,
  headerH: 34,
  minColWidth: 90,
  minRowH: 67, // shared minimum row height for cues, groups & headings
} as const

export const TITLE_COL_WIDTH = 260
export const PRIVATE_NOTES_WIDTH = CF.pn
// Sentinel id used in the column DnD to represent the Private Notes column.
export const PRIVATE_NOTES_ID = '__private-notes__'

// 12-colour cue background palette (null = no colour).
export const CUE_COLORS: (string | null)[] = [
  null,
  '#4a1d96',
  '#14532d',
  '#1e3a8a',
  '#7f1d1d',
  '#78350f',
  '#3f3f46',
  '#7c3aed',
  '#15803d',
  '#2563eb',
  '#b91c1c',
  '#a16207',
]

/** Total pixel width of a full row (gutter + all blocks + gaps + padding). */
export function totalRowWidth(titleWidth: number, visibleColWidths: number[]): number {
  const blockWs = [CF.num, CF.start, CF.dur, titleWidth, ...visibleColWidths, CF.pn]
  const sumBlockW = blockWs.reduce((a, b) => a + b, 0)
  const nBlocks = blockWs.length
  return CF.rowPad * 2 + CF.c1 + sumBlockW + CF.gap * nBlocks
}

// ── WCAG contrast helper: readable text colours on a coloured cue background ──
function lin(v: number) {
  v /= 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
function luminance(hex: string) {
  const c = hex.replace('#', '')
  return (
    0.2126 * lin(parseInt(c.substr(0, 2), 16)) +
    0.7152 * lin(parseInt(c.substr(2, 2), 16)) +
    0.0722 * lin(parseInt(c.substr(4, 2), 16))
  )
}
export interface OnColor {
  hi: string
  mid: string
  num: string
}
/** Returns readable hi/mid/number text colours for a given cue background. */
export function textOn(bg: string | null): OnColor {
  if (!bg) return { hi: '#eef0f3', mid: '#9ba0ab', num: '#c8c9d0' }
  const L = luminance(bg)
  const cw = 1.05 / (L + 0.05)
  const cb = (L + 0.05) / 0.05
  return cw >= cb
    ? { hi: '#ffffff', mid: 'rgba(255,255,255,0.78)', num: '#ffffff' }
    : { hi: '#0a0a0c', mid: 'rgba(0,0,0,0.72)', num: '#0a0a0c' }
}
