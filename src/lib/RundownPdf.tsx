import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'
import type { ExportRow } from './rundownExport'
import type { Column } from './supabase/types'

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
    paddingBottom: 3,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#52525b',
    backgroundColor: '#ffffff',
  },

  section: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 10,
    borderRadius: 2,
  },
  sectionNum: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#a1a1aa',
    marginRight: 6,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#fafafa',
    flexGrow: 1,
    paddingRight: 8,
  },
  sectionMeta: { fontSize: 7.5, color: '#d4d4d8' },

  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e4e4e7',
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  childRowPad: { paddingVertical: 2.5 },

  num: { width: 36, paddingRight: 4 },
  numMain: { fontFamily: 'Helvetica-Bold' },
  numChild: { paddingLeft: 8, color: '#71717a', fontSize: 7.5 },
  time: { width: 44, paddingRight: 4, color: '#3f3f46' },
  dur: { width: 38, paddingRight: 6, color: '#3f3f46' },

  titleCol: { flexGrow: 1.4, flexBasis: 120, paddingRight: 8 },
  titleColChild: { paddingLeft: 8 },
  cueTitle: { fontFamily: 'Helvetica-Bold' },
  sub: { color: '#71717a', fontSize: 7, marginTop: 1 },

  col: { flexGrow: 1, flexBasis: 70, paddingRight: 6 },
  bulletRow: { flexDirection: 'row', marginBottom: 1 },
  bulletGlyph: { width: 7 },
  bulletText: { flexGrow: 1, flexShrink: 1 },

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

/** Multi-line cell content; "• " lines render as hanging-indent bullets. */
function CellContent({ value }: { value: string }) {
  if (!value) return null
  const lines = value.split('\n').filter((l) => l.trim() !== '')
  return (
    <View>
      {lines.map((line, i) =>
        line.startsWith('• ') ? (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletGlyph}>•</Text>
            <Text style={styles.bulletText}>{line.slice(2)}</Text>
          </View>
        ) : (
          <Text key={i}>{line}</Text>
        )
      )}
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
            <View key={i} style={styles.section} wrap={false} minPresenceAhead={44}>
              {r.number ? <Text style={styles.sectionNum}>{r.number}</Text> : null}
              <Text style={styles.sectionTitle}>{r.title}</Text>
              {r.duration ? (
                <Text style={styles.sectionMeta}>
                  {r.start} · {r.duration} total
                </Text>
              ) : null}
            </View>
          ) : (
            <View
              key={i}
              style={r.isChild ? [styles.row, styles.childRowPad] : styles.row}
              wrap={false}
            >
              <Text style={r.isChild ? [styles.num, styles.numChild] : [styles.num, styles.numMain]}>
                {r.number}
              </Text>
              <Text style={styles.time}>{r.start}</Text>
              <Text style={styles.dur}>{r.duration}</Text>
              <View style={r.isChild ? [styles.titleCol, styles.titleColChild] : styles.titleCol}>
                <Text style={r.isChild ? undefined : styles.cueTitle}>{r.title}</Text>
                {r.subtitle ? <Text style={styles.sub}>{r.subtitle}</Text> : null}
              </View>
              {colIndexes.map((ci) => (
                <View key={ci} style={styles.col}>
                  <CellContent value={r.cells[ci]} />
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
