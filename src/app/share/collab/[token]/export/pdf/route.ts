import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { buildExportRows } from '@/lib/rundownExport'
import { RundownPdf } from '@/lib/RundownPdf'
import type { Rundown, Column, Cue, Cell, Variable, Mention } from '@/lib/supabase/types'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()

  type RpcResult = Promise<{ data: unknown; error: unknown }>
  const { data } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult)(
    'get_collab_rundown', { p_token: token }
  )
  if (!data || (data as { revoked?: boolean }).revoked) return new Response('Not found', { status: 404 })

  const payload = data as {
    rundown: Rundown
    columns: Column[]
    cues: Cue[]
    cells: Cell[]
    variables: Variable[]
    mentions: Mention[]
  }

  const rows = buildExportRows(payload.columns, payload.cues, payload.cells, payload.variables, payload.mentions)
  const buffer = await renderToBuffer(
    createElement(RundownPdf, {
      title: payload.rundown.name,
      showDate: payload.rundown.show_date,
      columns: payload.columns,
      rows,
    })
  )

  const filename = `${payload.rundown.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
