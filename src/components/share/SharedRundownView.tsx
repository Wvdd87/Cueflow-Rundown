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
import { GripVertical, EyeOff, Eye, MoreHorizontal, Lock } from 'lucide-react'
import { upsertSharePrivateNote } from '@/app/actions/sharePrivateNotes'
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
const DEFAULT_TITLE_WIDTH = 240

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

export function SharedRundownView({
  data,
  token,
  initialPrivateNotes = {},
}: {
  data: SharedData
  token: string
  initialPrivateNotes?: Record<string, string>
}) {
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
  const [titleWidth, setTitleWidth] = useState<number>(() =>
    loadJson(lsKey(rundown.id, 'titleWidth'), DEFAULT_TITLE_WIDTH)
  )
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    () => new Set(loadJson<string[]>(lsKey(rundown.id, 'hiddenCols'), []))
  )
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>(initialPrivateNotes)
  const [myNotesWidth, setMyNotesWidth] = useState<number>(() =>
    loadJson(lsKey(rundown.id, 'myNotesWidth'), 200)
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
    localStorage.setItem(lsKey(rundown.id, 'titleWidth'), JSON.stringify(titleWidth))
  }, [titleWidth, rundown.id])

  useEffect(() => {
    localStorage.setItem(lsKey(rundown.id, 'hiddenCols'), JSON.stringify([...hiddenCols]))
  }, [hiddenCols, rundown.id])

  useEffect(() => {
    localStorage.setItem(lsKey(rundown.id, 'myNotesWidth'), JSON.stringify(myNotesWidth))
  }, [myNotesWidth, rundown.id])

  const handleNoteChange = useCallback((cueId: string, value: string) => {
    setPrivateNotes((prev) => ({ ...prev, [cueId]: value }))
    upsertSharePrivateNote(token, cueId, value)
  }, [token])

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

  // Resize dynamic column — use DOM refs during drag to avoid re-renders on every pixel
  const colResizeRef = useRef<{ id: string; startX: number; startW: number; els: HTMLElement[] } | null>(null)

  function startColResize(e: React.MouseEvent, col: Column) {
    e.preventDefault()
    e.stopPropagation()
    const startW = localWidths[col.id] ?? col.width
    // Collect all cells and the header for this column so we can update their widths via DOM
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-share-col="${col.id}"]`))
    colResizeRef.current = { id: col.id, startX: e.clientX, startW, els }

    function onMove(ev: MouseEvent) {
      if (!colResizeRef.current) return
      const w = Math.max(MIN_COL_WIDTH, colResizeRef.current.startW + (ev.clientX - colResizeRef.current.startX))
      for (const el of colResizeRef.current.els) {
        el.style.width = `${w}px`
      }
    }
    function onUp(ev: MouseEvent) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!colResizeRef.current) return
      const w = Math.max(MIN_COL_WIDTH, colResizeRef.current.startW + (ev.clientX - colResizeRef.current.startX))
      setLocalWidths((prev) => ({ ...prev, [col.id]: w }))
      colResizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Resize title column
  const titleResizeRef = useRef<{ startX: number; startW: number; els: HTMLElement[] } | null>(null)

  function startTitleResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-share-title-col]'))
    titleResizeRef.current = { startX: e.clientX, startW: titleWidth, els }

    function onMove(ev: MouseEvent) {
      if (!titleResizeRef.current) return
      const w = Math.max(MIN_COL_WIDTH, titleResizeRef.current.startW + (ev.clientX - titleResizeRef.current.startX))
      for (const el of titleResizeRef.current.els) {
        el.style.width = `${w}px`
      }
    }
    function onUp(ev: MouseEvent) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!titleResizeRef.current) return
      const w = Math.max(MIN_COL_WIDTH, titleResizeRef.current.startW + (ev.clientX - titleResizeRef.current.startX))
      setTitleWidth(w)
      titleResizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Resize My Notes column
  function startMyNotesResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = myNotesWidth
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-share-notes-col]'))

    function onMove(ev: MouseEvent) {
      const w = Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX))
      for (const el of els) el.style.width = `${w}px`
    }
    function onUp(ev: MouseEvent) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setMyNotesWidth(Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX)))
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
            data-share-col={col.id}
            style={{ width: w }}
            className="shrink-0 border-l border-[#1d1d24] px-2 py-2"
          >
            {raw ? (
              <span
                className="text-[12.5px] px-2.5 py-[5px] text-white font-semibold"
                style={{ backgroundColor: color ?? 'rgba(63,63,70,0.85)' }}
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
          data-share-col={col.id}
          style={{ width: w }}
          className="shrink-0 border-l border-[#1d1d24] px-3 py-2"
        >
          <div
            className="tiptap-cell text-[13px] text-[#c8c9d0] break-words [overflow-wrap:anywhere]"
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
          'flex items-stretch border-b border-[#1d1d24]',
          isActive ? 'bg-[#16161c]/60' : '',
          depth > 0 && 'border-l-2 border-[#3a3a48]'
        )}
        style={{ minHeight: 56 }}
      >
        <div className="w-14 shrink-0 flex items-start justify-center px-2 pt-3">
          <span
            className={cn('font-mono text-sm font-bold tabular-nums px-2', isActive && 'bg-[#ff2848] text-white')}
            style={!isActive ? { color: '#9ba0ab' } : undefined}
          >
            {number}
          </span>
        </div>
        <div className="w-[110px] shrink-0 flex items-start gap-1 px-3.5 pt-3 text-[13px] font-mono tabular-nums text-[#c8c9d0]">
          {formatMsToTimeDisplay(t?.calculated_start_ms ?? 0, rundown.time_display ?? 'auto')}
          {cue.start_type === 'hard' && <span className="-rotate-45 inline-block text-[#eef0f3]">⚲</span>}
        </div>
        <div className="w-[104px] shrink-0 flex items-start px-3.5 pt-3 text-[15px] font-mono font-semibold tabular-nums text-[#eef0f3]">
          {formatDuration(cue.duration_ms)}
        </div>
        {/* Title — resizable, matches header width */}
        <div
          data-share-title-col
          style={{ width: titleWidth }}
          className="shrink-0 flex flex-col px-4 pt-3 pb-2 min-w-0"
        >
          <span className="text-[16px] font-medium text-[#eef0f3] break-words [overflow-wrap:anywhere] leading-[1.35]">
            {cue.title || <span className="text-[#6b6d78] italic">Untitled</span>}
          </span>
          {cue.subtitle && <span className="text-xs text-[#9ba0ab] break-words [overflow-wrap:anywhere] mt-0.5">{cue.subtitle}</span>}
        </div>
        {renderCells(cue.id)}
        <div
          data-share-notes-col
          className="shrink-0 border-l border-[#f0a838]/25 px-2 py-2"
          style={{ width: myNotesWidth }}
        >
          <SharePrivateNoteCell
            cueId={cue.id}
            value={privateNotes[cue.id] ?? ''}
            onChange={handleNoteChange}
          />
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090d] text-[#c8c9d0] font-sans">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-6 h-14 border-b border-[#1d1d24] bg-[#07070a]">
        <div className="w-[30px] h-[30px] bg-[#f0a838] flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06060a" strokeWidth="2.5" strokeLinecap="square">
            <line x1="7" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="20" y2="12" /><line x1="7" y1="18" x2="20" y2="18" />
            <line x1="3" y1="6" x2="3" y2="6" strokeLinecap="round" strokeWidth="3.2" />
            <line x1="3" y1="12" x2="3" y2="12" strokeLinecap="round" strokeWidth="3.2" />
            <line x1="3" y1="18" x2="3" y2="18" strokeLinecap="round" strokeWidth="3.2" />
          </svg>
        </div>
        <h1 className="font-semibold text-[15px] text-[#eef0f3] truncate">{rundown.name}</h1>
        <StatusBadge status={rundown.status} />
        {live.status === 'running' && (
          <span className="flex items-center gap-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff4663]">
            <span className="live-dot w-[7px] h-[7px] rounded-full bg-[#ff2848]" /> Live
          </span>
        )}
        {showDate && <span className="font-mono text-xs text-[#888b96] ml-auto">{showDate}</span>}
        <span className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#888b96] border border-[#2e2e38] px-2 py-0.5 ml-2">
          Read-only
        </span>
      </header>

      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className="flex items-stretch border-b border-[#22222a] bg-[#0b0b10] select-none h-[34px]">
          <div className="w-14 shrink-0 px-2 flex items-center justify-center font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c7e8a]">#</div>
          <div className="w-[110px] shrink-0 px-3.5 flex items-center font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c7e8a]">Start</div>
          <div className="w-[104px] shrink-0 px-3.5 flex items-center font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c7e8a]">Dur.</div>

          {/* Title — resizable */}
          <div
            data-share-title-col
            style={{ width: titleWidth }}
            className="group/title relative shrink-0 px-4 flex items-center font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c7e8a]"
          >
            Title
            <div
              onMouseDown={startTitleResize}
              title="Drag to resize"
              className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#f0a838]/40 transition-colors"
            />
          </div>

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
                  onResizeStart={(e) => startColResize(e, col)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Show-all button when columns are hidden */}
          {hiddenCount > 0 && (
            <div className="shrink-0 flex items-center border-l border-[#22222a] px-1">
              <button
                onClick={unhideAll}
                title={`Show ${hiddenCount} hidden column${hiddenCount > 1 ? 's' : ''}`}
                className="p-1 text-[#888b96] hover:text-[#c8c9d0] transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* My Notes column header */}
          <div
            data-share-notes-col
            className="group/notes relative shrink-0 flex items-center gap-1.5 border-l border-[#f0a838]/25 px-3.5"
            style={{ width: myNotesWidth }}
          >
            <Lock className="w-3 h-3 text-[#f0a838]/70 shrink-0" />
            <span className="font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#f0a838]/70 truncate">
              My Notes
            </span>
            <div
              onMouseDown={startMyNotesResize}
              title="Drag to resize"
              className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#f0a838]/40 transition-colors"
            />
          </div>
        </div>

        {/* Rows */}
        {layout.items.map((item) => {
          if (item.type === 'group') {
            const dur = item.children.reduce((s, c) => s + c.duration_ms, 0)
            return (
              <div key={item.heading.id}>
                <div className="flex items-stretch border-b border-[#22222a]" style={{ minHeight: 56, background: '#1a1a20' }}>
                  <div className="w-14 shrink-0 flex items-center justify-center px-2 font-mono text-sm font-bold text-[#9ba0ab]">
                    {formatCueNumber(
                      item.number,
                      rundown.cue_number_prefix ?? '',
                      rundown.cue_number_start ?? 1,
                      rundown.cue_number_digits ?? 1
                    )}
                  </div>
                  <div className="grow flex items-center gap-3 px-3 py-2">
                    <span className="text-[15px] font-semibold text-[#eef0f3]">{item.heading.title || 'Group'}</span>
                    <span className="text-[11px] font-mono text-[#888b96]">{formatDuration(dur)}</span>
                  </div>
                  <div data-share-notes-col className="shrink-0 border-l border-[#f0a838]/25" style={{ width: myNotesWidth }} />
                </div>
                {item.children.map((ch) => cueRow(ch, layout.numberOf[ch.id] ?? '', 1))}
              </div>
            )
          }
          return cueRow(item.cue, item.number, 0)
        })}

        {cues.length === 0 && (
          <p className="text-sm text-[#5a5c66] py-12 text-center">This rundown has no cues yet.</p>
        )}
      </div>
    </div>
  )
}

// ── Private note cell ─────────────────────────────────────────────────────

interface SharePrivateNoteCellProps {
  cueId: string
  value: string
  onChange: (cueId: string, value: string) => void
}

function SharePrivateNoteCell({ cueId, value, onChange }: SharePrivateNoteCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.focus()
    }
  }, [editing])

  function save() {
    setEditing(false)
    if (draft !== value) onChange(cueId, draft)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const el = e.target
          el.style.height = 'auto'
          el.style.height = el.scrollHeight + 'px'
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
        }}
        rows={1}
        className="w-full min-h-[28px] resize-none bg-[#0a0a0d] border border-[#f0a838] px-2 py-1 text-[13px] text-[#eef0f3] outline-none"
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="w-full min-h-[28px] px-2 py-1 text-[13px] cursor-text whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-[1.4]"
      style={{ color: value ? '#e8c98a' : '#5a5c66', fontStyle: value ? 'normal' : 'italic' }}
    >
      {value || 'Private note…'}
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
      data-share-col={col.id}
      style={style}
      className="group/col relative shrink-0 flex items-center border-l border-[#22222a] px-3.5"
    >
      {/* Drag grip */}
      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="opacity-0 group-hover/col:opacity-100 transition-opacity text-[#5a5c66] hover:text-[#9ba0ab] cursor-grab active:cursor-grabbing -ml-1.5 mr-0.5"
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <span className="flex-1 font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c7e8a] truncate">
        {col.name}
      </span>

      {/* Hide column menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 text-[#9ba0ab] hover:text-[#eef0f3]"
            />
          }
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-36 p-0">
          <DropdownMenuItem
            onClick={onHide}
            className="gap-2 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer"
          >
            <EyeOff className="w-3 h-3 text-[#9ba0ab]" /> Hide for me
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#f0a838]/40 transition-colors"
      />
    </div>
  )
}
