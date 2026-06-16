'use client'

import { useMemo, useState } from 'react'
import { Layers } from 'lucide-react'
import { EventCard } from './EventCard'
import { RundownCard } from './RundownCard'
import { TemplateCard } from './TemplateCard'
import { CreateEventDialog } from './CreateEventDialog'
import { CreateRundownDialog } from './CreateRundownDialog'
import { cn } from '@/lib/utils'
import type { Event, Rundown } from '@/lib/supabase/types'

type Tab = 'all' | 'upcoming' | 'past' | 'archived'

interface DashboardTabsProps {
  allEvents: Event[]
  rundownsByEvent: Record<string, Rundown[]>
  standaloneRundowns: Rundown[]
  templates: Rundown[]
  summary: string
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-cond text-[12px] font-bold uppercase tracking-[0.16em] text-[#888b96]">{children}</h2>
      <div className="flex-1 h-px bg-[#1d1d24]" />
    </div>
  )
}

export function DashboardTabs({ allEvents, rundownsByEvent, standaloneRundowns, templates, summary }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const { upcoming, past, archived } = useMemo(() => {
    const upcoming: Event[] = []
    const past: Event[] = []
    const archived: Event[] = []
    for (const event of allEvents) {
      if (event.archived) archived.push(event)
      else if (event.event_date && event.event_date < today) past.push(event)
      else upcoming.push(event)
    }
    return { upcoming, past, archived }
  }, [allEvents, today])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: allEvents.length },
    { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { id: 'past', label: 'Past', count: past.length },
    { id: 'archived', label: 'Archived', count: archived.length },
  ]

  const hasContent = allEvents.length > 0 || standaloneRundowns.length > 0 || templates.length > 0

  function renderEvents(events: Event[], emptyMsg: string) {
    if (events.length === 0) {
      return <p className="text-[13px] text-[#5a5c66] italic py-6">{emptyMsg}</p>
    }
    return (
      <div className="space-y-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} rundowns={rundownsByEvent[event.id] ?? []} allEvents={allEvents} />
        ))}
      </div>
    )
  }

  function renderExtra() {
    if (standaloneRundowns.length === 0 && templates.length === 0) return null
    return (
      <div className="space-y-11 mt-11">
        {standaloneRundowns.length > 0 && (
          <section>
            <SectionHeading>Rundowns</SectionHeading>
            <div className="border border-[#1d1d24] bg-[#0c0c11]">
              {standaloneRundowns.map((r) => (
                <RundownCard key={r.id} rundown={r} allEvents={allEvents} />
              ))}
            </div>
          </section>
        )}
        {templates.length > 0 && (
          <section>
            <SectionHeading>Templates</SectionHeading>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  if (!hasContent) {
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 bg-[#0c0c11] border border-[#1d1d24] flex items-center justify-center mx-auto mb-4">
          <Layers className="w-5 h-5 text-[#5a5c66]" />
        </div>
        <h2 className="text-base font-medium text-[#eef0f3] mb-1">Your workspace is empty</h2>
        <p className="text-sm text-[#888b96] mb-6 max-w-xs mx-auto">
          Create your first rundown or organise multiple rundowns inside an event folder.
        </p>
        <div className="flex items-center justify-center gap-3">
          <CreateEventDialog />
          <CreateRundownDialog events={allEvents} templates={templates} />
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Title row: heading + summary + segmented tabs */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[28px] font-bold text-[#eef0f3] tracking-[-0.02em] leading-none">Dashboard</h1>
          <div className="text-[13px] text-[#9ba0ab] mt-2">{summary}</div>
        </div>
        <div className="flex border border-[#22222a]">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] transition-colors',
                i < tabs.length - 1 && 'border-r border-[#22222a]',
                activeTab === tab.id ? 'bg-[#16161c] text-[#f0a838]' : 'text-[#9ba0ab] hover:text-[#c8c9d0]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'upcoming' && (
        <div>
          {renderEvents(upcoming, 'No upcoming events. Events without a date also appear here.')}
          {renderExtra()}
        </div>
      )}
      {activeTab === 'past' && <div>{renderEvents(past, 'No past events yet.')}</div>}
      {activeTab === 'archived' && <div>{renderEvents(archived, 'No archived events.')}</div>}
      {activeTab === 'all' && (
        <div className="space-y-11">
          {upcoming.length > 0 && (
            <section>
              <SectionHeading>Upcoming</SectionHeading>
              {renderEvents(upcoming, '')}
            </section>
          )}
          {past.length > 0 && (
            <section>
              <SectionHeading>Past</SectionHeading>
              {renderEvents(past, '')}
            </section>
          )}
          {archived.length > 0 && (
            <section>
              <SectionHeading>Archived</SectionHeading>
              {renderEvents(archived, '')}
            </section>
          )}
          {renderExtra()}
        </div>
      )}
    </div>
  )
}
