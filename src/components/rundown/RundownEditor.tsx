'use client'

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react'
import { Plus, Heading as HeadingIcon, ChevronDown } from 'lucide-react'
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
  addHeading,
  convertCueToHeading,
  convertHeadingToCue,
  updateCue,
  reorderCues,
  deleteCue,
  deleteCues,
  restoreCue,
  setCuesBackground,
  duplicateCues,
  groupCues,
  ungroupCues,
  getRundownCues,
} from '@/app/actions/cues'
import { useUndoHistory } from './useUndoHistory'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RundownHeader } from './RundownHeader'
import { ColumnHeaders } from './ColumnHeaders'
import { CueRow } from './CueRow'
import { GroupHeaderRow } from './GroupHeaderRow'
import { BatchToolbar } from './BatchToolbar'
import { TransportBar } from './TransportBar'
import { RundownSettingsDialog } from './RundownSettingsDialog'
import { MentionsVariablesDialog } from './MentionsVariablesDialog'
import { RundownTrashDialog } from './RundownTrashDialog'
import { RundownSearch } from './RundownSearch'
import type { SearchCue } from './RundownSearch'
import { RundownDataProvider } from './RundownDataContext'
import type { RundownSettings } from './RundownDataContext'
import { buildCueLayout, formatCueNumber } from './cueTree'
import { CF, totalRowWidth } from './layout'
import { useLiveShow } from './useLiveShow'
import { useBroadcastLive } from './liveSync'
import {
  calculateTimings,
  formatMsToTimeDisplay,
  formatDuration,
  type CueTimingOutput,
  type TimeDisplay,
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
  const [rundownSettings, setRundownSettings] = useState<RundownSettings>({
    time_display: (rundown.time_display ?? 'auto') as TimeDisplay,
    cue_number_prefix: rundown.cue_number_prefix ?? '',
    cue_number_start: rundown.cue_number_start ?? 1,
    cue_number_digits: rundown.cue_number_digits ?? 1,
  })
  const handleSaveSettings = useCallback((s: Partial<RundownSettings>) => {
    setRundownSettings((prev) => ({ ...prev, ...s }))
  }, [])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'display' | 'numbering'>('display')
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [mentionsTab, setMentionsTab] = useState<'mentions' | 'variables'>('mentions')
  const [trashOpen, setTrashOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() =>
    loadSet(rundown.id, 'hiddenCols')
  )
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() =>
    loadSet(rundown.id, 'collapsedGroups')
  )
  // Start with default (PN last) — matches SSR; then sync from localStorage after hydration.
  const [privateNotesIndex, setPrivateNotesIndex] = useState<number>(9999)
  const [titleWidth, setTitleWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 240
    const raw = window.localStorage.getItem(lsKey(rundown.id, 'titleWidth'))
    const n = raw ? parseInt(raw, 10) : NaN
    return isNaN(n) ? 240 : n
  })
  const lastSelectedRef = useRef<string | null>(null)
  const cuesRef = useRef(cues)
  cuesRef.current = cues

  const history = useUndoHistory()

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z keyboard shortcuts
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      // Don't intercept while typing in inputs, textareas, or contenteditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const label = await history.undo()
        if (label) toast.success(`Undo: ${label}`)
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        const label = await history.redo()
        if (label) toast.success(`Redo: ${label}`)
      } else if (e.key === 'y') {
        e.preventDefault()
        const label = await history.redo()
        if (label) toast.success(`Redo: ${label}`)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [history])

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
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(lsKey(rundown.id, 'titleWidth'), String(titleWidth))
  }, [titleWidth, rundown.id])

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

  const handleSearchSelect = useCallback((id: string) => {
    const el = document.querySelector(`[data-cue-id="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-white', 'ring-inset')
      setTimeout(() => el.classList.remove('ring-2', 'ring-white', 'ring-inset'), 1500)
    }
  }, [])

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

  const searchCues = useMemo<SearchCue[]>(() =>
    layout.docOrder.map((c) => ({
      id: c.id,
      displayNumber: formatCueNumber(
        layout.numberOf[c.id] ?? '',
        rundownSettings.cue_number_prefix,
        rundownSettings.cue_number_start,
        rundownSettings.cue_number_digits
      ),
      title: c.title ?? '',
      cue_type: c.cue_type as 'cue' | 'heading',
    }))
  , [layout, rundownSettings])

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
      deleted_at: null,
    }
    setCues((prev) => [...prev, optimisticCue])
    const result = await addCue(rundown.id, maxPos)
    if (result.error) {
      toast.error(result.error)
      setCues((prev) => prev.filter((c) => c.id !== optimisticCue.id))
    } else if (result.cue) {
      const realCue = result.cue
      setCues((prev) => prev.map((c) => (c.id === optimisticCue.id ? realCue : c)))
      history.push({
        label: 'Add cue',
        undo: async () => {
          setCues((prev) => prev.filter((c) => c.id !== realCue.id))
          await deleteCue(realCue.id, rundown.id)
        },
        redo: async () => {
          await restoreCue(realCue.id, rundown.id)
          await refreshCues()
        },
      })
    }
  }

  async function handleAddHeading() {
    const maxPos = cues.reduce((m, c) => Math.max(m, c.position), -1)
    const optimisticCue: Cue = {
      id: `temp-${Date.now()}`,
      rundown_id: rundown.id,
      position: maxPos + 1,
      cue_number: '',
      cue_type: 'heading',
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
      deleted_at: null,
    }
    setCues((prev) => [...prev, optimisticCue])
    const result = await addHeading(rundown.id, maxPos)
    if (result.error) {
      toast.error(result.error)
      setCues((prev) => prev.filter((c) => c.id !== optimisticCue.id))
    } else if (result.cue) {
      const realCue = result.cue
      setCues((prev) => prev.map((c) => (c.id === optimisticCue.id ? realCue : c)))
      history.push({
        label: 'Add heading',
        undo: async () => {
          setCues((prev) => prev.filter((c) => c.id !== realCue.id))
          await deleteCue(realCue.id, rundown.id)
        },
        redo: async () => {
          await restoreCue(realCue.id, rundown.id)
          await refreshCues()
        },
      })
    }
  }

  const handleConvertToHeading = useCallback((id: string) => {
    setCues((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, cue_type: 'heading' as const, group_id: null, duration_ms: 0, start_type: 'soft' as const, start_time_override: null }
          : c
      )
    )
    convertCueToHeading(id, rundown.id).then((r) => {
      if (r.error) { toast.error(r.error); refreshCues() }
    })
  }, [rundown.id, refreshCues])

  const handleConvertToCue = useCallback((id: string) => {
    setCues((prev) =>
      prev.map((c) => c.id === id ? { ...c, cue_type: 'cue' as const } : c)
    )
    convertHeadingToCue(id, rundown.id).then((r) => {
      if (r.error) { toast.error(r.error); refreshCues() }
    })
  }, [rundown.id, refreshCues])

  const handleAddCueAt = useCallback(async (id: string, direction: 'above' | 'below') => {
    const target = cuesRef.current.find((c) => c.id === id)
    if (!target) return
    const afterPosition = direction === 'above' ? target.position - 1 : target.position
    const r = await addCue(rundown.id, afterPosition)
    if (r.error) { toast.error(r.error); return }
    await refreshCues()
  }, [rundown.id, refreshCues])

  const handleDuplicateSingle = useCallback(async (id: string) => {
    const r = await duplicateCues(rundown.id, [id])
    if (r.error) { toast.error(r.error); return }
    await refreshCues()
  }, [rundown.id, refreshCues])

  // --- Single-cue handlers (passed to rows) ---
  const handleDeleteCue = useCallback((id: string) => {
    const snap = cuesRef.current.find((c) => c.id === id)
    setCues((prev) => prev.filter((c) => c.id !== id))
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    deleteCue(id, rundown.id).then((r) => {
      if (r.error) { toast.error(r.error); refreshCues() }
    })
    if (snap) {
      history.push({
        label: `Delete "${snap.title || 'Untitled cue'}"`,
        undo: async () => {
          await restoreCue(id, rundown.id)
          await refreshCues()
        },
        redo: async () => {
          setCues((prev) => prev.filter((c) => c.id !== id))
          await deleteCue(id, rundown.id)
        },
      })
    }
  }, [rundown.id, refreshCues, history.push])
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
    if (r.error) { toast.error(r.error); refreshCues(); return }
    history.push({
      label: `Delete ${ids.length} cue${ids.length > 1 ? 's' : ''}`,
      undo: async () => {
        await Promise.all(ids.map((id) => restoreCue(id, rundown.id)))
        await refreshCues()
      },
      redo: async () => {
        setCues((prev) => prev.filter((c) => !ids.includes(c.id)))
        await deleteCues(rundown.id, ids)
      },
    })
  }, [selectedIds, rundown.id, refreshCues, history.push])

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
    // Capture old order before mutating
    const oldFullOrder = cues
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id)
    const pm = new Map(fullOrder.map((id, i) => [id, i]))
    const snapshot = cues
    setCues((cs) => cs.map((c) => ({ ...c, position: pm.get(c.id) ?? c.position })))
    const r = await reorderCues(rundown.id, fullOrder)
    if (r.error) { toast.error(r.error); setCues(snapshot); return }
    history.push({
      label: 'Reorder cues',
      undo: async () => {
        const pm2 = new Map(oldFullOrder.map((id, i) => [id, i]))
        setCues((cs) => cs.map((c) => ({ ...c, position: pm2.get(c.id) ?? c.position })))
        await reorderCues(rundown.id, oldFullOrder)
      },
      redo: async () => {
        setCues((cs) => cs.map((c) => ({ ...c, position: pm.get(c.id) ?? c.position })))
        await reorderCues(rundown.id, fullOrder)
      },
    })
  }

  function groupAggregate(children: Cue[]) {
    const timed = children.map((c) => timedMap[c.id]).filter(Boolean) as CueTimingOutput[]
    const durationMs = children.reduce((s, c) => s + c.duration_ms, 0)
    const startMs = timed.length ? timed[0].calculated_start_ms : 0
    const last = timed[timed.length - 1]
    const endMs = last ? last.calculated_start_ms + last.duration_ms : startMs
    return { durationMs, startMs, endMs, count: children.length }
  }

  function renderCueRow(cue: CueTimingOutput, rawNumber: string, depth: number) {
    const displayNumber = formatCueNumber(
      rawNumber,
      rundownSettings.cue_number_prefix,
      rundownSettings.cue_number_start,
      rundownSettings.cue_number_digits
    )
    return (
      <CueRow
        key={cue.id}
        cue={cue}
        displayNumber={displayNumber}
        timeFormat={rundownSettings.time_display}
        depth={depth}
        columns={visibleColumns}
        cells={cells}
        rundownId={rundown.id}
        selected={selectedIds.has(cue.id)}
        onSelect={handleSelect}
        onDelete={handleDeleteCue}
        onUpdate={handleUpdateCue}
        onConvertToHeading={handleConvertToHeading}
        onAddAbove={(id) => handleAddCueAt(id, 'above')}
        onAddBelow={(id) => handleAddCueAt(id, 'below')}
        onDuplicate={handleDuplicateSingle}
        onCellChange={handleCellChange}
        live={live.isLive}
        isActive={cue.id === live.activeCueId}
        isNext={cue.id === live.nextCueId}
        liveRemainingMs={cue.id === live.activeCueId ? live.remainingMs : null}
        liveElapsedMs={cue.id === live.activeCueId ? live.elapsedMs : null}
        liveGetElapsedMs={cue.id === live.activeCueId ? live.getElapsedMs : undefined}
        onJump={live.jumpTo}
        privateNote={privateNotes[cue.id] ?? ''}
        onPrivateNoteChange={handlePrivateNoteChange}
        privateNotesIndex={privateNotesIndex}
        isFirst={cue.id === firstCueId}
        nextAutoStart={nextAutoStartOf[cue.id] ?? null}
        onToggleNextAutoStart={() => toggleNextAutoStart(cue.id)}
        titleWidth={titleWidth}
      />
    )
  }

  const isEmpty = cues.length === 0
  const rowWidth = totalRowWidth(titleWidth, visibleColumns.map((c) => c.width))

  return (
    <RundownDataProvider
      value={{ rundownId: rundown.id, mentions, variables, setMentions, setVariables, rundownSettings, onSaveSettings: handleSaveSettings }}
    >
      <div className="flex flex-col h-full bg-[#09090d] overflow-hidden">
        <RundownHeader
          rundown={rundown}
          columns={columns}
          onPlayClick={() => (live.isLive ? live.end() : live.start())}
          isLive={live.isLive}
          onOpenSettings={(tab) => {
            setSettingsTab(tab ?? 'display')
            setSettingsOpen(true)
          }}
          onOpenMentions={(tab) => {
            setMentionsTab(tab ?? 'mentions')
            setMentionsOpen(true)
          }}
          onResetTiming={() => {
            live.end()
            toast.success('Rundown timing reset')
          }}
          onOpenTrash={() => setTrashOpen(true)}
          searchCues={searchCues}
          onSearchSelect={handleSearchSelect}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          undoLabel={history.undoLabel}
          redoLabel={history.redoLabel}
          onUndo={async () => {
            const label = await history.undo()
            if (label) toast.success(`Undo: ${label}`)
          }}
          onRedo={async () => {
            const label = await history.redo()
            if (label) toast.success(`Redo: ${label}`)
          }}
        />

        {live.isLive && <TransportBar live={live} cues={liveCues} />}

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

          {/* Single scroll container — header is sticky so it always aligns with rows,
              and min-width:max-content keeps horizontal scroll synced */}
          <div
            data-cue-scroll="1"
            className="flex-1 overflow-auto min-h-0 bg-[#09090d]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedIds(new Set())
            }}
          >
          <div style={{ minWidth: 'max-content' }}>
          <div
            className="sticky top-0 z-30 bg-[#0b0b10] border-b border-[#22222a]"
            style={{ height: CF.headerH }}
          >
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
            titleWidth={titleWidth}
            onTitleWidthChange={setTitleWidth}
          />
          </div>

          <div
            className="py-1.5"
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
                          number={formatCueNumber(item.number, rundownSettings.cue_number_prefix, rundownSettings.cue_number_start, rundownSettings.cue_number_digits)}
                          rundownId={rundown.id}
                          aggregate={groupAggregate(item.children)}
                          collapsed={collapsed}
                          selected={selectedIds.has(item.heading.id)}
                          rowWidth={rowWidth}
                          timeFormat={rundownSettings.time_display}
                          onToggleCollapse={() => toggleCollapse(item.heading.id)}
                          onSelect={handleSelect}
                          onUpdate={handleUpdateCue}
                          onUngroup={handleUngroupOne}
                          onDelete={handleDeleteGroup}
                          onConvertToCue={handleConvertToCue}
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

            {/* Add cue / heading buttons */}
            <div className={cn(isEmpty ? 'py-16 flex justify-center' : 'pt-2.5 pb-4 pl-10')}>
              {isEmpty ? (
                <div className="text-center">
                  <p className="text-[#5a5c66] text-sm mb-3">No cues yet</p>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      onClick={handleAddCue}
                      className="inline-flex items-center gap-2 h-[34px] px-4 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#c8c9d0] border border-dashed border-[#2e2e38] hover:border-[#3a3a48] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add first cue
                    </button>
                    <button
                      onClick={handleAddHeading}
                      data-testid="add-heading-empty-btn"
                      className="inline-flex items-center gap-2 h-[34px] px-4 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#c8c9d0] border border-dashed border-[#2e2e38] hover:border-[#3a3a48] transition-colors"
                    >
                      <HeadingIcon className="w-3.5 h-3.5" />
                      Add heading
                    </button>
                  </div>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        data-testid="add-cue-dropdown-trigger"
                        className="inline-flex items-center gap-2 h-[34px] px-4 font-cond text-[10px] font-bold uppercase tracking-[0.14em] bg-transparent text-[#888b96] hover:text-[#c8c9d0] border border-dashed border-[#2e2e38] hover:border-[#3a3a48] transition-colors"
                      />
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                    <ChevronDown className="w-3 h-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-44 p-0">
                    <DropdownMenuItem
                      onClick={handleAddCue}
                      data-testid="add-cue-menu-item"
                      className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add cue
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleAddHeading}
                      data-testid="add-heading-menu-item"
                      className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer border-t border-[#1d1d24]"
                    >
                      <HeadingIcon className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add heading
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Live spacer — lets even the last cue pin to the top */}
            {live.isLive && <div style={{ height: '72vh' }} aria-hidden />}
          </div>{/* end rows wrapper */}
          </div>{/* end min-width wrapper */}
          </div>{/* end single scroll container */}
        </div>

        {/* Footer summary */}
        <div className="shrink-0 border-t border-[#22222a] bg-[#0b0b10] px-[22px] h-[38px] flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-cond text-[9px] font-bold uppercase tracking-[0.14em] text-[#888b96]">End of rundown</span>
            <span
              className={cn(
                'font-mono tabular-nums',
                live.isLive ? 'text-[#5a5c66] line-through' : 'text-[#c8c9d0]'
              )}
            >
              {formatMsToTimeDisplay(plannedEndMs, rundownSettings.time_display)}
            </span>
          </div>
          {live.isLive && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-cond text-[9px] font-bold uppercase tracking-[0.14em] text-[#888b96]">Calculated end</span>
                <span className="font-mono tabular-nums text-[#eef0f3]">
                  {formatMsToTimeDisplay(plannedEndMs + live.overUnderMs, rundownSettings.time_display)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-cond text-[9px] font-bold uppercase tracking-[0.14em] text-[#888b96]">Over / Under</span>
                <span
                  className="font-mono tabular-nums"
                  style={{
                    color:
                      Math.abs(live.overUnderMs) < 1000 ? '#9ba0ab' : live.overUnderMs > 0 ? '#ff5a73' : '#18d986',
                  }}
                >
                  {Math.abs(live.overUnderMs) < 1000
                    ? 'on time'
                    : `${live.overUnderMs < 0 ? '−' : '+'}${formatDuration(Math.abs(live.overUnderMs))} ${live.overUnderMs > 0 ? 'late' : 'early'}`}
                </span>
              </div>
            </>
          )}
          <div className="ml-auto font-mono text-[#888b96]">
            {realCueCount} {realCueCount === 1 ? 'cue' : 'cues'} · {formatDuration(totalDurationMs)} total
          </div>
        </div>

        <RundownSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialTab={settingsTab}
        />

        <MentionsVariablesDialog
          open={mentionsOpen}
          onOpenChange={setMentionsOpen}
          initialTab={mentionsTab}
        />

        <RundownTrashDialog
          open={trashOpen}
          onOpenChange={setTrashOpen}
          rundownId={rundown.id}
          onRestored={refreshCues}
        />
      </div>
    </RundownDataProvider>
  )
}
