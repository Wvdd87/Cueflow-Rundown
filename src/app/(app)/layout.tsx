import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app/AppSidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('full_name, teams(name)')
    .eq('id', user.id)
    .single()

  const profile = data as { full_name: string | null; teams: { name: string } | null } | null

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <AppSidebar
        email={user.email ?? ''}
        fullName={profile?.full_name ?? null}
        teamName={profile?.teams?.name ?? 'My Team'}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
