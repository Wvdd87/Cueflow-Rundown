'use client'

import { useState } from 'react'
import { Folder, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { renameEvent, deleteEvent } from '@/app/actions/events'
import { Button } from '@/components/ui/button'
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
import type { Event, Rundown } from '@/lib/supabase/types'

interface EventCardProps {
  event: Event
  rundowns: Rundown[]
  allEvents: Event[]
}

export function EventCard({ event, rundowns, allEvents }: EventCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(event.name)
  const [saving, setSaving] = useState(false)

  async function saveRename() {
    if (!name.trim() || name === event.name) {
      setRenaming(false)
      setName(event.name)
      return
    }
    setSaving(true)
    const result = await renameEvent(event.id, name)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      setName(event.name)
    }
    setRenaming(false)
  }

  async function handleDelete() {
    const result = await deleteEvent(event.id)
    if (result.error) toast.error(result.error)
    else toast.success('Event deleted')
  }

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      {/* Event header */}
      <div className="group flex items-center gap-2 px-3 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
        >
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </button>

        <Folder className="w-4 h-4 text-zinc-500 shrink-0" />

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
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <button onClick={saveRename} disabled={saving} className="text-zinc-400 hover:text-white">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setRenaming(false); setName(event.name) }} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 text-left text-sm font-medium text-white truncate"
          >
            {event.name}
          </button>
        )}

        <span className="text-xs text-zinc-600 shrink-0">{rundowns.length}</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <CreateRundownDialog
            events={allEvents}
            defaultEventId={event.id}
            trigger={
              <Button variant="ghost" size="icon" className="w-6 h-6 text-zinc-400 hover:text-white hover:bg-zinc-800">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="w-6 h-6 text-zinc-400 hover:text-white hover:bg-zinc-800" />}
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-40">
              <DropdownMenuItem
                onClick={() => setRenaming(true)}
                className="gap-2 focus:bg-zinc-800 focus:text-white cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={handleDelete}
                className="gap-2 text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rundowns inside event */}
      {expanded && (
        <div className="p-2 space-y-1 bg-zinc-950/30">
          {rundowns.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-zinc-600">No rundowns yet</p>
              <CreateRundownDialog
                events={allEvents}
                defaultEventId={event.id}
                trigger={
                  <button className="text-xs text-zinc-500 hover:text-zinc-300 mt-1 transition-colors">
                    + Add rundown
                  </button>
                }
              />
            </div>
          ) : (
            rundowns.map((rundown) => (
              <RundownCard key={rundown.id} rundown={rundown} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
