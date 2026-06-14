'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { buildCueLayout } from '@/components/rundown/cueTree'
import { useLiveSubscription } from '@/components/rundown/liveSync'
import {
  calculateTimings,
  formatMsToTimeDisplay,
  formatDuration,
  type CueTimingOutput,
} from '@/lib/timing'
import { formatCueNumber } from '@/components/rundown/cueTree'
import { resolveVariablesHtml } from '@/lib/cellHtml'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import type { Rundown, Column, Cue, Cell, Variable } from '@/lib/supabase/types'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, EyeOff, Eye, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface SharedData {
  rundown: Rundown
  columns: Column[]
  cues: Cue[]
  cells: Cell[]
  variables: Variable[]
}

const MIN_COL_WIDTH = 80

function lsKey(rundownId: string, what: string) {
  return `share:${rundownId}:${what}`
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function SharedRundownView({ data }: { data: SharedData }) {
  const { rundown, columns = [], cues = [], cells = [], variables = [] } = data
  const live = useLiveSubscription(rundown.id)
  const activeRowRef = useRef<HTMLDivElement>(null)

  // ── Per-viewer column state (localStorage only) ──────────────────────────
  const [localOrder, setLocalOrder] = useState<string[]>(() =>
    loadJson(lsKey(rundown.id, 'colOrder'), columns.map((c) => c.id))
  )
  const [localWidths, setLocalWidths] = useState<Record<string, number>>(() =>
    loadJson(lsKey(rundown.id, 'colWidths'), Object.fromEntries(columns.map((c) => [c.id, c.width])))
  )
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    () => new Set(loadJson<string[]>(lsKey(rundown.id, 'hiddenCols'), []))
  )

  // Keep localOrder in sync when the operator adds/removes columns
  useEffect(() => {
    const serverIds = columns.map((c) => c.id)
    setLocalOrder((prev) => {
      const filtered = prev.filter((id) => serverIds.includes(id))
      const added = serverIds.filter((id) => !prev.includes(id))
      return [...filtered, ...added]
    })
  }, [columns])

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(lsKey(rundown.id, 'colOrder'), JSON.stringify(localOrder))
  }, [localOrder, rundown.id])

  useEffect(() => {
    localStorage.setItem(lsKey(rundown.id, 'colWidths'), JSON.stringify(localWidths))
  }, [localWidths, rundown.id])

  useEffect(() => {
    localStorage.setItem(lsKey(rundown.id, 'hiddenCols'), JSON.stringify([...hiddenCols]))
  }, [hiddenCols, rundown.id])

  // ── Derived ───────────────────────────────────────────────────────────────
  const varMap = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.key, v.value])),
    [variables]
  )
  const cellMap = useMemo(
    () =>
      Object.fromEntries(
        cells.map((c) => [`${c.cue_id}:${c.column_id}`, c.content ?? ''])
      ),
    [cells]
  )
  const layout = useMemo(() => buildCueLayout(cues), [cues])
  const timedMap = useMemo(() => {
    const timed = calculateTimings(layout.docOrder)
    return Object.fromEntries(timed.map((t) => [t.id, t])) as Record<string, CueTimingOutput>
  }, [layout])

  // Ordered visible columns for rendering
  const visibleColumns = useMemo(() => {
    return localOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is Column => !!c && !hiddenCols.has(c.id))
  }, [localOrder, columns, hiddenCols])

  const hiddenCount = hiddenCols.size

  // ── Scroll active cue into view ───────────────────────────────────────────
  useEffect(() => {
    if (live.activeCueId) {
      activeRowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [live.activeCueId])

  // ── Column interactions ───────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string)
      const newIdx = prev.indexOf(over.id as string)
      if (oldIdx < 0 || newIdx < 0) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const resizeRef = useRef<{ id: string; width: number } | null>(null)
  function startResize(e: React.MouseEvent, col: Column) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = localWidths[col.id] ?? col.width
    function onMove(ev: MouseEvent) {
      const w = Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX))
      resizeRef.current = { id: col.id, width: w }
      setLocalWidths((prev) => ({ ...prev, [col.id]: w }))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function toggleHide(id: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function unhideAll() {
    setHiddenCols(new Set())
  }

  // ── Cell rendering ────────────────────────────────────────────────────────
  function renderCells(cueId: string) {
    return visibleColumns.map((col) => {
      const raw = cellMap[`${cueId}:${col.id}`] ?? ''
      const w = localWidths[col.id] ?? col.width
      if (col.col_type === 'dropdown') {
        const color = col.option_colors?.[raw]
        return (
          <div
            key={col.id}
            style={{ width: w }}
            className="shrink-0 border-l border-zinc-800/60 px-2 py-1.5"
          >
            {raw ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded text-zinc-100 font-medium"
                style={{ backgroundColor: color ?? 'rgba(63,63,70,0.7)' }}
              >
                {raw}
              </span>
            ) : null}
          </div>
        )
      }
      return (
        <div
          key={col.id}
          style={{ width: w }}
          className="shrink-0 border-l border-zinc-800/60 px-2 py-1.5"
        >
          <div
            className="tiptap-cell text-sm text-zinc-300 break-words"
            dangerouslySetInnerHTML={{ __html: resolveVariablesHtml(raw, varMap) }}
          />
        </div>
      )
    })
  }

  // ── Row rendering ─────────────────────────────────────────────────────────
  const showDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  function cueRow(cue: Cue, rawNumber: string, depth: number) {
    const number = formatCueNumber(
      rawNumber,
      rundown.cue_number_prefix ?? '',
      rundown.cue_number_start ?? 1,
      rundown.cue_number_digits ?? 1
    )
    const t = timedMap[cue.id]
    const isActive = live.activeCueId === cue.id
    return (
      <div
        key={cue.id}
        ref={isActive ? activeRowRef : undefined}
        className={cn(
          'flex items-stretch min-h-[40px] border-b border-zinc-800/60',
          isActive ? 'bg-emerald-950/40' : '',
          depth > 0 && 'border-l-2 border-zinc-700/70 bg-zinc-900/20'
        )}
      >
        <div className="w-12 shrink-0 flex items-center px-2">
          <span
            className={cn(
              'text-xs px-2 rounded tabular-nums',
              isActive ? 'bg-emerald-600 text-white' : 'text-zinc-400'
            )}
          >
            {number}
          </span>
        </div>
        <div className="w-[84px] shrink-0 flex items-center px-2 text-xs font-mono tabular-nums text-zinc-400">
          {cue.start_type === 'hard' ? '⚑ ' : ''}
          {formatMsToTimeDisplay(t?.calculated_start_ms ?? 0, rundown.time_display ?? 'auto')}
        </div>
        <div className="w-[76px] shrink-0 flex items-center px-2 text-xs font-mono tabular-nums text-zinc-400">
          {formatDuration(cue.duration_ms)}
        </div>
        <div className="w-[240px] grow min-w-0 flex flex-col justify-center px-3 py-1.5">
          <span className="text-sm text-white break-words">
            {cue.title || <span className="text-zinc-600 italic">Untitled</span>}
          </span>
          {cue.subtitle && <span className="text-xs text-zinc-500 break-words">{cue.subtitle}</span>}
        </div>
        {renderCells(cue.id)}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-6 h-14 border-b border-zinc-800 bg-zinc-950">
        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0">
          <span className="text-zinc-900 font-bold text-xs">R</span>
        </div>
        <h1 className="font-semibold text-sm truncate">{rundown.name}</h1>
        <StatusBadge status={rundown.status} />
        {live.status === 'running' && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live
          </span>
        )}
        {showDate && <span className="text-xs text-zinc-500 ml-auto">{showDate}</span>}
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 ml-2">
          Read-only
        </span>
      </header>

      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className="flex items-stretch border-b border-zinc-800 bg-zinc-900/60 select-none">
          <div className="w-12 shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">#</div>
          <div className="w-[84px] shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Start</div>
          <div className="w-[76px] shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Dur.</div>
          <div className="w-[240px] grow px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Title</div>

          {/* Draggable dynamic column headers */}
          <DndContext
            id="share-col-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localOrder.filter((id) => !hiddenCols.has(id))}
              strategy={horizontalListSortingStrategy}
            >
              {visibleColumns.map((col) => (
                <ShareColumnHeader
                  key={col.id}
                  col={col}
                  width={localWidths[col.id] ?? col.width}
                  onHide={() => toggleHide(col.id)}
                  onResizeStart={(e) => startResize(e, col)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Show-all button when columns are hidden */}
          {hiddenCount > 0 && (
            <div className="shrink-0 flex items-center border-l border-zinc-800 px-1">
              <button
                onClick={unhideAll}
                title={`Show ${hiddenCount} hidden column${hiddenCount > 1 ? 's' : ''}`}
                className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Rows */}
        {layout.items.map((item) => {
          if (item.type === 'group') {
            const dur = item.children.reduce((s, c) => s + c.duration_ms, 0)
            return (
              <div key={item.heading.id}>
                <div className="flex items-stretch min-h-[40px] bg-zinc-800/40 border-b border-zinc-800">
                  <div className="w-12 shrink-0 flex items-center px-2 text-xs text-zinc-400">
                    {formatCueNumber(
                      item.number,
                      rundown.cue_number_prefix ?? '',
                      rundown.cue_number_start ?? 1,
                      rundown.cue_number_digits ?? 1
                    )}
                  </div>
                  <div className="grow flex items-center gap-3 px-3 py-2">
                    <span className="text-sm font-semibold text-white">{item.heading.title || 'Group'}</span>
                    <span className="text-[11px] font-mono text-zinc-500">{formatDuration(dur)}</span>
                  </div>
                </div>
                {item.children.map((ch) => cueRow(ch, layout.numberOf[ch.id] ?? '', 1))}
              </div>
            )
          }
          return cueRow(item.cue, item.number, 0)
        })}

        {cues.length === 0 && (
          <p className="text-sm text-zinc-600 py-12 text-center">This rundown has no cues yet.</p>
        )}
      </div>
    </div>
  )
}

// ── Sortable column header for share view ─────────────────────────────────

interface ShareColumnHeaderProps {
  col: Column
  width: number
  onHide: () => void
  onResizeStart: (e: React.MouseEvent) => void
}

function ShareColumnHeader({ col, width, onHide, onResizeStart }: ShareColumnHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id })

  const style = {
    width,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/col relative shrink-0 flex items-center border-l border-zinc-800 px-2"
    >
      {/* Drag grip */}
      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="opacity-0 group-hover/col:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing -ml-1 mr-0.5"
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <span className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider truncate">
        {col.name}
      </span>

      {/* Hide column menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 rounded text-zinc-500 hover:text-zinc-300"
            />
          }
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-36">
          <DropdownMenuItem
            onClick={onHide}
            className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
          >
            <EyeOff className="w-3 h-3" /> Hide for me
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/60 transition-colors"
      />
    </div>
  )
}
