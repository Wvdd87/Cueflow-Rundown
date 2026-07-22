'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { buildCueLayout, formatCueNumber } from '@/components/rundown/cueTree'
import { useLiveSubscription, useLeaderState, useBroadcastLive, type LiveSyncState } from '@/components/rundown/liveSync'
import { useLiveShow } from '@/components/rundown/useLiveShow'
import { TransportBar } from '@/components/rundown/TransportBar'
import {
  calculateTimings,
  formatMsToTimeDisplay,
  formatDuration,
  type CueTimingOutput,
} from '@/lib/timing'
import { resolveVariablesHtml, resolveMentionsHtml, parseDropdownValues } from '@/lib/cellHtml'
import { parseDropdownCellValues, serializeDropdownCellValues } from '@/lib/dropdownValues'
import { CF, textOn } from '@/components/rundown/layout'
import { RichNoteCell } from '@/components/rundown/RichNoteCell'
import { StatusBadge } from '@/components/StatusBadge'
import { cn, inlineHtml, stripHtml } from '@/lib/utils'
import { collabUpsertCell, collabAddCue, collabDeleteCue, collabUpdateTitle, collabTakeControl } from '@/app/actions/collab'
import { CollabMentionsVariablesDialog } from './CollabMentionsVariablesDialog'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Lock, ArrowUpToLine, Plus, Trash2, ChevronDown, X, AtSign, FileDown, FileSpreadsheet, Play } from 'lucide-react'
import type { Rundown, Column, Cue, Cell, Variable, Mention } from '@/lib/supabase/types'

export interface CollabPermissions {
  label: string
  editableColumns: string[]
  canAddDeleteCues: boolean
  canAddDeleteColumns: boolean
  canRunShow: boolean
}

export interface CollabData {
  rundown: Rundown
  collab: CollabPermissions
  columns: Column[]
  cues: Cue[]
  cells: Cell[]
  variables: Variable[]
  mentions?: Mention[]
}

const LABEL = 'font-cond text-[9px] font-bold uppercase tracking-[0.18em]'
const TITLE_WIDTH = 260

function fmtNum(raw: string, rundown: Rundown): string {
  return formatCueNumber(raw, rundown.cue_number_prefix ?? '', rundown.cue_number_start ?? 1, rundown.cue_number_digits ?? 1)
}

function tile(width: number, bg: string, extra?: React.CSSProperties): React.CSSProperties {
  return { width, minHeight: CF.minRowH, flexShrink: 0, background: bg, display: 'flex', alignItems: 'flex-start', padding: '12px 14px', ...extra }
}

export function CollabRundownView({ data, token }: { data: CollabData; token: string }) {
  const { rundown, collab, columns = [], cues: initialCues = [], cells: initialCells = [] } = data
  const live = useLiveSubscription(rundown.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLDivElement>(null)

  const [cues, setCues] = useState<Cue[]>(initialCues)
  const [cellMap, setCellMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialCells.map((c) => [`${c.cue_id}:${c.column_id}`, c.content ?? '']))
  )
  const [variables, setVariables] = useState<Variable[]>(data.variables ?? [])
  const [mentions, setMentions] = useState<Mention[]>(data.mentions ?? [])
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  // ── Show control ── a collaborator with canRunShow can drive the live show,
  // but only one leader (owner or a collab link) broadcasts at a time.
  const leader = useLeaderState(rundown.id)
  const isLeader = collab.canRunShow && leader.leaderToken === token
  const liveCues = useMemo(() => cues.filter((c) => c.cue_type !== 'heading'), [cues])
  const myShow = useLiveShow(liveCues)
  const [takingControl, setTakingControl] = useState(false)
  useBroadcastLive(rundown.id, {
    activeCueId: myShow.activeCueId,
    nextCueId: myShow.nextCueId,
    status: myShow.status,
    elapsedMs: myShow.elapsedMs,
    durationMs: myShow.activeDurationMs,
    isLive: myShow.isLive,
  }, isLeader)

  // Display always reflects the current leader's state: this collaborator's
  // own (zero-latency) state while they're driving, otherwise the broadcast.
  const effectiveLive: LiveSyncState = isLeader
    ? {
        activeCueId: myShow.activeCueId,
        nextCueId: myShow.nextCueId,
        status: myShow.status,
        elapsedMs: myShow.elapsedMs,
        durationMs: myShow.activeDurationMs,
        sentAt: Date.now(),
      }
    : live

  async function handleRunShow() {
    setTakingControl(true)
    try {
      const r = await collabTakeControl(token)
      if (r.error) return toast.error(r.error)
      leader.refresh()
      myShow.start()
    } finally {
      setTakingControl(false)
    }
  }

  const isLive = effectiveLive.status === 'running' || effectiveLive.status === 'paused'
  const [following, setFollowing] = useState(true)
  const programmaticScrollRef = useRef(false)

  const editableSet = useMemo(() => new Set(collab.editableColumns), [collab.editableColumns])
  const varMap = useMemo(() => Object.fromEntries(variables.map((v) => [v.key, v.value])), [variables])
  const mentionMap = useMemo(() => Object.fromEntries(mentions.map((m) => [m.id, m])), [mentions])
  const layout = useMemo(() => buildCueLayout(cues), [cues])
  const timedMap = useMemo(() => {
    const timed = calculateTimings(layout.docOrder)
    return Object.fromEntries(timed.map((t) => [t.id, t])) as Record<string, CueTimingOutput>
  }, [layout])
  const timedLiveCues = useMemo(
    () => liveCues.map((c) => timedMap[c.id]).filter((c): c is CueTimingOutput => !!c),
    [liveCues, timedMap]
  )

  const rowWidth = useMemo(() => {
    const colW = columns.reduce((s, c) => s + c.width, 0)
    return CF.rowPad * 2 + CF.c1 + CF.num + CF.start + CF.dur + TITLE_WIDTH + colW + (3 + columns.length) * CF.gap
  }, [columns])

  const scrollRowToTop = useCallback((el: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
    const cont = scrollRef.current
    if (!cont) return
    const cr = cont.getBoundingClientRect()
    const rr = el.getBoundingClientRect()
    programmaticScrollRef.current = true
    cont.scrollTo({ top: cont.scrollTop + (rr.top - cr.top) - (CF.headerH + 8), behavior })
    setTimeout(() => { programmaticScrollRef.current = false }, 700)
  }, [])

  const resumeFollowing = useCallback(() => {
    setFollowing(true)
    if (activeRowRef.current) scrollRowToTop(activeRowRef.current)
  }, [scrollRowToTop])

  useEffect(() => {
    if (!following || !effectiveLive.activeCueId) return
    if (activeRowRef.current) scrollRowToTop(activeRowRef.current)
  }, [effectiveLive.activeCueId, following, scrollRowToTop])

  useEffect(() => {
    if (effectiveLive.status === 'idle') setFollowing(true)
  }, [effectiveLive.status])

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

  const handleCellSave = useCallback(
    async (cueId: string, columnId: string, content: string) => {
      setCellMap((prev) => ({ ...prev, [`${cueId}:${columnId}`]: content }))
      const r = await collabUpsertCell(token, cueId, columnId, content)
      if (r.error) toast.error('Could not save — this column may no longer be editable')
    },
    [token]
  )

  const handleTitleSave = useCallback(
    async (cueId: string, title: string) => {
      setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, title } : c)))
      const r = await collabUpdateTitle(token, cueId, title)
      if (r.error) toast.error('Could not save the title')
    },
    [token]
  )

  const handleAddCue = useCallback(async () => {
    setAdding(true)
    try {
      const r = await collabAddCue(token)
      if (r.error || !r.cue) { toast.error(r.error ?? 'Could not add cue'); return }
      setCues((prev) => [...prev, r.cue!])
    } finally {
      setAdding(false)
    }
  }, [token])

  const handleDeleteCue = useCallback(async (cueId: string) => {
    setCues((prev) => prev.filter((c) => c.id !== cueId))
    const r = await collabDeleteCue(token, cueId)
    if (r.error) toast.error(r.error)
  }, [token])

  const showDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : null

  function renderCells(cueId: string, baseBg: string) {
    return columns.map((col) => {
      const raw = cellMap[`${cueId}:${col.id}`] ?? ''
      const editable = editableSet.has(col.id)
      return (
        <div
          key={col.id}
          data-col-id={col.id}
          style={tile(col.width, baseBg, { padding: editable ? '10px 4px' : '10px 8px' })}
        >
          {editable ? (
            col.col_type === 'dropdown' ? (
              <CollabDropdownCell
                value={raw}
                options={col.options ?? []}
                optionColors={col.option_colors}
                onSave={(next) => handleCellSave(cueId, col.id, next)}
              />
            ) : (
              <RichNoteCell
                value={raw}
                onSave={(html) => handleCellSave(cueId, col.id, html)}
                textColor="#c8c9d0"
                placeholder="—"
              />
            )
          ) : col.col_type === 'dropdown' ? (
            <LockedDropdownDisplay values={parseDropdownValues(raw)} optionColors={col.option_colors} />
          ) : (
            <LockedRichText html={raw} varMap={varMap} mentionMap={mentionMap} />
          )}
        </div>
      )
    })
  }

  return (
    <div className="h-screen flex flex-col bg-[#09090d] text-[#c8c9d0] font-sans">
      <header className="shrink-0 flex items-center gap-3 px-6 h-14 border-b border-[#1d1d24] bg-[#07070a]">
        <Image src="/icon-512.png" alt="Cueflow" width={30} height={30} className="shrink-0" />
        <h1 className="font-semibold text-[15px] text-[#eef0f3] truncate">{rundown.name}</h1>
        <StatusBadge status={rundown.status} />
        {effectiveLive.status === 'running' && (
          <span className="flex items-center gap-1 font-cond text-[10px] font-medium uppercase tracking-[0.1em] text-[#9ba0ab]" title="Show is live">
            <span className="w-[5px] h-[5px] rounded-full bg-[#ff2848]" /> Live
          </span>
        )}
        {isLive && !isLeader && (
          <span className="font-cond text-[10px] font-bold uppercase tracking-[0.1em] text-[#7c7e8a]">
            {leader.leaderLabel} is running the show
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {collab.canRunShow && !isLive && (
            <button
              data-testid="collab-run-show"
              onClick={handleRunShow}
              disabled={takingControl}
              className="inline-flex items-center gap-2 h-8 px-3.5 font-cond text-[10.5px] font-bold uppercase tracking-[0.12em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] transition-colors disabled:opacity-60"
            >
              <Play className="w-3 h-3 fill-[#06060a]" /> {takingControl ? 'Starting…' : 'Run show'}
            </button>
          )}
          <button
            data-testid="collab-mentions-btn"
            onClick={() => setMentionsOpen(true)}
            title="Mentions & variables"
            className="w-8 h-8 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors"
          >
            <AtSign className="w-4 h-4" />
          </button>
          <a
            href={`/share/collab/${token}/export/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            title="Export PDF"
            className="w-8 h-8 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors"
          >
            <FileDown className="w-4 h-4" />
          </a>
          <a
            href={`/share/collab/${token}/export/csv`}
            title="Export CSV"
            className="w-8 h-8 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </a>
          {showDate && <span className="font-mono text-xs text-[#888b96]">{showDate}</span>}
          <span
            data-testid="collab-label-badge"
            className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0a838] border border-[#f0a838]/40 bg-[rgba(240,168,56,0.08)] px-2 py-0.5"
          >
            {collab.label}
          </span>
        </div>
      </header>

      {isLeader && myShow.isLive && <TransportBar live={myShow} cues={timedLiveCues} />}
      {isLive && !isLeader && <CollabLiveProgress live={effectiveLive} />}

      <CollabMentionsVariablesDialog
        token={token}
        open={mentionsOpen}
        onOpenChange={setMentionsOpen}
        mentions={mentions}
        variables={variables}
        setMentions={setMentions}
        setVariables={setVariables}
      />

      <div ref={scrollRef} data-cue-scroll className="flex-1 overflow-auto">
        <div className="inline-block min-w-full align-top">
          <div
            className="sticky top-0 z-20 flex items-stretch bg-[#0b0b10] border-b border-[#22222a] select-none"
            style={{ height: CF.headerH, gap: CF.gap, padding: `0 ${CF.rowPad}px` }}
          >
            <div className="shrink-0" style={{ width: CF.c1 }} />
            <HeaderCell width={CF.num} className="justify-center">#</HeaderCell>
            <HeaderCell width={CF.start}>Start</HeaderCell>
            <HeaderCell width={CF.dur}>Dur.</HeaderCell>
            <HeaderCell width={TITLE_WIDTH}>Title</HeaderCell>
            {columns.map((col) => (
              <HeaderCell key={col.id} width={col.width}>
                <span className="flex items-center gap-1 truncate">
                  {!editableSet.has(col.id) && <Lock className="w-2.5 h-2.5 shrink-0 text-[#5a5c66]" />}
                  {col.name}
                </span>
              </HeaderCell>
            ))}
          </div>

          <div className="py-3">
            {layout.items.map((item) => {
              if (item.type === 'group') {
                const isCollapsed = false
                return (
                  <div key={item.heading.id}>
                    <CollabGroupHeader
                      heading={item.heading}
                      number={fmtNum(item.number, rundown)}
                      isStandalone={item.children.length === 0}
                      rowWidth={rowWidth}
                    />
                    {!isCollapsed && item.children.map((ch) => (
                      <CollabCueRow
                        key={ch.id}
                        cue={timedMap[ch.id] ?? (ch as CueTimingOutput)}
                        displayNumber={fmtNum(layout.numberOf[ch.id] ?? '', rundown)}
                        depth={1}
                        live={effectiveLive}
                        activeRef={effectiveLive.activeCueId === ch.id ? activeRowRef : undefined}
                        timeFormat={rundown.time_display ?? 'auto'}
                        renderCells={renderCells}
                        canDelete={collab.canAddDeleteCues}
                        onDelete={() => handleDeleteCue(ch.id)}
                        onTitleSave={(title) => handleTitleSave(ch.id, title)}
                      />
                    ))}
                  </div>
                )
              }
              const cue = timedMap[item.cue.id] ?? (item.cue as CueTimingOutput)
              return (
                <CollabCueRow
                  key={item.cue.id}
                  cue={cue}
                  displayNumber={fmtNum(item.number, rundown)}
                  depth={0}
                  live={effectiveLive}
                  activeRef={effectiveLive.activeCueId === item.cue.id ? activeRowRef : undefined}
                  timeFormat={rundown.time_display ?? 'auto'}
                  renderCells={renderCells}
                  canDelete={collab.canAddDeleteCues}
                  onDelete={() => handleDeleteCue(item.cue.id)}
                  onTitleSave={(title) => handleTitleSave(item.cue.id, title)}
                />
              )
            })}

            {cues.length === 0 && (
              <p className="text-sm text-[#5a5c66] py-12 text-center">This rundown has no cues yet.</p>
            )}

            {collab.canAddDeleteCues && (
              <div className="pt-2.5 pl-10">
                <button
                  data-testid="collab-add-cue"
                  onClick={handleAddCue}
                  disabled={adding}
                  className="inline-flex items-center gap-2 h-[34px] px-4 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#c8c9d0] border border-dashed border-[#2e2e38] hover:border-[#3a3a48] transition-colors disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" /> {adding ? 'Adding…' : 'Add cue'}
                </button>
              </div>
            )}

            {isLive && <div style={{ height: '72vh' }} aria-hidden />}
          </div>
        </div>
      </div>

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

function HeaderCell({ width, className, children }: { width: number; className?: string; children: React.ReactNode }) {
  return (
    <div style={{ width }} className={cn('shrink-0 flex items-center', LABEL, 'text-[#7c7e8a]', className)}>
      {children}
    </div>
  )
}

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

interface CollabCueRowProps {
  cue: CueTimingOutput
  displayNumber: string
  depth: number
  live: LiveSyncState
  activeRef?: React.RefObject<HTMLDivElement | null>
  timeFormat: 'auto' | '24h' | '12h' | '12h_no_ampm'
  renderCells: (cueId: string, baseBg: string) => React.ReactNode
  canDelete: boolean
  onDelete: () => void
  onTitleSave: (title: string) => void
}

function CollabCueRow({ cue, displayNumber, depth, live, activeRef, timeFormat, renderCells, canDelete, onDelete, onTitleSave }: CollabCueRowProps) {
  const isActive = live.activeCueId === cue.id
  const isNext = live.nextCueId === cue.id
  const isLive = live.status === 'running' || live.status === 'paused'
  const elapsed = useLiveElapsed(live, isActive)
  const remaining = elapsed == null ? null : (live.durationMs || cue.duration_ms) - elapsed
  const isOvertime = remaining != null && remaining < 0

  const ct = textOn(cue.background_color)
  const baseBg = cue.background_color || '#16161c'
  const isHard = cue.start_type === 'hard'
  const labelIndent = CF.rowPad + CF.c1 + CF.gap

  const numColor = isActive ? '#fff' : isNext ? '#eef0f3' : (cue.background_color ? ct.num : '#9ba0ab')
  const remColor = remaining == null ? '#eef0f3' : remaining < 0 ? '#ff2848' : remaining <= 30000 ? '#f0a838' : '#18d986'

  return (
    <div ref={activeRef} data-cue-id={cue.id} className="group/row" style={{ marginBottom: CF.gap }}>
      {isLive && (isActive || isNext) && (
        <div className={cn('flex items-center gap-2 pt-0.5 pb-1', LABEL)} style={{ paddingLeft: labelIndent, color: isActive ? '#ff5a73' : '#7c7e8a' }}>
          {isActive ? 'Current cue' : 'Next cue'}
          <div className="h-px flex-1" style={{ background: isActive ? 'rgba(255,40,72,0.5)' : '#22222a' }} />
        </div>
      )}

      <div className="relative flex" style={{ gap: CF.gap, padding: `0 ${CF.rowPad}px` }}>
        <div className="shrink-0 flex items-center justify-center" style={{ width: CF.c1, boxShadow: depth > 0 ? 'inset 2px 0 0 #3a3a48' : 'none' }}>
          {canDelete && (
            <button
              data-testid="collab-delete-cue"
              onClick={onDelete}
              title="Delete cue"
              className="opacity-0 group-hover/row:opacity-100 text-[#5a5c66] hover:text-[#ff5a73] transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div style={tile(CF.num, isActive ? '#ff2848' : isNext ? 'transparent' : baseBg, { justifyContent: 'center', border: isNext ? '1.5px solid #6b6b76' : 'none' })}>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: numColor }}>{displayNumber}</span>
        </div>

        <div style={tile(CF.start, baseBg, { flexDirection: 'column', gap: 2 })}>
          <span className="inline-flex items-center gap-1 font-mono text-[13px] tabular-nums" style={{ fontWeight: isHard ? 600 : 400, color: isActive ? ct.hi : isHard ? '#eef0f3' : ct.mid }}>
            {formatMsToTimeDisplay(cue.calculated_start_ms, timeFormat)}
          </span>
        </div>

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

        <div className="shrink-0 flex flex-col justify-center" style={{ width: TITLE_WIDTH, minHeight: CF.minRowH, background: baseBg, padding: '4px 4px' }}>
          <RichNoteCell
            value={cue.title}
            onSave={onTitleSave}
            accent="#f0a838"
            textColor={ct.hi}
            placeholder="Untitled cue"
          />
        </div>

        {renderCells(cue.id, baseBg)}
      </div>
    </div>
  )
}

function CollabLiveProgress({ live }: { live: LiveSyncState }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = ref.current
    if (!bar) return
    const paint = (el: number) => {
      const d = live.durationMs
      bar.style.width = d > 0 ? `${Math.min(100, (el / d) * 100)}%` : '0%'
      bar.style.background = d > 0 && el > d ? '#ff2848' : '#f0a838'
    }
    if (live.status === 'running') {
      let rafId = 0
      const loop = () => { paint(live.elapsedMs + (Date.now() - live.sentAt)); rafId = requestAnimationFrame(loop) }
      rafId = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafId)
    }
    paint(live.elapsedMs)
  }, [live.status, live.elapsedMs, live.sentAt, live.durationMs])

  return (
    <div className="shrink-0 h-[3px] bg-[rgba(255,255,255,0.08)]">
      <div ref={ref} className="h-full" style={{ width: '0%', background: '#f0a838' }} />
    </div>
  )
}

function CollabGroupHeader({ heading, number, isStandalone, rowWidth }: { heading: Cue; number: string; isStandalone: boolean; rowWidth: number }) {
  const ct = textOn(heading.background_color)
  const isGroup = !isStandalone
  const bandBg = heading.background_color ? heading.background_color : isGroup ? '#1a1a20' : '#15151b'
  const bandBorder = heading.background_color ? 'transparent' : '#26262e'

  return (
    <div className="flex items-stretch" data-cue-id={heading.id} style={{ width: rowWidth, minHeight: CF.minRowH, marginTop: isGroup ? 18 : 30, marginBottom: CF.gap, gap: CF.gap, padding: `0 ${CF.rowPad}px` }}>
      <div className="shrink-0" style={{ width: CF.c1 }} />
      <div className="flex-1 min-w-0 flex items-center" style={{ background: bandBg, border: `1px solid ${bandBorder}`, paddingRight: 14 }}>
        <div className="shrink-0 flex items-center justify-center" style={{ width: CF.num }}>
          <span className="font-mono text-sm font-bold" style={{ color: heading.background_color ? ct.mid : (isGroup ? '#9ba0ab' : '#7c7e8a') }}>{number}</span>
        </div>
        <div className="flex-1 min-w-0 pl-1">
          {stripHtml(heading.title) ? (
            <span
              className="tiptap-cell block text-left break-words [overflow-wrap:anywhere]"
              style={{ fontSize: isGroup ? 14 : 16, fontWeight: isGroup ? 600 : 700, color: heading.background_color ? ct.hi : '#eef0f3' }}
              dangerouslySetInnerHTML={{ __html: inlineHtml(heading.title) }}
            />
          ) : (
            <span className="block text-left italic" style={{ fontSize: isGroup ? 14 : 16, fontWeight: isGroup ? 600 : 700, color: '#5a5c66' }}>
              {isGroup ? 'Group' : 'Untitled heading'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Locked (read-only) cell displays for non-editable columns ─────────────────

function LockedDropdownDisplay({ values, optionColors }: { values: string[]; optionColors: Record<string, string> | null }) {
  if (values.length === 0) return null
  return (
    <div className="w-full flex flex-col gap-1.5 opacity-80">
      {values.map((v) => (
        <span key={v} className="text-[12.5px] px-2.5 py-[5px] text-white font-semibold break-words [overflow-wrap:anywhere]" style={{ backgroundColor: optionColors?.[v] ?? 'rgba(63,63,70,0.85)' }}>
          {v}
        </span>
      ))}
    </div>
  )
}

function LockedRichText({ html, varMap, mentionMap }: { html: string; varMap: Record<string, string>; mentionMap: Record<string, Mention> }) {
  const resolved = useMemo(() => {
    const nameById = Object.fromEntries(Object.entries(mentionMap).map(([id, m]) => [id, m.name]))
    return resolveMentionsHtml(resolveVariablesHtml(html, varMap), nameById)
  }, [html, varMap, mentionMap])
  if (!html || html === '<p></p>') return null
  return (
    <div
      className="tiptap-cell text-[13px] text-[#c8c9d0] break-words [overflow-wrap:anywhere] w-full opacity-80"
      dangerouslySetInnerHTML={{ __html: resolved }}
    />
  )
}

// ── Editable dropdown cell for collaborators (no attachments — phase 1) ───────

function CollabDropdownCell({
  value,
  options,
  optionColors,
  onSave,
}: {
  value: string
  options: string[]
  optionColors: Record<string, string> | null
  onSave: (next: string) => void
}) {
  const values = parseDropdownCellValues(value)
  const remaining = options.filter((o) => !values.includes(o))

  function addValue(v: string) {
    onSave(serializeDropdownCellValues([...values, v]))
  }
  function removeValue(v: string) {
    onSave(serializeDropdownCellValues(values.filter((x) => x !== v)))
  }
  function replaceValue(oldV: string, newV: string) {
    onSave(serializeDropdownCellValues(values.map((x) => (x === oldV ? newV : x))))
  }

  function optionList(list: string[], onSelect: (v: string) => void) {
    return (
      <DropdownMenuContent align="start" className="bg-[#111116] border-[#3a3a48] text-[#c8c9d0] min-w-[170px] max-h-60 overflow-y-auto p-0">
        {list.length === 0 ? (
          <div className="px-3 py-2.5 text-[12px] text-[#5a5c66] italic">No options</div>
        ) : (
          list.map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onSelect(opt)} className="grid grid-cols-[auto_1fr] gap-2.5 items-center px-3 py-2.5 text-[12.5px] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#3a3a48]" style={{ backgroundColor: optionColors?.[opt] ?? 'transparent' }} />
              <span className="truncate">{opt}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    )
  }

  return (
    <div className="w-full flex flex-col gap-1.5 py-0.5 group/ddc">
      {values.length === 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="w-full flex items-center justify-between gap-1 px-1.5 py-1 hover:bg-[#1d1d24]/50 transition-colors" />}>
            <span className="text-[13px] text-[#5a5c66] italic">—</span>
            <ChevronDown className="w-3 h-3 text-[#5a5c66] shrink-0" />
          </DropdownMenuTrigger>
          {optionList(options, addValue)}
        </DropdownMenu>
      ) : (
        <>
          {values.map((v) => (
            <div key={v} className="flex items-center gap-1 w-full group/badge">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      className="flex-1 min-w-0 text-left text-[12.5px] px-2.5 py-[5px] text-white font-semibold break-words [overflow-wrap:anywhere] hover:brightness-110 transition-[filter] cursor-pointer"
                      style={{ backgroundColor: optionColors?.[v] ?? 'rgba(63,63,70,0.85)' }}
                    />
                  }
                >
                  {v}
                </DropdownMenuTrigger>
                {optionList(remaining, (newV) => replaceValue(v, newV))}
              </DropdownMenu>
              <button onClick={() => removeValue(v)} title={`Remove ${v}`} className="opacity-0 group-hover/badge:opacity-100 shrink-0 text-[#5a5c66] hover:text-[#c8c9d0] transition-opacity">
                <X className="w-[11px] h-[11px]" />
              </button>
            </div>
          ))}
          {remaining.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<button className="self-start inline-flex items-center gap-1.5 mt-px font-cond text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c7e8a] hover:text-[#c8c9d0] transition-colors" />}>
                <Plus className="w-2.5 h-2.5" /> Add
              </DropdownMenuTrigger>
              {optionList(remaining, addValue)}
            </DropdownMenu>
          )}
        </>
      )}
    </div>
  )
}
