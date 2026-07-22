'use client'

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from 'react'
import { Plus, Heading as HeadingIcon, ArrowUpToLine } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { updateRundownStatus, takeShowControl, updateRundownRules } from '@/app/actions/rundowns'
import { RulesPanel } from './RulesPanel'
import { evaluateRules } from '@/lib/rules'
import { useDebouncedValue } from './useDebouncedValue'
import { normalizeStatus, type RundownStatus } from '@/lib/rundownStatus'
import { createAdminActions, createCollabActions } from './rundownActions'
import { collabTakeControl } from '@/app/actions/collab'
import type { CollabContext } from './RundownDataContext'
import { useUndoHistory } from './useUndoHistory'
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
import { FinalizeWarningDialog, type NotFinalCueRef } from './FinalizeWarningDialog'
import { emptyFilters, hasActiveFilters, computeCueVisibility, type CueFilterState } from './cueFilters'
import { RundownDataProvider } from './RundownDataContext'
import type { RundownSettings } from './RundownDataContext'
import { useSaveStatus } from './useSaveStatus'
import { useGridNavigation } from './useGridNavigation'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'
import { buildCueLayout, formatCueNumber } from './cueTree'
import { CF, totalRowWidth } from './layout'
import { useLiveShow } from './useLiveShow'
import { useBroadcastLive, useLeaderState, useLiveSubscription, usePresence, colorForIdentity } from './liveSync'
import {
  calculateTimings,
  formatMsToTimeDisplay,
  formatDuration,
  type CueTimingOutput,
  type TimeDisplay,
} from '@/lib/timing'
import { newScriptBlock, scriptsWordCount, autoDurationMs } from '@/lib/scripts'
import { toast } from 'sonner'
import { cn, stripHtml } from '@/lib/utils'
import type {
  Rundown,
  Cue,
  Column,
  Cell,
  Mention,
  Variable,
  ScriptBlock,
  CellAttachment,
  RundownRule,
} from '@/lib/supabase/types'

interface RundownEditorProps {
  rundown: Rundown
  initialCues: Cue[]
  initialColumns: Column[]
  initialCells: Cell[]
  initialMentions: Mention[]
  initialVariables: Variable[]
  initialPrivateNotes: Record<string, string>
  /** Present when this editor is being rendered for a collaboration link
   *  instead of the authenticated owner — see RundownDataContext's
   *  CollabContext. Column edits are locked to `editableColumns`; group
   *  create/dissolve and project-management controls (Settings, Trash,
   *  Save as template, Share, rename rundown, Dashboard) are hidden.
   *  Everything else (reorder/resize/rename columns, reorder/recolor/
   *  duplicate/add/delete cues, scripts, durations, not-final, mentions
   *  & variables, export, and — if canRunShow — driving the live show) is
   *  fully available, matching the admin editor. */
  collab?: CollabContext | null
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

function cellAttachmentsToMap(cells: Cell[]): Record<string, CellAttachment[]> {
  return Object.fromEntries(
    cells.map((c) => [`${c.cue_id}:${c.column_id}`, c.attachments ?? []])
  )
}

// Backfills scripts/duration_mode/not_final for cues read before the #54/#59
// migrations have been applied, so a stale DB can't crash the editor.
function normalizeCue(c: Cue): Cue {
  return {
    ...c,
    scripts: c.scripts ?? [],
    duration_mode: c.duration_mode ?? 'manual',
    not_final: c.not_final ?? false,
  }
}

export function RundownEditor({
  rundown,
  initialCues,
  initialColumns,
  initialCells,
  initialMentions,
  initialVariables,
  initialPrivateNotes,
  collab = null,
}: RundownEditorProps) {
  const actions = useMemo(
    () => (collab ? createCollabActions(collab.token) : createAdminActions(rundown.id)),
    [collab, rundown.id]
  )
  const [cues, setCues] = useState<Cue[]>(() => initialCues.map(normalizeCue))
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [cells, setCells] = useState<Record<string, string>>(() =>
    cellsToMap(initialCells)
  )
  const [cellAttachments, setCellAttachments] = useState<Record<string, CellAttachment[]>>(() =>
    cellAttachmentsToMap(initialCells)
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

  // Conditional rules (#65) — owner-edited only, but their visual results
  // (row color/badges) apply for everyone including collaborators.
  const [rules, setRules] = useState<RundownRule[]>(rundown.rules ?? [])
  const [rulesOpen, setRulesOpen] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'display' | 'numbering'>('display')
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [mentionsTab, setMentionsTab] = useState<'mentions' | 'variables'>('mentions')
  const [trashOpen, setTrashOpen] = useState(false)
  const [rundownStatus, setRundownStatus] = useState<RundownStatus>(normalizeStatus(rundown.status))
  const [statusSaving, setStatusSaving] = useState(false)
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set())
  const [batchDuplicating, setBatchDuplicating] = useState(false)
  const { saveStatus, trackSave } = useSaveStatus()
  const handleRulesChange = useCallback((next: RundownRule[]) => {
    setRules(next)
    trackSave(updateRundownRules(rundown.id, next)).then((r) => {
      if (r?.error) toast.error(r.error)
    })
  }, [rundown.id, trackSave])
  const [finalizeWarningOpen, setFinalizeWarningOpen] = useState(false)
  const [filters, setFilters] = useState<CueFilterState>(() => emptyFilters())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Per-user view state below starts at deterministic defaults so the first
  // client render matches the server, then hydrates from localStorage after
  // mount (see the hydrate effect) — this avoids React hydration mismatches.
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [privateNotesIndex, setPrivateNotesIndex] = useState<number>(9999)
  const [titleIndex, setTitleIndex] = useState<number>(0)
  const [titleWidth, setTitleWidth] = useState<number>(240)
  const [privateNotesWidth, setPrivateNotesWidth] = useState<number>(210)
  const [focusCueId, setFocusCueId] = useState<string | null>(null)
  const [focusScriptId, setFocusScriptId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const lastSelectedRef = useRef<string | null>(null)
  const cuesRef = useRef(cues)
  cuesRef.current = cues
  // Prevents double-submit when add buttons are clicked rapidly
  const addingRef = useRef(false)
  // A newly-added cue is first rendered with a temporary client-side id, then
  // swapped for the real DB id once the insert resolves. Without this map, that
  // swap changes the row's React key, which unmounts/remounts CueRow — dropping
  // whatever the user had already started typing into the still-open editor.
  // This keeps the row's render key stable across the swap.
  const cueRenderKeyRef = useRef<Map<string, string>>(new Map())
  const getRenderKey = useCallback(
    (id: string) => cueRenderKeyRef.current.get(id) ?? id,
    []
  )
  // Tracks which half (top/bottom) the dragged item is over during a drag
  const dragHalfRef = useRef<'top' | 'bottom'>('bottom')

  const history = useUndoHistory()

  // Stable ref so the keydown handler never needs to re-register
  const historyRef = useRef(history)
  historyRef.current = history
  const undoExecutingRef = useRef(false)

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z keyboard shortcuts
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      // Don't intercept while typing in inputs, textareas, or contenteditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key !== 'z' && e.key !== 'y') return
      e.preventDefault()
      // Guard: ignore keydown repeats and concurrent async operations
      if (undoExecutingRef.current) return
      undoExecutingRef.current = true
      try {
        if (e.key === 'z' && !e.shiftKey) {
          const label = await historyRef.current.undo()
          if (label) toast.success(`Undo: ${label}`)
        } else {
          const label = await historyRef.current.redo()
          if (label) toast.success(`Redo: ${label}`)
        }
      } finally {
        undoExecutingRef.current = false
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Hydrate per-user view state from localStorage after mount.
  useEffect(() => {
    setHiddenCols(loadSet(rundown.id, 'hiddenCols'))
    setCollapsedGroups(loadSet(rundown.id, 'collapsedGroups'))
    const tw = window.localStorage.getItem(lsKey(rundown.id, 'titleWidth'))
    const twN = tw ? parseInt(tw, 10) : NaN
    if (!isNaN(twN)) setTitleWidth(twN)
    const pnw = window.localStorage.getItem(lsKey(rundown.id, 'privateNotesWidth'))
    const pnwN = pnw ? parseInt(pnw, 10) : NaN
    if (!isNaN(pnwN)) setPrivateNotesWidth(pnwN)
    const pni = window.localStorage.getItem(lsKey(rundown.id, 'privateNotesIndex'))
    if (pni !== null) {
      const n = parseInt(pni, 10)
      if (!isNaN(n)) setPrivateNotesIndex(n)
    }
    const ti = window.localStorage.getItem(lsKey(rundown.id, 'titleIndex'))
    if (ti !== null) {
      const n = parseInt(ti, 10)
      if (!isNaN(n)) setTitleIndex(n)
    }
    setHydrated(true)
  }, [rundown.id])

  // Persist per-user view state — only after hydration, so the initial defaults
  // never clobber the stored values.
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(lsKey(rundown.id, 'hiddenCols'), JSON.stringify([...hiddenCols]))
  }, [hiddenCols, rundown.id, hydrated])
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(lsKey(rundown.id, 'collapsedGroups'), JSON.stringify([...collapsedGroups]))
  }, [collapsedGroups, rundown.id, hydrated])
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(lsKey(rundown.id, 'privateNotesIndex'), String(privateNotesIndex))
  }, [privateNotesIndex, rundown.id, hydrated])
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(lsKey(rundown.id, 'titleIndex'), String(titleIndex))
  }, [titleIndex, rundown.id, hydrated])
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(lsKey(rundown.id, 'titleWidth'), String(titleWidth))
  }, [titleWidth, rundown.id, hydrated])
  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(lsKey(rundown.id, 'privateNotesWidth'), String(privateNotesWidth))
  }, [privateNotesWidth, rundown.id, hydrated])

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
      title: stripHtml(c.title ?? ''),
      cue_type: c.cue_type as 'cue' | 'heading',
    }))
  , [layout, rundownSettings])

  const notFinalCues = useMemo<NotFinalCueRef[]>(() =>
    layout.docOrder
      .filter((c) => c.cue_type !== 'heading' && c.not_final)
      .map((c) => ({
        id: c.id,
        displayNumber: formatCueNumber(
          layout.numberOf[c.id] ?? '',
          rundownSettings.cue_number_prefix,
          rundownSettings.cue_number_start,
          rundownSettings.cue_number_digits
        ),
        title: stripHtml(c.title ?? ''),
      }))
  , [layout, rundownSettings])

  const commitStatusChange = useCallback(async (next: RundownStatus) => {
    setRundownStatus(next)
    setStatusSaving(true)
    try {
      const result = await updateRundownStatus(rundown.id, next)
      if (result?.error) toast.error(result.error)
    } finally {
      setStatusSaving(false)
    }
  }, [rundown.id])

  const handleChangeStatus = useCallback((next: RundownStatus) => {
    if (next === 'finalized' && notFinalCues.length > 0) {
      setFinalizeWarningOpen(true)
      return
    }
    commitStatusChange(next)
  }, [notFinalCues, commitStatusChange])

  // Scrolling to a not-final cue from the finalize-warning dialog must first
  // reveal it — expand its group and drop any active filter that would hide it.
  const handleScrollToNotFinalCue = useCallback((id: string) => {
    const cue = cuesRef.current.find((c) => c.id === id)
    if (cue?.group_id) {
      setCollapsedGroups((prev) => {
        if (!prev.has(cue.group_id!)) return prev
        const next = new Set(prev)
        next.delete(cue.group_id!)
        return next
      })
    }
    setFilters((prev) => (hasActiveFilters(prev) ? emptyFilters() : prev))
    setTimeout(() => handleSearchSelect(id), 50)
  }, [handleSearchSelect])

  const timedCues = useMemo(() => calculateTimings(layout.docOrder), [layout])
  const timedMap = useMemo(
    () => Object.fromEntries(timedCues.map((t) => [t.id, t])) as Record<string, CueTimingOutput>,
    [timedCues]
  )

  // Rule evaluation is debounced 300ms behind edits so typing in a text cell
  // doesn't re-run every active rule on every keystroke.
  const debouncedTimedCues = useDebouncedValue(timedCues, 300)
  const debouncedCells = useDebouncedValue(cells, 300)
  const ruleResults = useMemo(
    () => evaluateRules(rules, debouncedTimedCues, columns, debouncedCells),
    [rules, debouncedTimedCues, columns, debouncedCells]
  )
  const groups = useMemo(
    () => cues.filter((c) => c.cue_type === 'heading').map((h) => ({ id: h.id, title: h.title })),
    [cues]
  )
  // Live navigation skips heading rows
  const liveCues = useMemo(
    () => timedCues.filter((c) => c.cue_type !== 'heading'),
    [timedCues]
  )
  const live = useLiveShow(liveCues)

  // Show control: null leaderToken means the owner is driving (the default).
  // A collaboration link with canRunShow can take control instead — this
  // gate stops our own idle/stale state from clobbering their broadcast.
  const leader = useLeaderState(rundown.id)
  const myLeaderIdentity = collab ? collab.token : null
  const isShowLeader = leader.leaderToken === myLeaderIdentity
  const canRunShow = !collab || collab.canRunShow

  // Presence — who else currently has this rundown open.
  const ownerSessionIdRef = useRef<string>(crypto.randomUUID())
  const me = useMemo(
    () =>
      collab
        ? { id: collab.token, label: collab.label, color: colorForIdentity(collab.token) }
        : { id: ownerSessionIdRef.current, label: 'Owner', color: colorForIdentity('owner') },
    [collab]
  )
  const presentOthers = usePresence(rundown.id, me)

  // Broadcast the live show state (incl. timing) to read-only viewers
  useBroadcastLive(rundown.id, {
    activeCueId: live.activeCueId,
    nextCueId: live.nextCueId,
    status: live.status,
    elapsedMs: live.elapsedMs,
    durationMs: live.activeDurationMs,
    isLive: live.isLive,
  }, isShowLeader)

  // Demotion: notify if someone else takes over show control out from
  // under us — our Run Show UI silently goes read-only otherwise.
  const wasLeaderRef = useRef(isShowLeader)
  useEffect(() => {
    if (wasLeaderRef.current && !isShowLeader) {
      toast(`Show control has been taken by ${leader.leaderLabel}. You are now in view mode.`)
    }
    wasLeaderRef.current = isShowLeader
  }, [isShowLeader, leader.leaderLabel])

  // Owner/non-driving-collaborator follow mode: when someone else is
  // leading, mirror their broadcast state instead of our own (idle) local
  // state, so the current/next cue highlighting and countdown still track
  // the live show. When we ARE the leader, our own state is authoritative
  // and zero-latency, so we use that instead of round-tripping our own
  // broadcast back through the subscription.
  const remoteLive = useLiveSubscription(rundown.id)
  const effectiveLive = useMemo(() => {
    if (isShowLeader) {
      return {
        isLive: live.isLive,
        activeCueId: live.activeCueId,
        nextCueId: live.nextCueId,
        remainingMs: live.remainingMs,
        elapsedMs: live.elapsedMs,
        getElapsedMs: live.getElapsedMs,
      }
    }
    const remoteIsLive = remoteLive.status === 'running' || remoteLive.status === 'paused'
    const getElapsed = () =>
      remoteLive.status === 'running' ? remoteLive.elapsedMs + (Date.now() - remoteLive.sentAt) : remoteLive.elapsedMs
    return {
      isLive: remoteIsLive,
      activeCueId: remoteLive.activeCueId,
      nextCueId: remoteLive.nextCueId,
      remainingMs: remoteLive.durationMs - getElapsed(),
      elapsedMs: getElapsed(),
      getElapsedMs: getElapsed,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowLeader, live.isLive, live.activeCueId, live.nextCueId, live.remainingMs, live.elapsedMs, remoteLive])

  // Live transport keyboard shortcuts: Space / ArrowDown = next cue, ArrowUp = previous.
  // Stable ref so the keydown handler never needs to re-register.
  const liveRef = useRef(live)
  liveRef.current = live
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!liveRef.current.isLive) return
      if (e.key !== ' ' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      // Don't intercept while typing in inputs, textareas, or contenteditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.preventDefault()
      // Holding a key down shouldn't rapid-fire through the rundown
      if (e.repeat) return
      if (e.key === 'ArrowUp') liveRef.current.prev()
      else liveRef.current.next()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── "Jump to current cue" pill: appears when the operator scrolls the live
  // cue out of view (to check something elsewhere in the rundown). ───────────
  const cueScrollRef = useRef<HTMLDivElement>(null)
  const [showJumpToCurrent, setShowJumpToCurrent] = useState(false)

  const scrollActiveCueToTop = useCallback(() => {
    const cont = cueScrollRef.current
    if (!cont || !effectiveLive.activeCueId) return
    const row = cont.querySelector<HTMLElement>(`[data-cue-id="${effectiveLive.activeCueId}"]`)
    if (!row) return
    const cr = cont.getBoundingClientRect()
    const rr = row.getBoundingClientRect()
    cont.scrollTo({ top: cont.scrollTop + (rr.top - cr.top) - (CF.headerH + 8), behavior: 'smooth' })
  }, [effectiveLive.activeCueId])

  useEffect(() => {
    const cont = cueScrollRef.current
    if (!cont || !effectiveLive.isLive) { setShowJumpToCurrent(false); return }
    function check() {
      if (!cont || !effectiveLive.activeCueId) { setShowJumpToCurrent(false); return }
      const row = cont.querySelector<HTMLElement>(`[data-cue-id="${effectiveLive.activeCueId}"]`)
      if (!row) { setShowJumpToCurrent(false); return }
      const cr = cont.getBoundingClientRect()
      const rr = row.getBoundingClientRect()
      const top = rr.top - cr.top
      const bottom = rr.bottom - cr.top
      // Hidden = fully under the sticky header or fully below the viewport.
      setShowJumpToCurrent(bottom <= CF.headerH + 2 || top >= cr.height - 2)
    }
    cont.addEventListener('scroll', check, { passive: true })
    check()
    return () => cont.removeEventListener('scroll', check)
  }, [effectiveLive.isLive, effectiveLive.activeCueId])

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
      actions.updateCue(next.id, { auto_start: value })
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

  // Filters only affect which rows render — the timing/live pipeline above
  // always sees every cue, so hiding a cue from view can never skip it live.
  const filtersActive = hasActiveFilters(filters)
  const visibility = useMemo(
    () => computeCueVisibility(layout, filters, cells),
    [layout, filters, cells]
  )
  const visibleCueCount = useMemo(
    () => cues.filter((c) => c.cue_type !== 'heading' && visibility.cueIds.has(c.id)).length,
    [cues, visibility]
  )
  const visibleDurationMs = useMemo(
    () =>
      cues.reduce(
        (s, c) => s + (c.cue_type === 'heading' || !visibility.cueIds.has(c.id) ? 0 : c.duration_ms),
        0
      ),
    [cues, visibility]
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
    const r = await actions.getRundownCues()
    setCues(r.cues.map(normalizeCue))
    setCells(cellsToMap(r.cells))
    setCellAttachments(cellAttachmentsToMap(r.cells))
  }, [actions])

  // --- Add cue ---
  async function handleAddCue() {
    if (addingRef.current) return
    addingRef.current = true
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
      duration_mode: 'manual',
      scripts: [],
      not_final: false,
      background_color: null,
      locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
    setCues((prev) => [...prev, optimisticCue])
    setFocusCueId(optimisticCue.id)
    cueRenderKeyRef.current.set(optimisticCue.id, optimisticCue.id)
    try {
      const result = await actions.addCue(maxPos)
      if (result.error) {
        toast.error(result.error)
        setCues((prev) => prev.filter((c) => c.id !== optimisticCue.id))
        setFocusCueId(null)
        cueRenderKeyRef.current.delete(optimisticCue.id)
      } else if (result.cue) {
        const realCue = normalizeCue(result.cue)
        const stableKey = cueRenderKeyRef.current.get(optimisticCue.id) ?? optimisticCue.id
        cueRenderKeyRef.current.delete(optimisticCue.id)
        cueRenderKeyRef.current.set(realCue.id, stableKey)
        // Merge onto whatever is currently in local state (not `realCue` wholesale) —
        // the user may have already typed into and confirmed the title while the
        // insert was in flight, and that edit must win over the DB's empty value.
        setCues((prev) => prev.map((c) => (c.id === optimisticCue.id
          ? { ...c, id: realCue.id, cue_number: realCue.cue_number, position: realCue.position, created_at: realCue.created_at, updated_at: realCue.updated_at }
          : c)))
        setFocusCueId(realCue.id)
        history.push({
          label: 'Add cue',
          undo: async () => {
            setCues((prev) => prev.filter((c) => c.id !== realCue.id))
            await actions.deleteCue(realCue.id)
          },
          redo: async () => {
            await actions.restoreCue(realCue.id)
            await refreshCues()
          },
        })
      }
    } finally {
      addingRef.current = false
    }
  }

  async function handleAddHeading() {
    if (addingRef.current) return
    addingRef.current = true
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
      duration_mode: 'manual',
      scripts: [],
      not_final: false,
      background_color: null,
      locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
    setCues((prev) => [...prev, optimisticCue])
    setFocusCueId(optimisticCue.id)
    cueRenderKeyRef.current.set(optimisticCue.id, optimisticCue.id)
    try {
      const result = await actions.addHeading(maxPos)
      if (result.error) {
        toast.error(result.error)
        setCues((prev) => prev.filter((c) => c.id !== optimisticCue.id))
        setFocusCueId(null)
        cueRenderKeyRef.current.delete(optimisticCue.id)
      } else if (result.cue) {
        const realCue = normalizeCue(result.cue)
        const stableKey = cueRenderKeyRef.current.get(optimisticCue.id) ?? optimisticCue.id
        cueRenderKeyRef.current.delete(optimisticCue.id)
        cueRenderKeyRef.current.set(realCue.id, stableKey)
        setCues((prev) => prev.map((c) => (c.id === optimisticCue.id
          ? { ...c, id: realCue.id, cue_number: realCue.cue_number, position: realCue.position, created_at: realCue.created_at, updated_at: realCue.updated_at }
          : c)))
        setFocusCueId(realCue.id)
        history.push({
          label: 'Add heading',
          undo: async () => {
            setCues((prev) => prev.filter((c) => c.id !== realCue.id))
            await actions.deleteCue(realCue.id)
          },
          redo: async () => {
            await actions.restoreCue(realCue.id)
            await refreshCues()
          },
        })
      }
    } finally {
      addingRef.current = false
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
    actions.updateCue(id, { cue_type: 'heading', group_id: null, duration_ms: 0, start_type: 'soft', start_time_override: null }).then((r) => {
      if (r.error) { toast.error(r.error); refreshCues() }
    })
  }, [actions, refreshCues])

  const handleConvertToCue = useCallback((id: string) => {
    setCues((prev) =>
      prev.map((c) => c.id === id ? { ...c, cue_type: 'cue' as const } : c)
    )
    actions.updateCue(id, { cue_type: 'cue' }).then((r) => {
      if (r.error) { toast.error(r.error); refreshCues() }
    })
  }, [actions, refreshCues])

  const handleAddCueAt = useCallback(async (id: string, direction: 'above' | 'below') => {
    if (addingRef.current) return
    addingRef.current = true
    const sorted = [...cuesRef.current].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex((c) => c.id === id)
    if (idx < 0) { addingRef.current = false; return }
    const targetCue = sorted[idx]
    // Inherit the group_id so cues added inside a group stay inside it (#45)
    const groupId = targetCue.group_id ?? undefined
    try {
      const r = await actions.addCue(sorted.length, groupId)
      if (r.error || !r.cue) { toast.error(r.error ?? 'Failed to add cue'); return }
      const newCue = normalizeCue(r.cue)
      setFocusCueId(newCue.id)
      const orderIds = sorted.map((c) => c.id)
      orderIds.splice(direction === 'above' ? idx : idx + 1, 0, newCue.id)
      // Optimistic reorder: avoid a refreshCues() roundtrip that can race with Supabase replication
      setCues(() => orderIds.map((oid, i) => {
        if (oid === newCue.id) return { ...newCue, position: i }
        const c = cuesRef.current.find((x) => x.id === oid)
        return c ? { ...c, position: i } : null
      }).filter(Boolean) as typeof sorted)
      await actions.reorderCues(orderIds)
    } finally {
      addingRef.current = false
    }
  }, [rundown.id, setFocusCueId])

  const handleAddCueAtHeading = useCallback(async (id: string, direction: 'above' | 'below') => {
    if (direction === 'above') {
      await handleAddCueAt(id, 'above')
    } else {
      // For group headings: add after the last child; for standalone headings: after the heading
      const groupItem = layout.items.find((item) => item.type === 'group' && item.heading.id === id)
      if (groupItem && groupItem.type === 'group' && groupItem.children.length > 0) {
        const lastChild = groupItem.children[groupItem.children.length - 1]
        await handleAddCueAt(lastChild.id, 'below')
      } else {
        await handleAddCueAt(id, 'below')
      }
    }
  }, [handleAddCueAt, layout])

  const handleRemoveFromGroup = useCallback(async (cueId: string) => {
    const cue = cuesRef.current.find((c) => c.id === cueId)
    if (!cue?.group_id) return
    const groupItem = layout.items.find((item) => item.type === 'group' && item.heading.id === cue.group_id)
    const sorted = [...cuesRef.current].sort((a, b) => a.position - b.position)
    // Find the last member of the group to insert after it
    const lastMemberId = groupItem && groupItem.type === 'group' && groupItem.children.length > 0
      ? groupItem.children[groupItem.children.length - 1].id
      : cue.group_id
    const withoutCue = sorted.filter((c) => c.id !== cueId).map((c) => c.id)
    const insertAfterIdx = withoutCue.findIndex((id) => id === lastMemberId)
    withoutCue.splice(insertAfterIdx + 1, 0, cueId)
    // Optimistic update
    setCues((prev) => {
      const pm = new Map(withoutCue.map((id, i) => [id, i]))
      return prev.map((c) => c.id === cueId
        ? { ...c, group_id: null, position: pm.get(c.id) ?? c.position }
        : { ...c, position: pm.get(c.id) ?? c.position }
      )
    })
    const [r1, r2] = await Promise.all([
      actions.updateCue(cueId, { group_id: null }),
      actions.reorderCues(withoutCue),
    ])
    const r = r1.error ? r1 : r2
    if (r.error) { toast.error(r.error); refreshCues() }
  }, [layout, actions, refreshCues])

  const handleDuplicateSingle = useCallback(async (id: string) => {
    setDuplicatingIds((prev) => new Set(prev).add(id))
    try {
      const r = await actions.duplicateCues([id])
      if (r.error) { toast.error(r.error); return }
      await refreshCues()
    } finally {
      setDuplicatingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
  }, [rundown.id, refreshCues])

  // --- Single-cue handlers (passed to rows) ---
  const handleDeleteCue = useCallback((id: string) => {
    const snap = cuesRef.current.find((c) => c.id === id)
    setCues((prev) => prev.filter((c) => c.id !== id))
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    actions.deleteCue(id).then((r) => {
      if (r.error) { toast.error(r.error); refreshCues() }
    })
    if (snap) {
      history.push({
        label: `Delete "${stripHtml(snap.title) || 'Untitled cue'}"`,
        undo: async () => {
          await actions.restoreCue(id)
          await refreshCues()
        },
        redo: async () => {
          setCues((prev) => prev.filter((c) => c.id !== id))
          await actions.deleteCue(id)
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
  const handleCellAttachmentsChange = useCallback(
    (cueId: string, columnId: string, attachments: CellAttachment[]) => {
      setCellAttachments((prev) => ({ ...prev, [`${cueId}:${columnId}`]: attachments }))
    },
    []
  )
  const handlePrivateNoteChange = useCallback((cueId: string, content: string) => {
    setPrivateNotes((prev) => ({ ...prev, [cueId]: content }))
  }, [])

  // --- Script/talent-text handlers ---
  const handleAddScript = useCallback((cueId: string) => {
    const cue = cuesRef.current.find((c) => c.id === cueId)
    if (!cue) return
    const block = newScriptBlock()
    const scripts = [...cue.scripts, block]
    setFocusScriptId(block.id)
    setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, scripts } : c)))
    trackSave(actions.updateCue(cueId, { scripts }))
  }, [rundown.id, trackSave])

  const handleScriptsChange = useCallback((cueId: string, scripts: ScriptBlock[]) => {
    const cue = cuesRef.current.find((c) => c.id === cueId)
    if (!cue) return
    const updates: Partial<Cue> = { scripts }
    if (cue.duration_mode === 'auto') {
      const words = scriptsWordCount(scripts)
      // Zero words shouldn't zero out the duration — keep the last computed value (#54 edge case).
      if (words > 0) updates.duration_ms = autoDurationMs(words)
    }
    setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, ...updates } : c)))
    trackSave(actions.updateCue(cueId, updates))
  }, [rundown.id, trackSave])

  const handleDeleteScript = useCallback((cueId: string, scriptId: string) => {
    const cue = cuesRef.current.find((c) => c.id === cueId)
    if (!cue) return
    const scripts = cue.scripts.filter((s) => s.id !== scriptId)
    const updates: Partial<Cue> = { scripts }
    if (scripts.length === 0 && cue.duration_mode === 'auto') {
      // Revert to manual, preserving the last auto-computed duration as-is.
      updates.duration_mode = 'manual'
    }
    setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, ...updates } : c)))
    trackSave(actions.updateCue(cueId, updates))
  }, [rundown.id, trackSave])

  const handleToggleScriptCollapsed = useCallback((cueId: string, scriptId: string) => {
    const cue = cuesRef.current.find((c) => c.id === cueId)
    if (!cue) return
    const scripts = cue.scripts.map((s) => (s.id === scriptId ? { ...s, collapsed: !s.collapsed } : s))
    setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, scripts } : c)))
    actions.updateCue(cueId, { scripts })
  }, [rundown.id])

  const handleSetDurationMode = useCallback((cueId: string, mode: 'manual' | 'auto') => {
    const cue = cuesRef.current.find((c) => c.id === cueId)
    if (!cue) return
    const updates: Partial<Cue> = { duration_mode: mode }
    if (mode === 'auto') {
      const words = scriptsWordCount(cue.scripts)
      if (words > 0) updates.duration_ms = autoDurationMs(words)
    }
    setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, ...updates } : c)))
    trackSave(actions.updateCue(cueId, updates))
  }, [rundown.id, trackSave])

  // Columns-dropdown bulk actions: expand/collapse every script block in the rundown at once.
  const handleSetAllScriptsCollapsed = useCallback(async (collapsed: boolean) => {
    const affected = cuesRef.current.filter((c) => c.scripts.length > 0)
    if (affected.length === 0) return
    const nextScriptsByCue = new Map(
      affected.map((c) => [c.id, c.scripts.map((s) => ({ ...s, collapsed }))])
    )
    setCues((prev) =>
      prev.map((c) => (nextScriptsByCue.has(c.id) ? { ...c, scripts: nextScriptsByCue.get(c.id)! } : c))
    )
    await Promise.all(
      affected.map((c) => actions.updateCue(c.id, { scripts: nextScriptsByCue.get(c.id)! }))
    )
  }, [rundown.id])

  // --- Batch handlers ---
  const handleSelectAll = useCallback(() => setSelectedIds(new Set(selectableIds)), [selectableIds])
  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleBatchDelete = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setCues((prev) => prev.filter((c) => !selectedIds.has(c.id)))
    setSelectedIds(new Set())
    const r = await actions.deleteCues(ids)
    if (r.error) { toast.error(r.error); refreshCues(); return }
    history.push({
      label: `Delete ${ids.length} cue${ids.length > 1 ? 's' : ''}`,
      undo: async () => {
        await Promise.all(ids.map((id) => actions.restoreCue(id)))
        await refreshCues()
      },
      redo: async () => {
        setCues((prev) => prev.filter((c) => !ids.includes(c.id)))
        await actions.deleteCues(ids)
      },
    })
  }, [selectedIds, rundown.id, refreshCues, history.push])

  const handleBatchBackground = useCallback(async (color: string | null) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setCues((prev) => prev.map((c) => (selectedIds.has(c.id) ? { ...c, background_color: color } : c)))
    const r = await trackSave(actions.setCuesBackground(ids, color))
    if (r.error) toast.error(r.error)
  }, [selectedIds, rundown.id, trackSave])

  const handleDuplicate = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBatchDuplicating(true)
    try {
      const r = await actions.duplicateCues(ids)
      if (r.error) return toast.error(r.error)
      await refreshCues()
      setSelectedIds(new Set())
    } finally {
      setBatchDuplicating(false)
    }
  }, [selectedIds, rundown.id, refreshCues])

  const handleGroup = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const r = await actions.groupCues(ids)
    if (r.error) return toast.error(r.error)
    await refreshCues()
    setSelectedIds(new Set())
  }, [selectedIds, rundown.id, refreshCues])

  const handleUngroup = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const r = await actions.ungroupCues(ids)
    if (r.error) return toast.error(r.error)
    await refreshCues()
    setSelectedIds(new Set())
  }, [selectedIds, rundown.id, refreshCues])

  const handleUngroupOne = useCallback(async (headingId: string) => {
    const r = await actions.ungroupCues([headingId])
    if (r.error) return toast.error(r.error)
    await refreshCues()
  }, [rundown.id, refreshCues])

  const handleDeleteGroup = useCallback(async (headingId: string) => {
    setCues((prev) => prev.filter((c) => c.id !== headingId))
    const r = await actions.deleteCues([headingId])
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
    const r = await actions.reorderCues(newOrder)
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

  // What SortableContext/JSX should actually render — visibleOrderIds() stays
  // unfiltered so drag-reorder math keeps operating on the true document order.
  const renderableIds = useMemo(
    () => visibleOrderIds().filter((id) => visibility.cueIds.has(id) || visibility.headingIds.has(id)),
    [visibleOrderIds, visibility]
  )

  const gridNav = useGridNavigation({
    cues,
    visibleColumns,
    titleIndex,
    privateNotesIndex,
    renderableIds,
    collapsedGroups,
    setCollapsedGroups,
    onAddCueBelow: (id) => handleAddCueAt(id, 'below'),
    onAddCueAtEnd: handleAddCue,
  })
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

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

    // Determine group membership change based on drop position
    const draggedCue = cueById.get(active.id as string)
    const overCue = cueById.get(over.id as string)
    let newGroupId = draggedCue?.group_id ?? null

    if (overCue?.cue_type === 'heading') {
      // Dropped on a heading: bottom half = join group, top half = leave group (place before)
      newGroupId = dragHalfRef.current === 'bottom' ? overCue.id : null
    } else if (overCue?.group_id !== undefined) {
      // Dropped on a regular cue: inherit its group membership
      newGroupId = overCue.group_id
    }

    const groupChanged = newGroupId !== (draggedCue?.group_id ?? null)

    // Capture old order before mutating
    const oldFullOrder = cues.slice().sort((a, b) => a.position - b.position).map((c) => c.id)
    const oldGroupId = draggedCue?.group_id ?? null
    const pm = new Map(fullOrder.map((id, i) => [id, i]))
    const snapshot = cues

    setCues((cs) => cs.map((c) => {
      if (c.id === active.id) return { ...c, position: pm.get(c.id) ?? c.position, group_id: newGroupId }
      return { ...c, position: pm.get(c.id) ?? c.position }
    }))

    const r = await trackSave(actions.reorderCues(fullOrder))
    if (r.error) { toast.error(r.error); setCues(snapshot); return }

    if (groupChanged && draggedCue) {
      await actions.updateCue(draggedCue.id, { group_id: newGroupId })
    }

    history.push({
      label: 'Reorder cues',
      undo: async () => {
        const pm2 = new Map(oldFullOrder.map((id, i) => [id, i]))
        setCues((cs) => cs.map((c) => {
          if (c.id === active.id) return { ...c, position: pm2.get(c.id) ?? c.position, group_id: oldGroupId }
          return { ...c, position: pm2.get(c.id) ?? c.position }
        }))
        await actions.reorderCues(oldFullOrder)
        if (groupChanged && draggedCue) await actions.updateCue(draggedCue.id, { group_id: oldGroupId })
      },
      redo: async () => {
        setCues((cs) => cs.map((c) => {
          if (c.id === active.id) return { ...c, position: pm.get(c.id) ?? c.position, group_id: newGroupId }
          return { ...c, position: pm.get(c.id) ?? c.position }
        }))
        await actions.reorderCues(fullOrder)
        if (groupChanged && draggedCue) await actions.updateCue(draggedCue.id, { group_id: newGroupId })
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

  function renderCueRow(
    cue: CueTimingOutput,
    rawNumber: string,
    depth: number,
    groupColor?: string | null,
    groupTitle?: string,
    groupRawNumber?: string
  ) {
    const displayNumber = formatCueNumber(
      rawNumber,
      rundownSettings.cue_number_prefix,
      rundownSettings.cue_number_start,
      rundownSettings.cue_number_digits
    )
    const groupDisplayNumber =
      groupRawNumber !== undefined
        ? formatCueNumber(groupRawNumber, rundownSettings.cue_number_prefix, rundownSettings.cue_number_start, rundownSettings.cue_number_digits)
        : undefined
    return (
      <CueRow
        key={getRenderKey(cue.id)}
        cue={cue}
        displayNumber={displayNumber}
        timeFormat={rundownSettings.time_display}
        depth={depth}
        rowWidth={rowWidth}
        columns={visibleColumns}
        cells={cells}
        cellAttachments={cellAttachments}
        rundownId={rundown.id}
        selected={selectedIds.has(cue.id)}
        onSelect={handleSelect}
        onDelete={handleDeleteCue}
        onUpdate={handleUpdateCue}
        onConvertToHeading={handleConvertToHeading}
        onAddAbove={(id) => handleAddCueAt(id, 'above')}
        onAddBelow={(id) => handleAddCueAt(id, 'below')}
        onDuplicate={handleDuplicateSingle}
        duplicating={duplicatingIds.has(cue.id)}
        focusedColId={gridNav.focusedCell?.cueId === cue.id ? gridNav.focusedCell.colId : null}
        onCellFocus={gridNav.focusCell}
        onRemoveFromGroup={handleRemoveFromGroup}
        onCellChange={handleCellChange}
        onCellAttachmentsChange={handleCellAttachmentsChange}
        onAddScript={handleAddScript}
        onScriptsChange={handleScriptsChange}
        onDeleteScript={handleDeleteScript}
        onToggleScriptCollapsed={handleToggleScriptCollapsed}
        onSetDurationMode={handleSetDurationMode}
        focusScriptId={focusScriptId}
        live={effectiveLive.isLive}
        isActive={cue.id === effectiveLive.activeCueId}
        isNext={cue.id === effectiveLive.nextCueId}
        liveRemainingMs={cue.id === effectiveLive.activeCueId ? effectiveLive.remainingMs : null}
        liveElapsedMs={cue.id === effectiveLive.activeCueId ? effectiveLive.elapsedMs : null}
        liveGetElapsedMs={cue.id === effectiveLive.activeCueId ? effectiveLive.getElapsedMs : undefined}
        onJump={live.jumpTo}
        privateNote={privateNotes[cue.id] ?? ''}
        onPrivateNoteChange={handlePrivateNoteChange}
        privateNotesIndex={privateNotesIndex}
        titleIndex={titleIndex}
        isFirst={cue.id === firstCueId}
        nextAutoStart={nextAutoStartOf[cue.id] ?? null}
        onToggleNextAutoStart={() => toggleNextAutoStart(cue.id)}
        titleWidth={titleWidth}
        groupColor={groupColor}
        groupTitle={groupTitle}
        groupNumber={groupDisplayNumber}
        privateNotesWidth={privateNotesWidth}
        focusTitle={cue.id === focusCueId}
        ruleResult={ruleResults.get(cue.id)}
      />
    )
  }

  const isEmpty = cues.length === 0
  const rowWidth = totalRowWidth(titleWidth, visibleColumns.map((c) => c.width), privateNotesWidth)

  return (
    <RundownDataProvider
      value={{ rundownId: rundown.id, mentions, variables, setMentions, setVariables, rundownSettings, onSaveSettings: handleSaveSettings, saveStatus, trackSave, actions, collab }}
    >
      <div className="flex flex-col h-full bg-[#09090d] overflow-hidden">
        <RundownHeader
          rundown={rundown}
          columns={columns}
          onPlayClick={async () => {
            if (live.isLive) { live.end(); return }
            if (!canRunShow) return
            // Reclaim/take show control — starting the show is always a
            // deliberate override of whoever was previously driving.
            if (collab) await collabTakeControl(collab.token)
            else await takeShowControl(rundown.id)
            leader.refresh()
            // Start from the earliest selected cue (in document order), else cue 1.
            const startId = liveCues.find((c) => selectedIds.has(c.id))?.id
            setSelectedIds(new Set())
            live.start(startId)
          }}
          isLive={live.isLive}
          canRunShow={canRunShow}
          showLeaderLabel={!isShowLeader ? leader.leaderLabel : null}
          collab={collab}
          presentOthers={presentOthers}
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
          onOpenRules={() => setRulesOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          searchCues={searchCues}
          onSearchSelect={handleSearchSelect}
          status={rundownStatus}
          statusSaving={statusSaving}
          onChangeStatus={handleChangeStatus}
          saveStatus={saveStatus}
          cues={cues}
          cells={cells}
          filters={filters}
          onFiltersChange={setFilters}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          undoLabel={history.undoLabel}
          redoLabel={history.redoLabel}
          onUndo={async () => {
            if (undoExecutingRef.current) return
            undoExecutingRef.current = true
            try {
              const label = await history.undo()
              if (label) toast.success(`Undo: ${label}`)
            } finally {
              undoExecutingRef.current = false
            }
          }}
          onRedo={async () => {
            if (undoExecutingRef.current) return
            undoExecutingRef.current = true
            try {
              const label = await history.redo()
              if (label) toast.success(`Redo: ${label}`)
            } finally {
              undoExecutingRef.current = false
            }
          }}
        />

        {isShowLeader && live.isLive && <TransportBar live={live} cues={liveCues} />}
        {!isShowLeader && effectiveLive.isLive && (
          <FollowProgressBar elapsedMs={effectiveLive.elapsedMs} durationMs={effectiveLive.remainingMs + effectiveLive.elapsedMs} />
        )}

        {/* flex-1 wrapper is relative so BatchToolbar can float above content without pushing rows */}
        <div className="flex-1 overflow-hidden relative">
          {selectedIds.size > 0 && (
            <div className="absolute top-0 left-0 right-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.55)]">
              <BatchToolbar
                count={selectedIds.size}
                canUngroup={canUngroup}
                onSelectAll={handleSelectAll}
                onDuplicate={handleDuplicate}
                duplicating={batchDuplicating}
                onGroup={handleGroup}
                onUngroup={handleUngroup}
                onMove={handleMove}
                onBackground={handleBatchBackground}
                onDelete={handleBatchDelete}
                onClear={handleClearSelection}
              />
            </div>
          )}

          {/* Single scroll container */}
          <div
            ref={cueScrollRef}
            data-cue-scroll="1"
            className="h-full overflow-auto bg-[#09090d]"
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
            titleIndex={titleIndex}
            onTitleIndexChange={setTitleIndex}
            titleWidth={titleWidth}
            onTitleWidthChange={setTitleWidth}
            privateNotesWidth={privateNotesWidth}
            onPrivateNotesWidthChange={setPrivateNotesWidth}
            onExpandAllScripts={() => handleSetAllScriptsCollapsed(false)}
            onCollapseAllScripts={() => handleSetAllScriptsCollapsed(true)}
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
              onDragMove={(event: DragMoveEvent) => {
                const { active, over } = event
                if (!over || !active.rect.current.translated) return
                const overRect = over.rect
                const activeMidY = active.rect.current.translated.top + active.rect.current.translated.height / 2
                const overMidY = overRect.top + overRect.height / 2
                dragHalfRef.current = activeMidY < overMidY ? 'top' : 'bottom'
              }}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext items={renderableIds} strategy={verticalListSortingStrategy}>
                {layout.items.map((item) => {
                  if (item.type === 'group') {
                    const collapsed = collapsedGroups.has(item.heading.id)
                    const headingVisible = visibility.headingIds.has(item.heading.id)
                    const visibleChildren = filtersActive
                      ? item.children.filter((ch) => visibility.cueIds.has(ch.id))
                      : item.children
                    if (!headingVisible && visibleChildren.length === 0) return null
                    return (
                      <Fragment key={getRenderKey(item.heading.id)}>
                        {headingVisible && (
                          <GroupHeaderRow
                            heading={item.heading}
                            number={formatCueNumber(item.number, rundownSettings.cue_number_prefix, rundownSettings.cue_number_start, rundownSettings.cue_number_digits)}
                            rundownId={rundown.id}
                            aggregate={groupAggregate(visibleChildren)}
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
                            onAddAbove={(id) => handleAddCueAtHeading(id, 'above')}
                            onAddBelow={(id) => handleAddCueAtHeading(id, 'below')}
                            focused={gridNav.focusedCell?.cueId === item.heading.id}
                            onCellFocus={gridNav.focusCell}
                            ruleResult={ruleResults.get(item.heading.id)}
                          />
                        )}
                        {(!headingVisible || !collapsed) &&
                          visibleChildren.map((ch) => {
                            const timed = timedMap[ch.id]
                            return timed
                              ? renderCueRow(timed, layout.numberOf[ch.id] ?? '', 1, item.heading.background_color, item.heading.title, item.number)
                              : null
                          })}
                      </Fragment>
                    )
                  }
                  if (!visibility.cueIds.has(item.cue.id)) return null
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddCue}
                    data-testid="add-cue-btn"
                    className="inline-flex items-center gap-2 h-[34px] px-4 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#c8c9d0] border border-dashed border-[#2e2e38] hover:border-[#3a3a48] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add cue
                  </button>
                  <button
                    onClick={handleAddHeading}
                    data-testid="add-heading-btn"
                    className="inline-flex items-center gap-2 h-[34px] px-4 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#c8c9d0] border border-dashed border-[#2e2e38] hover:border-[#3a3a48] transition-colors"
                  >
                    <HeadingIcon className="w-3.5 h-3.5" />
                    Add heading
                  </button>
                </div>
              )}
            </div>

            {/* Live spacer — lets even the last cue pin to the top */}
            {effectiveLive.isLive && <div style={{ height: '72vh' }} aria-hidden />}
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
                effectiveLive.isLive ? 'text-[#5a5c66] line-through' : 'text-[#c8c9d0]'
              )}
            >
              {formatMsToTimeDisplay(plannedEndMs, rundownSettings.time_display)}
            </span>
          </div>
          {isShowLeader && live.isLive && (
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
            {filtersActive
              ? <>{visibleCueCount} of {realCueCount} {realCueCount === 1 ? 'cue' : 'cues'} · {formatDuration(visibleDurationMs)}</>
              : <>{realCueCount} {realCueCount === 1 ? 'cue' : 'cues'} · {formatDuration(totalDurationMs)} total</>}
          </div>
        </div>

        {/* Jump back to the live cue when it's scrolled out of view */}
        {effectiveLive.isLive && showJumpToCurrent && (
          <button
            onClick={scrollActiveCueToTop}
            className="fixed bottom-[54px] left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 h-9 px-4 font-cond text-[11px] font-bold uppercase tracking-[0.12em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] shadow-[0_12px_34px_rgba(0,0,0,0.65)] transition-colors"
          >
            <ArrowUpToLine className="w-3.5 h-3.5" /> Jump to current cue
          </button>
        )}

        <RundownSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialTab={settingsTab}
        />

        {!collab && (
          <RulesPanel
            open={rulesOpen}
            onClose={() => setRulesOpen(false)}
            rules={rules}
            onChange={handleRulesChange}
            columns={columns}
            groups={groups}
          />
        )}

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

        <FinalizeWarningDialog
          open={finalizeWarningOpen}
          onOpenChange={setFinalizeWarningOpen}
          notFinalCues={notFinalCues}
          onScrollToCue={handleScrollToNotFinalCue}
          onConfirm={() => commitStatusChange('finalized')}
        />

        <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </div>
    </RundownDataProvider>
  )
}

/** Read-only progress bar for anyone following the show without driving it —
 *  mirrors TransportBar's embedded bar, but with no controls. */
function FollowProgressBar({ elapsedMs, durationMs }: { elapsedMs: number; durationMs: number }) {
  const pct = durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0
  const over = durationMs > 0 && elapsedMs > durationMs
  return (
    <div className="shrink-0 h-[3px] bg-[rgba(255,255,255,0.08)]">
      <div className="h-full transition-[width]" style={{ width: `${pct}%`, background: over ? '#ff2848' : '#f0a838' }} />
    </div>
  )
}
