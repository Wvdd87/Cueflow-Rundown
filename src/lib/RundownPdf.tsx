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
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica', color: '#18181b' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 8, color: '#71717a', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e4e4e7',
    paddingVertical: 3,
    alignItems: 'flex-start',
  },
  headerRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#a1a1aa',
    fontFamily: 'Helvetica-Bold',
  },
  groupRow: { backgroundColor: '#f4f4f5', fontFamily: 'Helvetica-Bold' },
  num: { width: 34, paddingRight: 4 },
  time: { width: 52, paddingRight: 4, fontFamily: 'Helvetica' },
  titleCol: { flexGrow: 1, flexBasis: 120, paddingRight: 6 },
  sub: { color: '#71717a', fontSize: 7 },
  col: { flexGrow: 1, flexBasis: 70, paddingRight: 6 },
})

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
  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {showDate ? `${showDate} · ` : ''}
          {rows.filter((r) => !r.isGroup).length} cues
        </Text>

        <View style={[styles.row, styles.headerRow]}>
          <Text style={styles.num}>#</Text>
          <Text style={styles.time}>Start</Text>
          <Text style={styles.time}>Dur.</Text>
          <Text style={styles.titleCol}>Title</Text>
          {columns.map((c) => (
            <Text key={c.id} style={styles.col}>
              {c.name}
            </Text>
          ))}
        </View>

        {rows.map((r, i) => (
          <View
            key={i}
            style={r.isGroup ? [styles.row, styles.groupRow] : styles.row}
            wrap={false}
          >
            <Text style={styles.num}>{r.number}</Text>
            <Text style={styles.time}>{r.start}</Text>
            <Text style={styles.time}>{r.duration}</Text>
            <Text style={styles.titleCol}>
              {r.title}
              {r.subtitle ? <Text style={styles.sub}>{`  ${r.subtitle}`}</Text> : null}
            </Text>
            {r.cells.map((v, j) => (
              <Text key={j} style={styles.col}>
                {v}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
