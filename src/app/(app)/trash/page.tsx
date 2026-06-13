import { createClient } from '@/lib/supabase/server'
import { TrashCard } from '@/components/dashboard/TrashCard'
import { Trash2 } from 'lucide-react'
import type { Rundown } from '@/lib/supabase/types'

export default async function TrashPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()
  const teamId = (profileData as { team_id: string | null } | null)?.team_id
  if (!teamId) return null

  // .not deleted_at is null — errors gracefully (→ empty) before the migration
  const { data } = await supabase
    .from('rundowns')
    .select('*')
    .eq('team_id', teamId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  const deleted = (data ?? []) as Rundown[]

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="w-5 h-5 text-zinc-500" />
        <h1 className="text-xl font-semibold text-white">Trash</h1>
      </div>
      <p className="text-sm text-zinc-500 mb-8">
        Deleted rundowns are kept here until you permanently remove them.
      </p>

      {deleted.length === 0 ? (
        <p className="text-sm text-zinc-600 py-12 text-center">Trash is empty.</p>
      ) : (
        <div className="space-y-1.5">
          {deleted.map((r) => (
            <TrashCard key={r.id} rundown={r} />
          ))}
        </div>
      )}
    </div>
  )
}
