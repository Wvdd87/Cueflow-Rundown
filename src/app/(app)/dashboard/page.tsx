import { createClient } from '@/lib/supabase/server'
import { EventCard } from '@/components/dashboard/EventCard'
import { RundownCard } from '@/components/dashboard/RundownCard'
import { TemplateCard } from '@/components/dashboard/TemplateCard'
import { CreateEventDialog } from '@/components/dashboard/CreateEventDialog'
import { CreateRundownDialog } from '@/components/dashboard/CreateRundownDialog'
import { Layers } from 'lucide-react'
import type { Event, Rundown } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', user.id)
    .single()

  const profile = profileData as { team_id: string | null } | null
  const teamId = profile?.team_id

  if (!teamId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">Setting up your workspace…</p>
      </div>
    )
  }

  const [{ data: eventsData }, { data: rundownsData }, { data: templatesData }] =
    await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false }),
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

  const allEvents = (eventsData ?? []) as Event[]
  // filter out trashed rows in JS so this stays graceful before the migration
  const allRundowns = ((rundownsData ?? []) as Rundown[]).filter((r) => !r.deleted_at)
  const templates = ((templatesData ?? []) as Rundown[]).filter((r) => !r.deleted_at)
  const standaloneRundowns = allRundowns.filter((r) => !r.event_id)

  const rundownsByEvent = allEvents.reduce<Record<string, Rundown[]>>((acc, event) => {
    acc[event.id] = allRundowns.filter((r) => r.event_id === event.id)
    return acc
  }, {})

  const hasContent =
    allEvents.length > 0 || allRundowns.length > 0 || templates.length > 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <CreateEventDialog />
          <CreateRundownDialog events={allEvents} templates={templates} />
        </div>
      </div>

      {!hasContent ? (
        <EmptyState allEvents={allEvents} templates={templates} />
      ) : (
        <div className="space-y-8">
          {/* Events section */}
          {allEvents.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Events</h2>
              </div>
              <div className="space-y-2">
                {allEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    rundowns={rundownsByEvent[event.id] ?? []}
                    allEvents={allEvents}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Standalone rundowns */}
          {standaloneRundowns.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Rundowns</h2>
              </div>
              <div className="space-y-1.5">
                {standaloneRundowns.map((rundown) => (
                  <RundownCard key={rundown.id} rundown={rundown} />
                ))}
              </div>
            </section>
          )}

          {/* Templates */}
          {templates.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Templates</h2>
              </div>
              <div className="space-y-1.5">
                {templates.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({
  allEvents,
  templates,
}: {
  allEvents: Event[]
  templates: Rundown[]
}) {
  return (
    <div className="text-center py-20">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
        <Layers className="w-5 h-5 text-zinc-600" />
      </div>
      <h2 className="text-base font-medium text-white mb-1">Your workspace is empty</h2>
      <p className="text-sm text-zinc-500 mb-6 max-w-xs mx-auto">
        Create your first rundown or organise multiple rundowns inside an event folder.
      </p>
      <div className="flex items-center justify-center gap-3">
        <CreateEventDialog />
        <CreateRundownDialog events={allEvents} templates={templates} />
      </div>
    </div>
  )
}
