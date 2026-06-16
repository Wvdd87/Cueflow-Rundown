'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, MoreHorizontal, Pencil, Copy, Trash2, Check, X, FolderInput } from 'lucide-react'
import { renameRundown, deleteRundown, duplicateRundown, moveRundown } from '@/app/actions/rundowns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/StatusBadge'
import { toast } from 'sonner'
import type { Event, Rundown } from '@/lib/supabase/types'

interface RundownCardProps {
  rundown: Rundown
  allEvents?: Event[]
}

const MENU_ITEM =
  'gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

export function RundownCard({ rundown, allEvents = [] }: RundownCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(rundown.name)
  const [saving, setSaving] = useState(false)

  async function handleMove(eventId: string | null) {
    const result = await moveRundown(rundown.id, eventId)
    if (result.error) toast.error(result.error)
    else toast.success(eventId ? 'Moved to event' : 'Removed from event')
  }

  async function saveRename() {
    if (!name.trim() || name === rundown.name) {
      setRenaming(false)
      setName(rundown.name)
      return
    }
    setSaving(true)
    const result = await renameRundown(rundown.id, name)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      setName(rundown.name)
    }
    setRenaming(false)
  }

  async function handleDelete() {
    const result = await deleteRundown(rundown.id)
    if (result.error) toast.error(result.error)
    else toast.success('Rundown deleted')
  }

  async function handleDuplicate() {
    const result = await duplicateRundown(rundown.id)
    if (result.error) toast.error(result.error)
    else toast.success('Rundown duplicated')
  }

  const formattedDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="group relative flex items-center gap-3.5 px-[22px] py-3.5 border-b border-[#141419] hover:bg-[#111116] transition-colors">
      <FileText className="w-[15px] h-[15px] text-[#5a5c66] shrink-0" />

      <div className="flex-1 min-w-0">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') { setRenaming(false); setName(rundown.name) }
              }}
              className="flex-1 bg-[#16161c] border border-[#3a3a48] px-2 py-0.5 text-sm text-[#eef0f3] outline-none"
            />
            <button onClick={saveRename} disabled={saving} className="text-[#9ba0ab] hover:text-[#eef0f3]">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setRenaming(false); setName(rundown.name) }} className="text-[#9ba0ab] hover:text-[#eef0f3]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link href={`/rundown/${rundown.id}`} className="block">
            <p className="text-sm font-medium text-[#eef0f3] truncate">{rundown.name}</p>
            <div className="flex items-center gap-2.5 mt-1">
              <StatusBadge status={rundown.status} />
              {formattedDate && (
                <span className="font-mono text-[11.5px] text-[#888b96]">{formattedDate}</span>
              )}
            </div>
          </Link>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              data-testid="rundown-menu-btn"
              className="w-[30px] h-[30px] flex items-center justify-center opacity-0 group-hover:opacity-100 text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#1d1d24] transition-colors shrink-0"
            />
          }
        >
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-44 p-0">
          <DropdownMenuItem onClick={() => setRenaming(true)} className={MENU_ITEM}>
            <Pencil className="w-3.5 h-3.5 text-[#9ba0ab]" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} className={MENU_ITEM}>
            <Copy className="w-3.5 h-3.5 text-[#9ba0ab]" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={MENU_ITEM}>
              <FolderInput className="w-3.5 h-3.5 text-[#9ba0ab] shrink-0" /> Move to event
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] min-w-[160px] p-0">
              {rundown.event_id && (
                <>
                  <DropdownMenuItem onClick={() => handleMove(null)} className={MENU_ITEM}>
                    Remove from event
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#1d1d24]" />
                </>
              )}
              {allEvents.length === 0 ? (
                <DropdownMenuItem disabled className="px-3.5 py-2.5 text-[11px] text-[#5a5c66] cursor-default">
                  No events yet
                </DropdownMenuItem>
              ) : (
                allEvents.map((ev) => (
                  <DropdownMenuItem
                    key={ev.id}
                    onClick={() => handleMove(ev.id)}
                    disabled={ev.id === rundown.event_id}
                    className={MENU_ITEM}
                  >
                    {ev.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className="bg-[#1d1d24]" />
          <DropdownMenuItem
            data-testid="rundown-delete"
            onClick={handleDelete}
            className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[rgba(255,40,72,0.08)] focus:text-[#ff5a73] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
