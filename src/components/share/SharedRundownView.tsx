'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { buildCueLayout, formatCueNumber } from '@/components/rundown/cueTree'
import { useLiveSubscription, type LiveSyncState } from '@/components/rundown/liveSync'
import {
  calculateTimings,
  formatMsToTimeDisplay,
  formatDuration,
  type CueTimingOutput,
} from '@/lib/timing'
import { resolveVariablesHtml, resolveMentionsHtml, parseDropdownValues } from '@/lib/cellHtml'
import { CF, textOn } from '@/components/rundown/layout'
import { RichNoteCell } from '@/components/rundown/RichNoteCell'
import { RundownSearch, type SearchCue } from '@/components/rundown/RundownSearch'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import type { Rundown, Column, Cue, Cell, Variable, Mention } from '@/lib/supabase/types'
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
import {
  GripVertical,
  EyeOff,
  Eye,
  MoreHorizontal,
  Lock,
  ChevronDown,
  ChevronRight,
  Pin,
  LocateFixed,
  Locate,
  ArrowUpToLine,
} from 'lucide-react'
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
  mentions?: Mention[]
}

const MIN_COL_WIDTH = CF.minColWidth
const DEFAULT_TITLE_WIDTH = 260
const LABEL = 'font-cond text-[9px] font-bold uppercase tracking-[0.18em]'

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
  const { rundown, columns = [], cues = [], cells = [], variables = [], mentions = [] } = data
  const live = useLiveSubscription(rundown.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLDivElement>(null)

  // ── Per-viewer column state ──────────────────────────────────────────────
  // Start at deterministic defaults (so the first client render matches the
  // server) and hydrate from localStorage after mount — avoids hydration
  // mismatches when a viewer has resized/hidden/reordered columns.
  const [localOrder, setLocalOrder] = useState<string[]>(() => columns.map((c) => c.id))
  const [localWidths, setLocalWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.id, c.width]))
  )
  const [titleWidth, setTitleWidth] = useState<number>(DEFAULT_TITLE_WIDTH)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>(initialPrivateNotes)
  const [myNotesWidth, setMyNotesWidth] = useState<number>(CF.pn)
  const [hydrated, setHydrated] = useState(false)

  // ── Live follow ("keep the current cue pinned to the top") ─────────────────
  // Viewers can break away to take notes elsewhere without being yanked back;
  // following auto-pauses on manual scroll and re-engages from the toggle/pill.
  const isLive = live.status === 'running' || live.status === 'paused'
  const [following, setFollowing] = useState(true)
  const programmaticScrollRef = useRef(false)

  // Hydrate per-viewer state from localStorage after mount.
  useEffect(() => {
    const serverIds = columns.map((c) => c.id)
    const storedOrder = loadJson<string[] | null>(lsKey(rundown.id, 'colOrder'), null)
    if (storedOrder) {
      const filtered = storedOrder.filter((id) => serverIds.includes(id))
      const added = serverIds.filter((id) => !storedOrder.includes(id))
      setLocalOrder([...filtered, ...added])
    }
    const storedWidths = loadJson<Record<string, number> | null>(lsKey(rundown.id, 'colWidths'), null)
    if (storedWidths) setLocalWidths((prev) => ({ ...prev, ...storedWidths }))
    const tw = loadJson<number | null>(lsKey(rundown.id, 'titleWidth'), null)
    if (typeof tw === 'number') setTitleWidth(tw)
    setHiddenCols(new Set(loadJson<string[]>(lsKey(rundown.id, 'hiddenCols'), [])))
    setCollapsed(new Set(loadJson<string[]>(lsKey(rundown.id, 'collapsed'), [])))
    const nw = loadJson<number | null>(lsKey(rundown.id, 'myNotesWidth'), null)
    if (typeof nw === 'number') setMyNotesWidth(nw)
    setHydrated(true)
  }, [rundown.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep localOrder in sync when the operator adds/removes columns
  useEffect(() => {
    const serverIds = columns.map((c) => c.id)
    setLocalOrder((prev) => {
      const filtered = prev.filter((id) => serverIds.includes(id))
      const added = serverIds.filter((id) => !prev.includes(id))
      return [...filtered, ...added]
    })
  }, [columns])

  // Persist to localStorage (only after hydration, so defaults never clobber)
  useEffect(() => { if (hydrated) localStorage.setItem(lsKey(rundown.id, 'colOrder'), JSON.stringify(localOrder)) }, [localOrder, rundown.id, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem(lsKey(rundown.id, 'colWidths'), JSON.stringify(localWidths)) }, [localWidths, rundown.id, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem(lsKey(rundown.id, 'titleWidth'), JSON.stringify(titleWidth)) }, [titleWidth, rundown.id, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem(lsKey(rundown.id, 'hiddenCols'), JSON.stringify([...hiddenCols])) }, [hiddenCols, rundown.id, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem(lsKey(rundown.id, 'collapsed'), JSON.stringify([...collapsed])) }, [collapsed, rundown.id, hydrated])
  useEffect(() => { if (hydrated) localStorage.setItem(lsKey(rundown.id, 'myNotesWidth'), JSON.stringify(myNotesWidth)) }, [myNotesWidth, rundown.id, hydrated])

  const handleNoteChange = useCallback((cueId: string, value: string) => {
    setPrivateNotes((prev) => ({ ...prev, [cueId]: value }))
    upsertSharePrivateNote(token, cueId, value)
  }, [token])

  // ── Derived ───────────────────────────────────────────────────────────────
  const varMap = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.key, v.value])),
    [variables]
  )
  const mentionMap = useMemo(
    () => Object.fromEntries(mentions.map((m) => [m.id, m])),
    [mentions]
  )
  const cellMap = useMemo(
    () => Object.fromEntries(cells.map((c) => [`${c.cue_id}:${c.column_id}`, c.content ?? ''])),
    [cells]
  )
  const layout = useMemo(() => buildCueLayout(cues), [cues])
  const timedMap = useMemo(() => {
    const timed = calculateTimings(layout.docOrder)
    return Object.fromEntries(timed.map((t) => [t.id, t])) as Record<string, CueTimingOutput>
  }, [layout])

  const visibleColumns = useMemo(
    () => localOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is Column => !!c && !hiddenCols.has(c.id)),
    [localOrder, columns, hiddenCols]
  )
  const hiddenCount = hiddenCols.size

  // Total width of a cue row (gutter + all tiles + gaps + padding). Group/heading
  // bands use this as an explicit width so they end at the My Notes edge instead
  // of stretching to the full container width.
  const rowWidth = useMemo(() => {
    const colW = visibleColumns.reduce((s, c) => s + (localWidths[c.id] ?? c.width), 0)
    return (
      CF.rowPad * 2 +
      CF.c1 + CF.num + CF.start + CF.dur + titleWidth + colW + myNotesWidth +
      (5 + visibleColumns.length) * CF.gap
    )
  }, [visibleColumns, localWidths, titleWidth, myNotesWidth])

  // Search index
  const searchCues = useMemo<SearchCue[]>(() => {
    const out: SearchCue[] = []
    for (const item of layout.items) {
      if (item.type === 'group') {
        out.push({ id: item.heading.id, displayNumber: fmtNum(item.number, rundown), title: item.heading.title, cue_type: 'heading' })
        for (const ch of item.children) out.push({ id: ch.id, displayNumber: fmtNum(layout.numberOf[ch.id] ?? '', rundown), title: ch.title, cue_type: 'cue' })
      } else {
        out.push({ id: item.cue.id, displayNumber: fmtNum(item.number, rundown), title: item.cue.title, cue_type: item.cue.cue_type as 'cue' | 'heading' })
      }
    }
    return out
  }, [layout, rundown])

  // Scroll a row to just below the sticky header. Flags the scroll as
  // programmatic so the manual-scroll watcher doesn't mistake it for the viewer.
  const scrollRowToTop = useCallback((el: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
    const cont = scrollRef.current
    if (!cont) return
    const cr = cont.getBoundingClientRect()
    const rr = el.getBoundingClientRect()
    programmaticScrollRef.current = true
    cont.scrollTo({ top: cont.scrollTop + (rr.top - cr.top) - (CF.headerH + 8), behavior })
    setTimeout(() => { programmaticScrollRef.current = false }, 700)
  }, [])

  const scrollToCue = useCallback((cueId: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-cue-id="${cueId}"]`)
    if (!el) return
    // Jumping somewhere via search is an explicit "look elsewhere" — stop following.
    setFollowing(false)
    scrollRowToTop(el)
    el.style.transition = 'none'
    el.classList.add('flash-ring')
    setTimeout(() => el.classList.remove('flash-ring'), 1200)
  }, [scrollRowToTop])

  const resumeFollowing = useCallback(() => {
    setFollowing(true)
    if (activeRowRef.current) scrollRowToTop(activeRowRef.current)
  }, [scrollRowToTop])

  // Pin the active cue to the top whenever it changes — but only while following.
  useEffect(() => {
    if (!following || !live.activeCueId) return
    if (activeRowRef.current) scrollRowToTop(activeRowRef.current)
  }, [live.activeCueId, following, scrollRowToTop])

  // Reset to "following" for the next show once the operator goes idle.
  useEffect(() => {
    if (live.status === 'idle') setFollowing(true)
  }, [live.status])

  // Manual scroll (wheel / touch) breaks away from following.
  useEffect(() => {
    const cont = scrollRef.current
    if (!cont) return
    const disengage = () => {
      if (programmaticScrollRef.current) return
      setFollowing((f) => (f ? false : f))
    }
    cont.addEventListener('wheel', disengage, { passive: true })
    cont.addEventListener('touchmove', disengage, { passive: true })
    return () => {
      cont.removeEventListener('wheel', disengage)
      cont.removeEventListener('touchmove', disengage)
    }
  }, [])

  // ── Column interactions (per-viewer) ────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

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

  function makeResizer(selector: string, getStart: () => number, commit: (w: number) => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      const startX = e.clientX
      const startW = getStart()
      const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
      function onMove(ev: MouseEvent) {
        const w = Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX))
        for (const el of els) el.style.width = `${w}px`
      }
      function onUp(ev: MouseEvent) {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        commit(Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX)))
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }
  }

  const startTitleResize = makeResizer('[data-share-title-col]', () => titleWidth, setTitleWidth)
  const startMyNotesResize = makeResizer('[data-share-notes-col]', () => myNotesWidth, setMyNotesWidth)
  function startColResize(e: React.MouseEvent, col: Column) {
    makeResizer(`[data-share-col="${col.id}"]`, () => localWidths[col.id] ?? col.width, (w) =>
      setLocalWidths((prev) => ({ ...prev, [col.id]: w }))
    )(e)
  }

  function toggleHide(id: string) {
    setHiddenCols((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleCollapse(id: string) {
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const unhideAll = () => setHiddenCols(new Set())

  const showDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : null

  // ── Cell rendering ──────────────────────────────────────────────────────────
  function renderCells(cueId: string, baseBg: string) {
    return visibleColumns.map((col) => {
      const raw = cellMap[`${cueId}:${col.id}`] ?? ''
      const w = localWidths[col.id] ?? col.width
      return (
        <div key={col.id} data-share-col={col.id} style={tile(w, baseBg, { padding: '10px 8px' })}>
          {col.col_type === 'dropdown' ? (
            <DropdownDisplay values={parseDropdownValues(raw)} optionColors={col.option_colors} />
          ) : (
            <SharedRichText html={raw} varMap={varMap} mentionMap={mentionMap} />
          )}
        </div>
      )
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#09090d] text-[#c8c9d0] font-sans">
      <header className="shrink-0 flex items-center gap-3 px-6 h-14 border-b border-[#1d1d24] bg-[#07070a]">
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
        {isLive && (
          <button
            onClick={() => (following ? setFollowing(false) : resumeFollowing())}
            title={following ? 'Following the live show — click to break away and browse freely' : 'Re-follow the live show'}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 font-cond text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
              following
                ? 'border border-[#ff2848]/50 text-[#ff5a73] bg-[rgba(255,40,72,0.10)] hover:bg-[rgba(255,40,72,0.18)]'
                : 'border border-[#2e2e38] text-[#9ba0ab] hover:text-[#eef0f3] hover:border-[#3a3a48]'
            )}
          >
            {following ? <LocateFixed className="w-3 h-3" /> : <Locate className="w-3 h-3" />}
            {following ? 'Following' : 'Follow live'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <RundownSearch cues={searchCues} onSelect={scrollToCue} />
          {showDate && <span className="font-mono text-xs text-[#888b96]">{showDate}</span>}
          <span className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#888b96] border border-[#2e2e38] px-2 py-0.5">
            Read-only
          </span>
        </div>
      </header>

      <div ref={scrollRef} data-cue-scroll className="flex-1 overflow-auto">
        <div className="inline-block min-w-full align-top">
          {/* Column headers — sticky, scrolls horizontally with rows */}
          <div
            className="sticky top-0 z-20 flex items-stretch bg-[#0b0b10] border-b border-[#22222a] select-none"
            style={{ height: CF.headerH, gap: CF.gap, padding: `0 ${CF.rowPad}px` }}
          >
            <div className="shrink-0" style={{ width: CF.c1 }} />
            <HeaderCell width={CF.num} className="justify-center">#</HeaderCell>
            <HeaderCell width={CF.start}>Start</HeaderCell>
            <HeaderCell width={CF.dur}>Dur.</HeaderCell>
            <div data-share-title-col style={{ width: titleWidth }} className={cn('relative shrink-0 flex items-center', LABEL, 'text-[#7c7e8a]')}>
              Title
              <ResizeHandle onMouseDown={startTitleResize} />
            </div>

            <DndContext id="share-col-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localOrder.filter((id) => !hiddenCols.has(id))} strategy={horizontalListSortingStrategy}>
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

            {hiddenCount > 0 && (
              <div className="shrink-0 flex items-center px-1">
                <button onClick={unhideAll} title={`Show ${hiddenCount} hidden column${hiddenCount > 1 ? 's' : ''}`} className="p-1 text-[#888b96] hover:text-[#c8c9d0] transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div data-share-notes-col style={{ width: myNotesWidth }} className="relative shrink-0 flex items-center gap-1.5 pl-2">
              <Lock className="w-3 h-3 text-[#f0a838]/70 shrink-0" />
              <span className={cn(LABEL, 'text-[#f0a838]/70 truncate')}>My Notes</span>
              <ResizeHandle onMouseDown={startMyNotesResize} />
            </div>
          </div>

          {/* Rows */}
          <div className="py-3">
            {layout.items.map((item) => {
              if (item.type === 'group') {
                const isCollapsed = collapsed.has(item.heading.id)
                const dur = item.children.reduce((s, c) => s + c.duration_ms, 0)
                const startMs = item.children.length ? timedMap[item.children[0].id]?.calculated_start_ms ?? 0 : 0
                const endMs = startMs + dur
                return (
                  <div key={item.heading.id}>
                    <ShareGroupHeader
                      heading={item.heading}
                      number={fmtNum(item.number, rundown)}
                      isStandalone={item.children.length === 0}
                      collapsed={isCollapsed}
                      onToggle={() => toggleCollapse(item.heading.id)}
                      durationMs={dur}
                      startMs={startMs}
                      endMs={endMs}
                      count={item.children.length}
                      timeFormat={rundown.time_display ?? 'auto'}
                      rowWidth={rowWidth}
                    />
                    {!isCollapsed && item.children.map((ch) => (
                      <ShareCueRow
                        key={ch.id}
                        cue={timedMap[ch.id] ?? (ch as CueTimingOutput)}
                        displayNumber={fmtNum(layout.numberOf[ch.id] ?? '', rundown)}
                        depth={1}
                        live={live}
                        activeRef={live.activeCueId === ch.id ? activeRowRef : undefined}
                        timeFormat={rundown.time_display ?? 'auto'}
                        titleWidth={titleWidth}
                        notesWidth={myNotesWidth}
                        renderCells={renderCells}
                        note={privateNotes[ch.id] ?? ''}
                        onNoteChange={handleNoteChange}
                      />
                    ))}
                  </div>
                )
              }
              const cue = timedMap[item.cue.id] ?? (item.cue as CueTimingOutput)
              return (
                <ShareCueRow
                  key={item.cue.id}
                  cue={cue}
                  displayNumber={fmtNum(item.number, rundown)}
                  depth={0}
                  live={live}
                  activeRef={live.activeCueId === item.cue.id ? activeRowRef : undefined}
                  timeFormat={rundown.time_display ?? 'auto'}
                  titleWidth={titleWidth}
                  notesWidth={myNotesWidth}
                  renderCells={renderCells}
                  note={privateNotes[item.cue.id] ?? ''}
                  onNoteChange={handleNoteChange}
                />
              )
            })}

            {cues.length === 0 && (
              <p className="text-sm text-[#5a5c66] py-12 text-center">This rundown has no cues yet.</p>
            )}

            {/* Live spacer — lets even the last cue pin to the top while running */}
            {isLive && <div style={{ height: '72vh' }} aria-hidden />}
          </div>
        </div>
      </div>

      {/* Floating resume button while broken away from the live show */}
      {isLive && !following && (
        <button
          onClick={resumeFollowing}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 h-9 px-4 font-cond text-[11px] font-bold uppercase tracking-[0.12em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] shadow-[0_12px_34px_rgba(0,0,0,0.65)] transition-colors"
        >
          <ArrowUpToLine className="w-3.5 h-3.5" /> Jump to current cue
        </button>
      )}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtNum(raw: string, rundown: Rundown): string {
  return formatCueNumber(raw, rundown.cue_number_prefix ?? '', rundown.cue_number_start ?? 1, rundown.cue_number_digits ?? 1)
}

function tile(width: number, bg: string, extra?: React.CSSProperties): React.CSSProperties {
  return { width, minHeight: CF.minRowH, flexShrink: 0, background: bg, display: 'flex', alignItems: 'flex-start', padding: '12px 14px', ...extra }
}

function HeaderCell({ width, className, children }: { width: number; className?: string; children: React.ReactNode }) {
  return (
    <div style={{ width }} className={cn('shrink-0 flex items-center', LABEL, 'text-[#7c7e8a]', className)}>
      {children}
    </div>
  )
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div onMouseDown={onMouseDown} title="Drag to resize" className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#f0a838]/40 transition-colors" />
  )
}

// ── Live countdown clock (extrapolates between operator snapshots) ─────────────
function useLiveElapsed(live: LiveSyncState, isActive: boolean): number | null {
  const [, force] = useState(0)
  useEffect(() => {
    if (!isActive || live.status !== 'running') return
    const id = setInterval(() => force((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [isActive, live.status])
  if (!isActive) return null
  if (live.status === 'running') return live.elapsedMs + (Date.now() - live.sentAt)
  return live.elapsedMs
}

// ── Shared cue row (read-only mirror of the admin CueRow) ─────────────────────
interface ShareCueRowProps {
  cue: CueTimingOutput
  displayNumber: string
  depth: number
  live: LiveSyncState
  activeRef?: React.RefObject<HTMLDivElement | null>
  timeFormat: 'auto' | '24h' | '12h' | '12h_no_ampm'
  titleWidth: number
  notesWidth: number
  renderCells: (cueId: string, baseBg: string) => React.ReactNode
  note: string
  onNoteChange: (cueId: string, value: string) => void
}

function ShareCueRow({
  cue, displayNumber, depth, live, activeRef, timeFormat, titleWidth, notesWidth, renderCells, note, onNoteChange,
}: ShareCueRowProps) {
  const isActive = live.activeCueId === cue.id
  const isNext = live.nextCueId === cue.id
  const isLive = live.status === 'running' || live.status === 'paused'
  const elapsed = useLiveElapsed(live, isActive)
  const remaining = elapsed == null ? null : (live.durationMs || cue.duration_ms) - elapsed
  const isOvertime = remaining != null && remaining < 0

  const ct = textOn(cue.background_color)
  const baseBg = cue.background_color || '#16161c'
  const isHard = cue.start_type === 'hard'
  const hasGap = isHard && cue.gap_ms > 0
  const labelIndent = CF.rowPad + CF.c1 + CF.gap

  const numColor = isActive ? '#fff' : isNext ? '#eef0f3' : (cue.background_color ? ct.num : '#9ba0ab')
  const remColor = remaining == null ? '#eef0f3' : remaining < 0 ? '#ff2848' : remaining <= 30000 ? '#f0a838' : '#18d986'

  // Drive the progress bar at 60fps via rAF + a DOM ref so it moves smoothly
  // between operator snapshots (instead of stepping with React's 200ms ticks).
  const progressBarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = progressBarRef.current
    if (!bar || !isActive || cue.duration_ms <= 0) return
    const dur = cue.duration_ms
    const paint = (el: number) => {
      bar.style.width = `${Math.min(100, (el / dur) * 100)}%`
      bar.style.background = el > dur ? '#ff2848' : '#f0a838'
    }
    if (live.status === 'running') {
      let rafId = 0
      const loop = () => {
        paint(live.elapsedMs + (Date.now() - live.sentAt))
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafId)
    }
    paint(live.elapsedMs) // paused — freeze at the current position
  }, [isActive, live.status, live.elapsedMs, live.sentAt, cue.duration_ms])

  return (
    <div ref={activeRef} data-cue-id={cue.id} style={{ marginBottom: CF.gap }}>
      {/* Current / Next label */}
      {isLive && (isActive || isNext) && (
        <div className={cn('flex items-center gap-2 pt-0.5 pb-1', LABEL)} style={{ paddingLeft: labelIndent, color: isActive ? '#ff5a73' : '#7c7e8a' }}>
          {isActive ? 'Current cue' : 'Next cue'}
          <div className="h-px flex-1" style={{ background: isActive ? 'rgba(255,40,72,0.5)' : '#22222a' }} />
        </div>
      )}

      {/* Gap / overlap indicator */}
      {isHard && cue.gap_ms !== 0 && !isActive && (
        <div className="flex items-center gap-2 pb-1 font-mono text-[11px]" style={{ paddingLeft: labelIndent, color: hasGap ? '#eef0f3' : '#ff5a73' }}>
          <span>{hasGap ? `+${formatDuration(cue.gap_ms)} gap` : `${formatDuration(-cue.gap_ms)} overlap`}</span>
          <div className="h-px flex-1" style={{ background: hasGap ? 'rgba(238,240,243,0.18)' : 'rgba(255,40,72,0.25)' }} />
        </div>
      )}

      <div className="relative flex" style={{ gap: CF.gap, padding: `0 ${CF.rowPad}px` }}>
        {/* Control gutter (empty; carries depth indicator for grouped cues) */}
        <div className="shrink-0" style={{ width: CF.c1, boxShadow: depth > 0 ? 'inset 2px 0 0 #3a3a48' : 'none' }} />

        {/* Number */}
        <div style={tile(CF.num, isActive ? '#ff2848' : isNext ? 'transparent' : baseBg, { justifyContent: 'center', border: isNext ? '1.5px solid #6b6b76' : 'none' })}>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: numColor }}>{displayNumber}</span>
        </div>

        {/* Start */}
        <div style={tile(CF.start, baseBg, { flexDirection: 'column', gap: 2 })}>
          <span className="inline-flex items-center gap-1 font-mono text-[13px] tabular-nums" style={{ fontWeight: isHard ? 600 : 400, color: isActive ? ct.hi : isHard ? '#eef0f3' : ct.mid }}>
            {formatMsToTimeDisplay(cue.calculated_start_ms, timeFormat)}
            {isHard && <Pin className="w-2.5 h-2.5 shrink-0 -rotate-45 fill-current ml-0.5" />}
          </span>
        </div>

        {/* Duration / countdown */}
        <div style={tile(CF.dur, baseBg, { flexDirection: 'column', gap: 1 })}>
          {isActive && remaining != null ? (
            <>
              <span className="font-mono text-[10px] tabular-nums leading-none" style={{ color: ct.mid }}>{formatDuration(cue.duration_ms)}</span>
              <span className="font-mono text-[21px] font-bold tabular-nums leading-[1.1]" style={{ color: remColor }}>{isOvertime ? '+' : ''}{formatDuration(Math.abs(remaining))}</span>
            </>
          ) : (
            <span className="font-mono text-[15px] font-semibold tabular-nums" style={{ color: ct.hi }}>{formatDuration(cue.duration_ms)}</span>
          )}
        </div>

        {/* Title + subtitle */}
        <div className="shrink-0 flex flex-col" data-share-title-col style={{ width: titleWidth, minHeight: CF.minRowH, background: baseBg, padding: '12px 16px' }}>
          <span className="text-[16px] font-medium leading-[1.35] break-words [overflow-wrap:anywhere]" style={{ color: cue.title ? ct.hi : '#6b6d78', fontStyle: cue.title ? 'normal' : 'italic' }}>
            {cue.title || 'Untitled cue'}
          </span>
          {cue.subtitle && <span className="text-xs mt-0.5 break-words [overflow-wrap:anywhere] leading-[1.3]" style={{ color: ct.mid }}>{cue.subtitle}</span>}
        </div>

        {/* Dynamic cells */}
        {renderCells(cue.id, baseBg)}

        {/* My notes */}
        <div data-share-notes-col style={tile(notesWidth, '#16161c', { padding: '10px 4px' })}>
          <RichNoteCell value={note} onSave={(html) => onNoteChange(cue.id, html)} />
        </div>

        {/* Live progress bar (width owned by the rAF loop above; constant style
            here so React never overwrites the smooth value) */}
        {isActive && cue.duration_ms > 0 && (
          <div className="absolute pointer-events-none" style={{ left: labelIndent, right: CF.rowPad, bottom: -5, height: 3, background: 'rgba(255,255,255,0.10)', zIndex: 15 }}>
            <div ref={progressBarRef} className="h-full" style={{ width: '0%', background: '#f0a838' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared group / heading band (read-only mirror of GroupHeaderRow) ──────────
function ShareGroupHeader({
  heading, number, isStandalone, collapsed, onToggle, durationMs, startMs, endMs, count, timeFormat, rowWidth,
}: {
  heading: Cue
  number: string
  isStandalone: boolean
  collapsed: boolean
  onToggle: () => void
  durationMs: number
  startMs: number
  endMs: number
  count: number
  timeFormat: 'auto' | '24h' | '12h' | '12h_no_ampm'
  rowWidth: number
}) {
  const ct = textOn(heading.background_color)
  const isGroup = !isStandalone
  const bandBg = heading.background_color ? heading.background_color : isGroup ? '#1a1a20' : '#15151b'
  const bandBorder = heading.background_color ? 'transparent' : '#26262e'

  function longDur(ms: number) {
    const total = Math.floor(Math.max(0, ms) / 1000)
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }

  return (
    <div className="flex items-stretch" data-cue-id={heading.id} style={{ width: rowWidth, minHeight: CF.minRowH, marginTop: isGroup ? 18 : 30, marginBottom: CF.gap, gap: CF.gap, padding: `0 ${CF.rowPad}px` }}>
      <div className="shrink-0" style={{ width: CF.c1 }} />
      <div className="flex-1 min-w-0 flex items-center" style={{ background: bandBg, border: `1px solid ${bandBorder}`, paddingRight: 14 }}>
        <div className="shrink-0 flex items-center justify-center" style={{ width: CF.num }}>
          <span className="font-mono text-sm font-bold" style={{ color: heading.background_color ? ct.mid : (isGroup ? '#9ba0ab' : '#7c7e8a') }}>{number}</span>
        </div>
        <div className="flex-1 min-w-0 pl-1">
          <span className="block text-left break-words [overflow-wrap:anywhere]" style={{ fontSize: isGroup ? 14 : 16, fontWeight: isGroup ? 600 : 700, color: heading.title ? (heading.background_color ? ct.hi : '#eef0f3') : '#5a5c66', fontStyle: heading.title ? 'normal' : 'italic' }}>
            {heading.title || (isGroup ? 'Group' : 'Untitled heading')}
          </span>
          {isGroup && (
            <div className="flex items-center gap-2.5 mt-0.5 font-mono text-[11px] text-[#888b96]">
              <span>{longDur(durationMs)}</span>
              <span className="text-[#5a5c66]">{formatMsToTimeDisplay(startMs, timeFormat)} → {formatMsToTimeDisplay(endMs, timeFormat)}</span>
              <span className="text-[#5a5c66]">· {count} cue{count === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>
        {isGroup && (
          <button data-testid="share-group-collapse" onClick={onToggle} title={collapsed ? 'Expand group' : 'Collapse group'} className="shrink-0 text-[#9ba0ab] hover:text-[#eef0f3] transition-colors">
            {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronDown className="w-[18px] h-[18px]" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Dropdown display (read-only, stacked colour blocks) ───────────────────────
function DropdownDisplay({ values, optionColors }: { values: string[]; optionColors: Record<string, string> | null }) {
  if (values.length === 0) return null
  return (
    <div className="w-full flex flex-col gap-1.5">
      {values.map((v) => (
        <span key={v} className="text-[12.5px] px-2.5 py-[5px] text-white font-semibold break-words [overflow-wrap:anywhere]" style={{ backgroundColor: optionColors?.[v] ?? 'rgba(63,63,70,0.85)' }}>
          {v}
        </span>
      ))}
    </div>
  )
}

// ── Rich-text display with variable resolution + mention hovercards ───────────
function SharedRichText({ html, varMap, mentionMap }: { html: string; varMap: Record<string, string>; mentionMap: Record<string, Mention> }) {
  const [hover, setHover] = useState<{ mention: Mention; x: number; y: number } | null>(null)
  const resolved = useMemo(() => {
    const nameById = Object.fromEntries(Object.entries(mentionMap).map(([id, m]) => [id, m.name]))
    return resolveMentionsHtml(resolveVariablesHtml(html, varMap), nameById)
  }, [html, varMap, mentionMap])

  if (!html || html === '<p></p>') return null

  function onOver(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest?.('[data-mention-suggestion-char="@"]')
    if (!el) return
    const mention = mentionMap[el.getAttribute('data-id') || '']
    if (!mention) return
    const r = el.getBoundingClientRect()
    setHover({ mention, x: r.left, y: r.bottom })
  }
  function onOut(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest?.('[data-mention-suggestion-char="@"]')) setHover(null)
  }

  return (
    <>
      <div
        className="tiptap-cell text-[13px] text-[#c8c9d0] break-words [overflow-wrap:anywhere] w-full"
        onMouseOver={onOver}
        onMouseOut={onOut}
        dangerouslySetInnerHTML={{ __html: resolved }}
      />
      {hover && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', left: hover.x, top: hover.y + 6, zIndex: 70 }} className="max-w-xs border border-[#2e2e38] bg-[#111116] p-3 shadow-xl pointer-events-none">
          <p className="text-sm font-medium text-[#eef0f3] mb-1">{hover.mention.name}</p>
          {hover.mention.description ? (
            <div className="tiptap-cell text-xs text-[#c8c9d0]" dangerouslySetInnerHTML={{ __html: hover.mention.description }} />
          ) : (
            <p className="text-xs text-[#5a5c66] italic">No description</p>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Sortable column header (per-viewer hide / reorder / resize) ───────────────
interface ShareColumnHeaderProps {
  col: Column
  width: number
  onHide: () => void
  onResizeStart: (e: React.MouseEvent) => void
}

function ShareColumnHeader({ col, width, onHide, onResizeStart }: ShareColumnHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id })
  const style = { width, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} data-share-col={col.id} style={style} className="group/col relative shrink-0 flex items-center pl-1">
      <button {...attributes} {...listeners} title="Drag to reorder" className="opacity-0 group-hover/col:opacity-100 transition-opacity text-[#5a5c66] hover:text-[#9ba0ab] cursor-grab active:cursor-grabbing mr-0.5">
        <GripVertical className="w-3 h-3" />
      </button>
      <span className={cn('flex-1', LABEL, 'text-[#7c7e8a] truncate')}>{col.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 text-[#9ba0ab] hover:text-[#eef0f3]" />}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-36 p-0">
          <DropdownMenuItem onClick={onHide} className="gap-2 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer">
            <EyeOff className="w-3 h-3 text-[#9ba0ab]" /> Hide for me
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResizeHandle onMouseDown={onResizeStart} />
    </div>
  )
}
