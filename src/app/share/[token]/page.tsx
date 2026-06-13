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
  // rpc isn't in the generated types, so call it loosely-typed.
  const { data } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>
  )('get_shared_rundown', { p_token: token })
  if (!data) notFound()

  return <SharedRundownView data={data as unknown as SharedData} />
}
