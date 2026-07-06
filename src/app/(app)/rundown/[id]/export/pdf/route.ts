import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { buildExportRows } from '@/lib/rundownExport'
import { RundownPdf } from '@/lib/RundownPdf'
import type { Rundown, Column, Cue, Cell, Variable, Mention } from '@/lib/supabase/types'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: rundownData } = await supabase
    .from('rundowns')
    .select('*')
    .eq('id', id)
    .single()
  if (!rundownData) return new Response('Not found', { status: 404 })
  const rundown = rundownData as Rundown

  const [{ data: cuesData }, { data: colsData }, { data: varsData }, { data: mentionsData }] = await Promise.all([
    supabase.from('cues').select('*').eq('rundown_id', id).is('deleted_at', null).order('position'),
    supabase.from('columns').select('*').eq('rundown_id', id).is('deleted_at', null).order('position'),
    supabase.from('variables').select('*').eq('rundown_id', id),
    supabase.from('mentions').select('*').eq('rundown_id', id),
  ])
  const cues = (cuesData ?? []) as Cue[]
  const columns = (colsData ?? []) as Column[]
  const variables = (varsData ?? []) as Variable[]
  const mentions = (mentionsData ?? []) as Mention[]

  let cells: Cell[] = []
  if (cues.length > 0) {
    const { data: cellData } = await supabase
      .from('cells')
      .select('*')
      .in('cue_id', cues.map((c) => c.id))
    cells = (cellData ?? []) as Cell[]
  }

  const rows = buildExportRows(columns, cues, cells, variables, mentions)
  const buffer = await renderToBuffer(
    createElement(RundownPdf, {
      title: rundown.name,
      showDate: rundown.show_date,
      columns,
      rows,
    })
  )

  const filename = `${rundown.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
