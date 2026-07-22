import { createClient } from '@/lib/supabase/server'
import { buildExportRows, rowsToCsv } from '@/lib/rundownExport'
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
  const csv = rowsToCsv(payload.columns, rows)
  const filename = `${payload.rundown.name.replace(/[^a-z0-9]+/gi, '-')}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
