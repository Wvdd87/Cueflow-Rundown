'use client'

import { useState, useEffect } from 'react'
import {
  GripVertical,
  Settings,
  Check,
  ChevronDown,
  ChevronRight,
  Ungroup,
  Trash2,
  AlignLeft,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateCue } from '@/app/actions/cues'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMsToTime } from '@/lib/timing'
import { cn } from '@/lib/utils'
import type { Cue } from '@/lib/supabase/types'

function formatLong(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

interface GroupHeaderRowProps {
  heading: Cue
  number: string
  rundownId: string
  aggregate: { durationMs: number; startMs: number; endMs: number; count: number }
  collapsed: boolean
  selected: boolean
  onToggleCollapse: () => void
  onSelect: (id: string, mods: { shift: boolean; meta: boolean }) => void
  onUpdate: (id: string, updates: Partial<Cue>) => void
  onUngroup: (id: string) => void
  onDelete: (id: string) => void
  onConvertToCue?: (id: string) => void
}

export function GroupHeaderRow({
  heading,
  number,
  rundownId,
  aggregate,
  collapsed,
  selected,
  onToggleCollapse,
  onSelect,
  onUpdate,
  onUngroup,
  onDelete,
  onConvertToCue,
}: GroupHeaderRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(heading.title || 'New group')

  useEffect(() => {
    setTitle(heading.title || 'New group')
  }, [heading.title])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: heading.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function saveTitle() {
    setEditing(false)
    const t = title.trim() || 'New group'
    if (t === heading.title) return
    onUpdate(heading.id, { title: t })
    await updateCue(heading.id, rundownId, { title: t })
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch min-h-[44px]" data-cue-id={heading.id}>
      {/* Column 1: drag / settings / select */}
      <div className="w-10 shrink-0 relative flex items-center justify-center group/col1">
        <button
          {...attributes}
          {...listeners}
          title="Drag to reorder group"
          className="absolute top-1 left-1/2 -translate-x-1/2 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing opacity-0 group-hover/col1:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                title="Group options"
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
              />
            }
          >
            <Settings className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-44">
            {aggregate.count > 0 && (
              <DropdownMenuItem
                onClick={() => onUngroup(heading.id)}
                className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
              >
                <Ungroup className="w-3.5 h-3.5" /> Ungroup
              </DropdownMenuItem>
            )}
            {aggregate.count === 0 && onConvertToCue && (
              <DropdownMenuItem
                onClick={() => onConvertToCue(heading.id)}
                className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
              >
                <AlignLeft className="w-3.5 h-3.5" /> Convert to cue
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuItem
              onClick={() => onDelete(heading.id)}
              className="gap-2 text-xs text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={(e) => onSelect(heading.id, { shift: e.shiftKey, meta: true })}
          title="Select group"
          className={cn(
            'absolute bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-all',
            selected
              ? 'opacity-100 bg-emerald-600 border-emerald-600'
              : 'opacity-0 group-hover/col1:opacity-100 border-zinc-600 hover:border-zinc-400'
          )}
        >
          {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </button>
      </div>

      {/* Number (click to select the group) */}
      <div className="w-12 shrink-0 flex items-center">
        <span
          onClick={(e) =>
            onSelect(heading.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
          }
          title="Click to select group"
          className={cn(
            'text-xs px-2 rounded font-medium cursor-pointer transition-colors',
            selected ? 'text-white bg-zinc-700' : 'text-zinc-400 hover:text-zinc-200'
          )}
        >
          {number}
        </span>
      </div>

      {/* Group band */}
      <div
        className={cn(
          'grow min-w-0 my-1 mr-1 rounded-md px-3 py-1.5 flex items-center gap-3',
          selected ? 'bg-emerald-900/40' : 'bg-zinc-700/50'
        )}
      >
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') { setEditing(false); setTitle(heading.title || 'New group') }
              }}
              className="w-full bg-transparent text-sm font-semibold text-white outline-none border-b border-zinc-500"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-white text-left truncate w-full"
            >
              {heading.title || 'New group'}
            </button>
          )}
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
            <span>{formatLong(aggregate.durationMs)}</span>
            {aggregate.count > 0 && (
              <span className="text-zinc-500">
                {formatMsToTime(aggregate.startMs)} → {formatMsToTime(aggregate.endMs)}
              </span>
            )}
          </div>
        </div>

        <button
          data-testid="group-collapse"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand group' : 'Collapse group'}
          className="shrink-0 text-zinc-400 hover:text-white transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  )
}
