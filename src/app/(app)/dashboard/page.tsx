import { createClient } from '@/lib/supabase/server'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { CreateEventDialog } from '@/components/dashboard/CreateEventDialog'
import { CreateRundownDialog } from '@/components/dashboard/CreateRundownDialog'
import { UserMenu } from '@/components/dashboard/UserMenu'
import type { Event, Rundown } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('team_id, full_name')
    .eq('id', user.id)
    .single()

  const profile = profileData as { team_id: string | null; full_name: string | null } | null
  const teamId = profile?.team_id

  if (!teamId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#888b96] text-sm">Setting up your workspace…</p>
      </div>
    )
  }

  const [{ data: teamData }, { data: eventsData }, { data: rundownsData }, { data: templatesData }] =
    await Promise.all([
      supabase.from('teams').select('name').eq('id', teamId).single(),
      supabase
        .from('events')
        .select('*')
        .eq('team_id', teamId)
        .order('event_date', { ascending: true, nullsFirst: true }),
      supabase
        .from('rundowns')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_template', false)
        .order('updated_at', { ascending: false }),
      supabase
        .from('rundowns')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_template', true)
        .order('updated_at', { ascending: false }),
    ])

  const teamName = (teamData as { name: string } | null)?.name ?? 'Workspace'
  const allEvents = (eventsData ?? []) as Event[]
  const allRundowns = ((rundownsData ?? []) as Rundown[]).filter((r) => !r.deleted_at)
  const templates = ((templatesData ?? []) as Rundown[]).filter((r) => !r.deleted_at)
  const standaloneRundowns = allRundowns.filter((r) => !r.event_id)

  const rundownsByEvent = allEvents.reduce<Record<string, Rundown[]>>((acc, event) => {
    acc[event.id] = allRundowns.filter((r) => r.event_id === event.id)
    return acc
  }, {})

  const summary = `${allEvents.length} event${allEvents.length === 1 ? '' : 's'} · ${allRundowns.length} rundown${allRundowns.length === 1 ? '' : 's'}`

  return (
    <div className="min-h-full bg-[#09090d]">
      {/* Top header */}
      <header className="h-14 flex items-center gap-3.5 px-6 bg-[#07070a] border-b border-[#1d1d24]">
        <div className="w-[30px] h-[30px] bg-[#f0a838] flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06060a" strokeWidth="2.5" strokeLinecap="square">
            <line x1="7" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="20" y2="12" />
            <line x1="7" y1="18" x2="20" y2="18" />
            <line x1="3" y1="6" x2="3" y2="6" strokeLinecap="round" strokeWidth="3.2" />
            <line x1="3" y1="12" x2="3" y2="12" strokeLinecap="round" strokeWidth="3.2" />
            <line x1="3" y1="18" x2="3" y2="18" strokeLinecap="round" strokeWidth="3.2" />
          </svg>
        </div>
        <span className="font-cond text-sm font-bold uppercase tracking-[0.08em] text-[#eef0f3]">Cueflow</span>
        <div className="w-px h-5 bg-[#22222a]" />
        <span className="text-[13px] text-[#9ba0ab] truncate">{teamName}</span>

        <div className="flex-1" />

        <CreateEventDialog />
        <CreateRundownDialog events={allEvents} templates={templates} />
        <UserMenu email={user.email ?? ''} fullName={profile?.full_name ?? null} />
      </header>

      <div className="max-w-[1080px] mx-auto px-6 py-9">
        <DashboardTabs
          allEvents={allEvents}
          rundownsByEvent={rundownsByEvent}
          standaloneRundowns={standaloneRundowns}
          templates={templates}
          summary={summary}
        />
      </div>
    </div>
  )
}
