import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SharedRundownView, type SharedData } from '@/components/share/SharedRundownView'

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Public, token-gated read via the security-definer function (bypasses RLS).
  // rpc isn't in the generated types, so cast each call site (keeps `this` bound).
  type RpcResult = Promise<{ data: unknown; error: unknown }>

  const { data } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult)(
    'get_shared_rundown', { p_token: token }
  )
  if (!data) notFound()

  const { data: notesRaw } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => RpcResult)(
    'get_share_private_notes', { p_token: token }
  )
  const notesArr = (notesRaw as { cue_id: string; content: string }[] | null) ?? []
  const initialPrivateNotes: Record<string, string> = Object.fromEntries(
    notesArr.map((n) => [n.cue_id, n.content])
  )

  return (
    <SharedRundownView
      data={data as unknown as SharedData}
      token={token}
      initialPrivateNotes={initialPrivateNotes}
    />
  )
}
