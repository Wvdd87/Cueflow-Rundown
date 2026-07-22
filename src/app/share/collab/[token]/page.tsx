import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RundownEditor } from '@/components/rundown/RundownEditor'
import type { Rundown, Column, Cue, Cell, Mention, Variable } from '@/lib/supabase/types'

interface CollabRpcPayload {
  rundown: Rundown
  collab: { label: string; editableColumns: string[]; canAddDeleteCues: boolean; canAddDeleteColumns: boolean; canRunShow: boolean }
  columns: Column[]
  cues: Cue[]
  cells: Cell[]
  variables: Variable[]
  mentions: Mention[]
}

export default async function CollabPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Public, token-gated read via the security-definer function (bypasses RLS).
  type RpcResult = Promise<{ data: unknown; error: unknown }>
  const { data } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult)(
    'get_collab_rundown', { p_token: token }
  )

  if (!data) notFound()
  if ((data as { revoked?: boolean }).revoked) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#09090d] text-[#c8c9d0] px-6">
        <div className="max-w-sm text-center space-y-2">
          <p className="text-lg font-semibold text-[#eef0f3]">This link has been revoked</p>
          <p className="text-sm text-[#9ba0ab]">Contact the rundown owner for a new link.</p>
        </div>
      </div>
    )
  }

  const payload = data as unknown as CollabRpcPayload

  const { data: notesData } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult)(
    'get_collab_private_notes', { p_token: token }
  )
  const notesArr = (notesData as { cue_id: string; content: string }[] | null) ?? []
  const initialPrivateNotes = Object.fromEntries(notesArr.map((n) => [n.cue_id, n.content]))

  return (
    <RundownEditor
      rundown={payload.rundown}
      initialCues={payload.cues}
      initialColumns={payload.columns}
      initialCells={payload.cells}
      initialMentions={payload.mentions}
      initialVariables={payload.variables}
      initialPrivateNotes={initialPrivateNotes}
      collab={{
        token,
        label: payload.collab.label,
        editableColumns: payload.collab.editableColumns,
        canRunShow: payload.collab.canRunShow,
      }}
    />
  )
}
