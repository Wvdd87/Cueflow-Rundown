import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CollabRundownView, type CollabData } from '@/components/share/CollabRundownView'

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

  return <CollabRundownView data={data as unknown as CollabData} token={token} />
}
