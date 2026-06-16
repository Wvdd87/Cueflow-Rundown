'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Archive,
  ArchiveRestore,
  CalendarDays,
  MapPin,
} from 'lucide-react'
import { updateEvent, deleteEvent } from '@/app/actions/events'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RundownCard } from './RundownCard'
import { CreateRundownDialog } from './CreateRundownDialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Event, Rundown } from '@/lib/supabase/types'

interface EventCardProps {
  event: Event
  rundowns: Rundown[]
  allEvents: Event[]
}

const MENU_ITEM =
  'gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

export function EventCard({ event, rundowns, allEvents }: EventCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(event.name)
  const [saving, setSaving] = useState(false)

  const formattedDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  async function saveRename() {
    if (!name.trim() || name === event.name) {
      setRenaming(false)
      setName(event.name)
      return
    }
    setSaving(true)
    const result = await updateEvent(event.id, { name: name.trim() })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      setName(event.name)
    }
    setRenaming(false)
  }

  async function handleArchive() {
    const result = await updateEvent(event.id, { archived: !event.archived })
    if (result.error) toast.error(result.error)
    else toast.success(event.archived ? 'Event restored' : 'Event archived')
  }

  async function handleDelete() {
    const result = await deleteEvent(event.id)
    if (result.error) toast.error(result.error)
    else toast.success('Event deleted')
  }

  return (
    <div className={cn('border bg-[#0c0c11] overflow-hidden', event.archived ? 'border-[#1d1d24]/60 opacity-70' : 'border-[#1d1d24]')}>
      {/* Event header */}
      <div className="group flex items-center gap-4 px-[22px] py-[18px] border-b border-[#1d1d24]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[#5a5c66] hover:text-[#9ba0ab] transition-colors shrink-0"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {renaming ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') { setRenaming(false); setName(event.name) }
              }}
              className="flex-1 bg-[#16161c] border border-[#3a3a48] px-2 py-1 text-[15px] text-[#eef0f3] outline-none"
            />
            <button onClick={saveRename} disabled={saving} className="text-[#9ba0ab] hover:text-[#eef0f3]"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setRenaming(false); setName(event.name) }} className="text-[#9ba0ab] hover:text-[#eef0f3]"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <h3 className="text-[17px] font-semibold text-[#eef0f3] tracking-[-0.01em] truncate">{event.name}</h3>
            {(formattedDate || event.location) && (
              <div className="flex items-center gap-3.5 mt-1.5 text-[12.5px] text-[#9ba0ab]">
                {formattedDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3 text-[#888b96]" />
                    <span className="font-mono">{formattedDate}</span>
                  </span>
                )}
                {formattedDate && event.location && <span className="text-[#3a3a48]">·</span>}
                {event.location && (
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3 h-3 text-[#888b96] shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <span className="font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#888b96] shrink-0">
          {rundowns.length} rundown{rundowns.length === 1 ? '' : 's'}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <CreateRundownDialog
            events={allEvents}
            defaultEventId={event.id}
            trigger={
              <button className="w-7 h-7 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button className="w-7 h-7 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors" />}
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-44 p-0">
              <DropdownMenuItem onClick={() => setRenaming(true)} className={MENU_ITEM}>
                <Pencil className="w-3.5 h-3.5 text-[#9ba0ab]" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive} className={MENU_ITEM}>
                {event.archived
                  ? <><ArchiveRestore className="w-3.5 h-3.5 text-[#9ba0ab]" /> Restore from archive</>
                  : <><Archive className="w-3.5 h-3.5 text-[#9ba0ab]" /> Archive</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1d1d24]" />
              <DropdownMenuItem
                onClick={handleDelete}
                className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[rgba(255,40,72,0.08)] focus:text-[#ff5a73] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rundowns inside event */}
      {expanded && (
        <>
          {rundowns.length === 0 ? (
            <div className="px-[22px] py-5 text-[13px] text-[#888b96] italic">No rundowns yet.</div>
          ) : (
            rundowns.map((rundown) => (
              <RundownCard key={rundown.id} rundown={rundown} allEvents={allEvents} />
            ))
          )}
          <CreateRundownDialog
            events={allEvents}
            defaultEventId={event.id}
            trigger={
              <button className="flex items-center gap-2 w-full px-[22px] py-3 border-t border-[#1d1d24] font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#f0a838] transition-colors">
                <Plus className="w-3 h-3" /> New rundown
              </button>
            }
          />
        </>
      )}
    </div>
  )
}
