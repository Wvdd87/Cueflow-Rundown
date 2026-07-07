import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ExportRow } from './rundownExport'
import type { RichLine, RichSegment } from './cellHtml'
import type { Column } from './supabase/types'

// Left-border colour for cues with no assigned colour. Deliberately a light
// neutral so it can't be mistaken for the palette's own dark gray (#3f3f46)
// or any other category colour.
const NEUTRAL_BORDER = '#d4d4d8'

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#18181b',
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 8, color: '#71717a', marginBottom: 10 },

  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
    borderLeftWidth: 3,
    borderLeftColor: '#ffffff',
    paddingLeft: 4,
    paddingBottom: 3,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#52525b',
    backgroundColor: '#ffffff',
  },

  // Section bands. Numbered bands (groups acting as parent cues) share the cue
  // rows' fixed column grid so their TITLE aligns; unnumbered bands are pure
  // dividers and start flush left.
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    paddingVertical: 5,
    paddingLeft: 4,
    paddingRight: 6,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 2,
    borderLeftWidth: 3,
  },
  sectionNum: {
    width: 36,
    paddingRight: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#a1a1aa',
  },
  sectionTime: { width: 44, paddingRight: 4, fontSize: 7.5, color: '#d4d4d8' },
  sectionDur: { width: 38, paddingRight: 6, fontSize: 7.5, color: '#d4d4d8' },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#fafafa',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingRight: 8,
  },

  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e4e4e7',
    borderLeftWidth: 3,
    paddingLeft: 4,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  childRowPad: { paddingVertical: 2.5 },

  num: { width: 36, paddingRight: 4, fontFamily: 'Helvetica-Bold' },
  time: { width: 44, paddingRight: 4, color: '#3f3f46' },
  dur: { width: 38, paddingRight: 6, color: '#3f3f46' },

  titleCol: { flexGrow: 1.4, flexBasis: 120, paddingRight: 8 },
  sub: { color: '#71717a', fontSize: 7 },

  col: { flexGrow: 1, flexBasis: 70, paddingRight: 6 },
  richLine: { flexDirection: 'row', marginBottom: 1 },
  richLineText: { flexGrow: 1, flexShrink: 1 },

  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#a1a1aa',
  },
})

/** Drop stored text colours that would be unreadable on white paper (the app
 *  editor runs on a dark theme, so near-white text colours are common). */
function printableColor(c: string | undefined): string | undefined {
  if (!c) return undefined
  let r = -1, g = -1, b = -1
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (hex) {
    const h = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16)
  } else {
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) { r = +m[1]; g = +m[2]; b = +m[3] }
    else if (/^white$/i.test(c)) return undefined
  }
  if (r >= 0 && (r * 299 + g * 587 + b * 114) / 1000 > 215) return undefined
  return c
}

function segmentStyle(s: RichSegment, baseBold: boolean) {
  const bold = baseBold || s.bold
  const st: Record<string, string> = {
    fontFamily:
      bold && s.italic ? 'Helvetica-BoldOblique'
      : bold ? 'Helvetica-Bold'
      : s.italic ? 'Helvetica-Oblique'
      : 'Helvetica',
  }
  const deco = [
    (s.underline || s.link) && 'underline',
    s.strike && 'line-through',
  ].filter(Boolean)
  if (deco.length) st.textDecoration = deco.join(' ')
  const color = s.link ? '#2563eb' : printableColor(s.color)
  if (color) st.color = color
  const highlight = printableColor(s.highlight) ?? s.highlight
  if (s.highlight && highlight) st.backgroundColor = highlight
  return st
}

function headingStyle(level: number | undefined) {
  if (!level) return undefined
  return { fontSize: level === 1 ? 10 : level === 2 ? 9 : 8.5 }
}

/** Rich-text block: styled inline segments, list markers, nested indents. */
function RichText({
  lines,
  baseBold = false,
  textStyle,
}: {
  lines: RichLine[]
  baseBold?: boolean
  textStyle?: Style
}) {
  if (!lines.length) return null
  return (
    <View>
      {lines.map((l, i) => (
        <View
          key={i}
          style={
            l.indent
              ? [styles.richLine, { paddingLeft: l.indent * 8 }]
              : styles.richLine
          }
        >
          {l.marker ? (
            <Text style={[{ width: l.marker === '•' ? 7 : 13 }, textStyle ?? {}]}>
              {l.marker}
            </Text>
          ) : null}
          <Text style={[styles.richLineText, textStyle ?? {}, headingStyle(l.heading) ?? {}]}>
            {l.segments.map((s, j) => (
              <Text key={j} style={segmentStyle(s, baseBold || !!l.heading)}>
                {s.text}
              </Text>
            ))}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function RundownPdf({
  title,
  showDate,
  columns,
  rows,
}: {
  title: string
  showDate: string | null
  columns: Column[]
  rows: ExportRow[]
}) {
  // Hide rows that carry no content (empty wrapper cues, untitled empty headings).
  const visible = rows.filter((r) => !r.isEmpty)
  // Drop columns that are empty on every visible cue — no point printing 80 blanks.
  const colIndexes = columns
    .map((_, i) => i)
    .filter((i) => visible.some((r) => !r.isGroup && r.cells[i]?.trim()))
  const cueCount = visible.filter((r) => !r.isGroup).length

  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {showDate ? `${showDate} · ` : ''}
          {cueCount} cues
        </Text>

        <View style={styles.headerRow} fixed>
          <Text style={styles.num}>#</Text>
          <Text style={styles.time}>Start</Text>
          <Text style={styles.dur}>Dur.</Text>
          <Text style={styles.titleCol}>Title</Text>
          {colIndexes.map((i) => (
            <Text key={columns[i].id} style={styles.col}>
              {columns[i].name}
            </Text>
          ))}
        </View>

        {visible.map((r, i) =>
          r.isGroup ? (
            // Section band. minPresenceAhead keeps it from stranding at a page
            // bottom without at least its first child row beneath it.
            <View
              key={i}
              style={[styles.section, { borderLeftColor: r.color ?? NEUTRAL_BORDER }]}
              wrap={false}
              minPresenceAhead={44}
            >
              {r.number ? (
                <>
                  <Text style={styles.sectionNum}>{r.number}</Text>
                  <Text style={styles.sectionTime}>{r.start}</Text>
                  <Text style={styles.sectionDur}>{r.duration}</Text>
                </>
              ) : null}
              <Text style={styles.sectionTitle}>{r.title}</Text>
            </View>
          ) : (
            <View
              key={i}
              style={[
                styles.row,
                ...(r.isChild ? [styles.childRowPad] : []),
                { borderLeftColor: r.color ?? NEUTRAL_BORDER },
              ]}
              wrap={false}
            >
              <Text style={styles.num}>{r.number}</Text>
              <Text style={styles.time}>{r.start}</Text>
              <Text style={styles.dur}>{r.duration}</Text>
              <View style={styles.titleCol}>
                <RichText lines={r.titleRich} baseBold={!r.isChild} />
                {r.subtitleRich.length ? (
                  <RichText lines={r.subtitleRich} textStyle={styles.sub} />
                ) : null}
              </View>
              {colIndexes.map((ci) => (
                <View key={ci} style={styles.col}>
                  <RichText lines={r.cellsRich[ci]} />
                </View>
              ))}
            </View>
          )
        )}

        <View style={styles.footer} fixed>
          <Text>
            {title}
            {showDate ? ` · ${showDate}` : ''}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
