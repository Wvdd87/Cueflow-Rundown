'use client'

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  addCue,
  updateCue,
  reorderCues,
  deleteCues,
  setCuesBackground,
  duplicateCues,
  groupCues,
  ungroupCues,
  getRundownCues,
} from '@/app/actions/cues'
import { RundownHeader } from './RundownHeader'
import { ColumnHeaders } from './ColumnHeaders'
import { CueRow } from './CueRow'
import { GroupHeaderRow } from './GroupHeaderRow'
import { BatchToolbar } from './BatchToolbar'
import { TransportBar } from './TransportBar'
import { RundownSettingsDialog } from './RundownSettingsDialog'
import { RundownDataProvider } from './RundownDataContext'
import { buildCueLayout } from './cueTree'
import { useLiveShow } from './useLiveShow'
import { useBroadcastLive } from './liveSync'
import {
  calculateTimings,
  formatMsToTime,
  formatDuration,
  type CueTimingOutput,
} from '@/lib/timing'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  Rundown,
  Cue,
  Column,
  Cell,
  Mention,
  Variable,
} from '@/lib/supabase/types'

interface RundownEditorProps {
  rundown: Rundown
  initialCues: Cue[]
  initialColumns: Column[]
  initialCells: Cell[]
  initialMentions: Mention[]
  initialVariables: Variable[]
  initialPrivateNotes: Record<string, string>
}

// Per-user view state persisted in localStorage (not shared)
function lsKey(rundownId: string, what: string) {
  return `rundown:${rundownId}:${what}`
}
function loadSet(rundownId: string, what: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(lsKey(rundownId, what))
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function cellsToMap(cells: Cell[]): Record<string, string> {
  return Object.fromEntries(
    cells.map((c) => [`${c.cue_id}:${c.column_id}`, c.content ?? ''])
  )
}

export function RundownEditor({
  rundown,
  initialCues,
  initialColumns,
  initialCells,
  initialMentions,
  initialVariables,
  initialPrivateNotes,
}: RundownEditorProps) {
  const [cues, setCues] = useState<Cue[]>(initialCues)
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [cells, setCells] = useState<Record<string, string>>(() =>
    cellsToMap(initialCells)
  )
  const [mentions, setMentions] = useState<Mention[]>(initialMentions)
  const [variables, setVariables] = useState<Variable[]>(initialVariables)
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>(
    initialPrivateNotes
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'mentions' | 'variables'>('mentions')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() =>
    loadSet(rundown.id, 'hiddenCols')
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    loadSet(rundown.id, 'collapsedGroups')
  )
  // Start with default (PN last) — matches SSR; then sync from localStorage after hydration.
  const [privateNotesIndex, setPrivateNotesIndex] = useState<number>(9999)
  const lastSelectedRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(lsKey(rundown.id, 'hiddenCols'), JSON.stringify([...hiddenCols]))
  }, [hiddenCols, rundown.id])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(lsKey(rundown.id, 'collapsedGroups'), JSON.stringify([...collapsedGroups]))
  }, [collapsedGroups, rundown.id])
  useEffect(() => {
    const raw = window.localStorage.getItem(lsKey(rundown.id, 'privateNotesIndex'))
    if (raw !== null) {
      const n = parseInt(raw, 10)
      if (!isNaN(n)) setPrivateNotesIndex(n)
    }
  }, [rundown.id])
  useEffect(() => {
    window.localStorage.setItem(lsKey(rundown.id, 'privateNotesIndex'), String(privateNotesIndex))
  }, [privateNotesIndex, rundown.id])

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.id)),
    [columns, hiddenCols]
  )
  const toggleHideColumn = useCallback((id: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const unhideAllColumns = useCallback(() => setHiddenCols(new Set()), [])
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // --- Layout + timing ---
  const layout = useMemo(() => buildCueLayout(cues), [cues])
  const timedCues = useMemo(() => calculateTimings(layout.docOrder), [layout])
  const timedMap = useMemo(
    () => Object.fromEntries(timedCues.map((t) => [t.id, t])) as Record<string, CueTimingOutput>,
    [timedCues]
  )
  // Live navigation skips heading rows
  const liveCues = useMemo(
    () => timedCues.filter((c) => c.cue_type !== 'heading'),
    [timedCues]
  )
  const live = useLiveShow(liveCues)

  // Broadcast the live show state to read-only viewers
  useBroadcastLive(rundown.id, live.activeCueId, live.status, live.isLive)

  const firstCueId = liveCues[0]?.id ?? null
  // Auto-start toggle between cues: shown only when the next cue is soft-start.
  // Value = next cue's auto_start flag; null = no toggle (last cue / next is hard).
  const nextAutoStartOf = useMemo(() => {
    const map: Record<string, boolean | null> = {}
    liveCues.forEach((c, i) => {
      const next = liveCues[i + 1]
      map[c.id] = next && next.start_type === 'soft' ? next.auto_start : null
    })
    return map
  }, [liveCues])

  const toggleNextAutoStart = useCallback(
    (cueId: string) => {
      const idx = liveCues.findIndex((c) => c.id === cueId)
      const next = idx >= 0 ? liveCues[idx + 1] : null
      if (!next || next.start_type !== 'soft') return
      const value = !next.auto_start
      setCues((prev) =>
        prev.map((c) => (c.id === next.id ? { ...c, auto_start: value } : c))
      )
      updateCue(next.id, rundown.id, { auto_start: value })
    },
    [liveCues, rundown.id]
  )

  const realCueCount = useMemo(
    () => cues.filter((c) => c.cue_type !== 'heading').length,
    [cues]
  )
  const totalDurationMs = useMemo(
    () => cues.reduce((s, c) => s + (c.cue_type === 'heading' ? 0 : c.duration_ms), 0),
    [cues]
  )
  const plannedEndMs =
    timedCues.length > 0
      ? timedCues[timedCues.length - 1].calculated_start_ms +
        timedCues[timedCues.length - 1].duration_ms
      : 0

  const selectableIds = useMemo(() => layout.docOrder.map((c) => c.id), [layout])
  const canUngroup = useMemo(
    () => cues.some((c) => selectedIds.has(c.id) && (c.cue_type === 'heading' || c.group_id)),
    [cues, selectedIds]
  )

  // --- Selection ---
  const handleSelect = useCallback(
    (id: string, mods: { shift: boolean; meta: boolean }) => {
      setSelectedIds((prev) => {
        if (mods.shift && lastSelectedRef.current) {
          const a = selectableIds.indexOf(lastSelectedRef.current)
          const b = selectableIds.indexOf(id)
          if (a >= 0 && b >= 0) {
            const [lo, hi] = a < b ? [a, b] : [b, a]
            const next = new Set(prev)
            for (let i = lo; i <= hi; i++) next.add(selectableIds[i])
            return next
          }
        }
        if (mods.meta) {
          const next = new Set(prev)
          next.has(id) ? next.delete(id) : next.add(id)
          lastSelectedRef.current = id
          return next
        }
        lastSelectedRef.current = id
        if (prev.has(id) && prev.size === 1) return new Set()
        return new Set([id])
      })
    },
    [selectableIds]
  )

  const refreshCues = useCallback(async () => {
    const r = await getRundownCues(rundown.id)
    setCues(r.cues)
    setCells(cellsToMap(r.cells))
  }, [rundown.id])

  // --- Add cue ---
  async function handleAddCue() {
    const maxPos = cues.reduce((m, c) => Math.max(m, c.position), -1)
    const optimisticCue: Cue = {
      id: `temp-${Date.now()}`,
      rundown_id: rundown.id,
      position: maxPos + 1,
      cue_number: '',
      cue_type: 'cue',
      group_id: null,
      title: '',
      subtitle: null,
      start_type: 'soft',
      start_time_override: null,
      auto_start: false,
      duration_ms: 0,
      background_color: null,
      locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setCues((prev) => [...prev, optimisticCue])
    const result = await addCue(rundown.id, maxPos)
    if (result.error) {
      toast.error(result.error)
      setCues((prev) => prev.filter((c) => c.id !== optimisticCue.id))
    } else if (result.cue) {
      setCues((prev) => prev.map((c) => (c.id === optimisticCue.id ? result.cue! : c)))
    }
  }

  // --- Single-cue handlers (passed to rows) ---
  const handleDeleteCue = useCallback((id: string) => {
    setCues((prev) => prev.filter((c) => c.id !== id))
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
  }, [])
  const handleUpdateCue = useCallback((id: string, updates: Partial<Cue>) => {
    setCues((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }, [])
  const handleCellChange = useCallback((cueId: string, columnId: string, content: string) => {
    setCells((prev) => ({ ...prev, [`${cueId}:${columnId}`]: content }))
  }, [])
  const handlePrivateNoteChange = useCallback((cueId: string, content: string) => {
    setPrivateNotes((prev) => ({ ...prev, [cueId]: content }))
  }, [])

  // --- Batch handlers ---
  const handleSelectAll = useCallback(() => setSelectedIds(new Set(selectableIds)), [selectableIds])
  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleBatchDelete = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setCues((prev) => prev.filter((c) => !selectedIds.has(c.id)))
    setSelectedIds(new Set())
    const r = await deleteCues(rundown.id, ids)
    if (r.error) { toast.error(r.error); refreshCues() }
  }, [selectedIds, rundown.id, refreshCues])

  const handleBatchBackground = useCallback(async (color: string | null) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setCues((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, background_color: color } : c)))
    const r = await setCuesBackground(rundown.id, ids, color)
    if (r.error) toast.error(r.error)
  }, [selectedIds, rundown.id])

  const handleDuplicate = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const r = await duplicateCues(rundown.id, ids)
    if (r.error) return toast.error(r.error)
    await refreshCues()
    setSelectedIds(new Set())
  }, [selectedIds, rundown.id, refreshCues])

  const handleGroup = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const r = await groupCues(rundown.id, ids)
    if (r.error) return toast.error(r.error)
    await refreshCues()
    setSelectedIds(new Set())
  }, [selectedIds, rundown.id, refreshCues])

  const handleUngroup = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const r = await ungroupCues(rundown.id, ids)
    if (r.error) return toast.error(r.error)
    await refreshCues()
    setSelectedIds(new Set())
  }, [selectedIds, rundown.id, refreshCues])

  const handleUngroupOne = useCallback(async (headingId: string) => {
    const r = await ungroupCues(rundown.id, [headingId])
    if (r.error) return toast.error(r.error)
    await refreshCues()
  }, [rundown.id, refreshCues])

  const handleDeleteGroup = useCallback(async (headingId: string) => {
    setCues((prev) => prev.filter((c) => c.id !== headingId))
    const r = await deleteCues(rundown.id, [headingId])
    if (r.error) { toast.error(r.error) }
    await refreshCues()
  }, [rundown.id, refreshCues])

  const handleMove = useCallback(async (target: 'top' | 'bottom' | number) => {
    const order = layout.docOrder.map((c) => c.id)
    const sel = order.filter((id) => selectedIds.has(id))
    if (sel.length === 0) return
    const rest = order.filter((id) => !selectedIds.has(id))
    const idx =
      target === 'top' ? 0 : target === 'bottom' ? rest.length : Math.max(0, Math.min(rest.length, target))
    const newOrder = [...rest.slice(0, idx), ...sel, ...rest.slice(idx)]
    const pm = new Map(newOrder.map((id, i) => [id, i]))
    setCues((prev) => prev.map((c) => ({ ...c, position: pm.get(c.id) ?? c.position })))
    const r = await reorderCues(rundown.id, newOrder)
    if (r.error) { toast.error(r.error); refreshCues() }
  }, [layout, selectedIds, rundown.id, refreshCues])

  // --- Drag reorder (group-aware) ---
  const visibleOrderIds = useCallback(() => {
    const ids: string[] = []
    for (const item of layout.items) {
      if (item.type === 'group') {
        ids.push(item.heading.id)
        if (!collapsedGroups.has(item.heading.id)) for (const ch of item.children) ids.push(ch.id)
      } else ids.push(item.cue.id)
    }
    return ids
  }, [layout, collapsedGroups])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const visible = visibleOrderIds()
    const oldIndex = visible.indexOf(active.id as string)
    const newIndex = visible.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    const newVisible = arrayMove(visible, oldIndex, newIndex)

    // re-attach collapsed groups' hidden children right after their heading
    const childrenByHeading = new Map<string, string[]>()
    for (const item of layout.items) {
      if (item.type === 'group') childrenByHeading.set(item.heading.id, item.children.map((c) => c.id))
    }
    const cueById = new Map(cues.map((c) => [c.id, c]))
    const fullOrder: string[] = []
    for (const id of newVisible) {
      fullOrder.push(id)
      const c = cueById.get(id)
      if (c?.cue_type === 'heading' && collapsedGroups.has(id)) {
        for (const chId of childrenByHeading.get(id) ?? []) fullOrder.push(chId)
      }
    }
    const pm = new Map(fullOrder.map((id, i) => [id, i]))
    const prev = cues
    setCues((cs) => cs.map((c) => ({ ...c, position: pm.get(c.id) ?? c.position })))
    const r = await reorderCues(rundown.id, fullOrder)
    if (r.error) { toast.error(r.error); setCues(prev) }
  }

  function groupAggregate(children: Cue[]) {
    const timed = children.map((c) => timedMap[c.id]).filter(Boolean) as CueTimingOutput[]
    const durationMs = children.reduce((s, c) => s + c.duration_ms, 0)
    const startMs = timed.length ? timed[0].calculated_start_ms : 0
    const last = timed[timed.length - 1]
    const endMs = last ? last.calculated_start_ms + last.duration_ms : startMs
    return { durationMs, startMs, endMs, count: children.length }
  }

  function renderCueRow(cue: CueTimingOutput, number: string, depth: number) {
    return (
      <CueRow
        key={cue.id}
        cue={cue}
        displayNumber={number}
        depth={depth}
        columns={visibleColumns}
        cells={cells}
        rundownId={rundown.id}
        selected={selectedIds.has(cue.id)}
        onSelect={handleSelect}
        onDelete={handleDeleteCue}
        onUpdate={handleUpdateCue}
        onCellChange={handleCellChange}
        live={live.isLive}
        isActive={cue.id === live.activeCueId}
        isNext={cue.id === live.nextCueId}
        liveRemainingMs={cue.id === live.activeCueId ? live.remainingMs : null}
        liveElapsedMs={cue.id === live.activeCueId ? live.elapsedMs : null}
        onJump={live.jumpTo}
        privateNote={privateNotes[cue.id] ?? ''}
        onPrivateNoteChange={handlePrivateNoteChange}
        privateNotesIndex={privateNotesIndex}
        isFirst={cue.id === firstCueId}
        nextAutoStart={nextAutoStartOf[cue.id] ?? null}
        onToggleNextAutoStart={() => toggleNextAutoStart(cue.id)}
      />
    )
  }

  const isEmpty = cues.length === 0

  return (
    <RundownDataProvider
      value={{ rundownId: rundown.id, mentions, variables, setMentions, setVariables }}
    >
      <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
        <RundownHeader
          rundown={rundown}
          columns={columns}
          onPlayClick={() => (live.isLive ? live.end() : live.start())}
          isLive={live.isLive}
          onOpenSettings={(tab) => {
            setSettingsTab(tab ?? 'mentions')
            setSettingsOpen(true)
          }}
          onResetTiming={() => {
            live.end()
            toast.success('Rundown timing reset')
          }}
        />

        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedIds.size > 0 && (
            <BatchToolbar
              count={selectedIds.size}
              canUngroup={canUngroup}
              onSelectAll={handleSelectAll}
              onDuplicate={handleDuplicate}
              onGroup={handleGroup}
              onUngroup={handleUngroup}
              onMove={handleMove}
              onBackground={handleBatchBackground}
              onDelete={handleBatchDelete}
              onClear={handleClearSelection}
            />
          )}

          {/* Shared horizontal scroll wrapper — keeps headers and rows in sync */}
          <div className="flex-1 flex flex-col overflow-x-auto overflow-y-hidden">
          <ColumnHeaders
            columns={columns}
            visibleColumns={visibleColumns}
            hiddenCount={columns.length - visibleColumns.length}
            rundownId={rundown.id}
            onColumnsChange={setColumns}
            onToggleHide={toggleHideColumn}
            onUnhideAll={unhideAllColumns}
            privateNotesIndex={privateNotesIndex}
            onPrivateNotesIndexChange={setPrivateNotesIndex}
          />

          <div
            className="flex-1 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedIds(new Set())
            }}
          >
            <DndContext
              id="cue-rows-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={visibleOrderIds()} strategy={verticalListSortingStrategy}>
                {layout.items.map((item) => {
                  if (item.type === 'group') {
                    const collapsed = collapsedGroups.has(item.heading.id)
                    return (
                      <Fragment key={item.heading.id}>
                        <GroupHeaderRow
                          heading={item.heading}
                          number={item.number}
                          rundownId={rundown.id}
                          aggregate={groupAggregate(item.children)}
                          collapsed={collapsed}
                          selected={selectedIds.has(item.heading.id)}
                          onToggleCollapse={() => toggleCollapse(item.heading.id)}
                          onSelect={handleSelect}
                          onUpdate={handleUpdateCue}
                          onUngroup={handleUngroupOne}
                          onDelete={handleDeleteGroup}
                        />
                        {!collapsed &&
                          item.children.map((ch) => {
                            const timed = timedMap[ch.id]
                            return timed
                              ? renderCueRow(timed, layout.numberOf[ch.id] ?? '', 1)
                              : null
                          })}
                      </Fragment>
                    )
                  }
                  const timed = timedMap[item.cue.id]
                  return timed ? renderCueRow(timed, item.number, 0) : null
                })}
              </SortableContext>
            </DndContext>

            {/* Add cue button */}
            <div className={cn('px-7 py-2', isEmpty && 'py-12 flex justify-center')}>
              {isEmpty ? (
                <div className="text-center">
                  <p className="text-zinc-600 text-sm mb-3">No cues yet</p>
                  <button
                    onClick={handleAddCue}
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg px-4 py-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add first cue
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddCue}
                  className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add cue
                </button>
              )}
            </div>
          </div>
          </div>{/* end overflow-x-auto wrapper */}
        </div>

        {/* Footer summary */}
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-6 py-2 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 uppercase tracking-wider text-[10px]">End of rundown</span>
            <span
              className={cn(
                'font-mono tabular-nums',
                live.isLive ? 'text-zinc-600 line-through' : 'text-zinc-300'
              )}
            >
              {formatMsToTime(plannedEndMs)}
            </span>
          </div>
          {live.isLive && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Calculated end</span>
                <span className="font-mono tabular-nums text-white">
                  {formatMsToTime(plannedEndMs + live.overUnderMs)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Over / Under</span>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    Math.abs(live.overUnderMs) < 1000
                      ? 'text-zinc-400'
                      : live.overUnderMs > 0
                        ? 'text-red-400'
                        : 'text-emerald-400'
                  )}
                >
                  {Math.abs(live.overUnderMs) < 1000
                    ? 'on time'
                    : `${live.overUnderMs < 0 ? '−' : '+'}${formatDuration(Math.abs(live.overUnderMs))} ${live.overUnderMs > 0 ? 'late' : 'early'}`}
                </span>
              </div>
            </>
          )}
          <div className="ml-auto text-zinc-500">
            {realCueCount} {realCueCount === 1 ? 'cue' : 'cues'} · {formatDuration(totalDurationMs)} total
          </div>
        </div>

        {live.isLive && <TransportBar live={live} cues={liveCues} />}

        <RundownSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialTab={settingsTab}
        />
      </div>
    </RundownDataProvider>
  )
}
