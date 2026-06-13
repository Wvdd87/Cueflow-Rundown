'use client'

import { useState, useRef, useEffect } from 'react'
import {
  GripVertical,
  Settings,
  Check,
  Trash2,
  Clock,
  AlarmClock,
  Palette,
  Pin,
  ChevronDown,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateCue, deleteCue } from '@/app/actions/cues'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RichTextCell } from './RichTextCell'
import { DropdownCell } from './DropdownCell'
import { PrivateNoteCell } from './PrivateNoteCell'
import { PRIVATE_NOTES_WIDTH, TITLE_COL_WIDTH, PRIVATE_NOTES_ID } from './layout'
import { formatDuration, parseDurationInput, formatMsToTime, parseTimeToMs } from '@/lib/timing'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Cue, Column } from '@/lib/supabase/types'
import type { CueTimingOutput } from '@/lib/timing'

const CUE_COLORS = [
  null,
  '#1e293b', '#7f1d1d', '#78350f', '#14532d',
  '#1e3a5f', '#4a1d96', '#831843', '#064e3b',
]

type SelectMods = { shift: boolean; meta: boolean }

interface CueRowProps {
  cue: CueTimingOutput
  displayNumber: string
  depth: number
  columns: Column[]
  cells: Record<string, string>
  rundownId: string
  selected: boolean
  onSelect: (id: string, mods: SelectMods) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Cue>) => void
  onCellChange: (cueId: string, columnId: string, content: string) => void
  live: boolean
  isActive: boolean
  isNext: boolean
  liveRemainingMs: number | null
  liveElapsedMs: number | null
  onJump: (cueId: string) => void
  privateNote: string
  onPrivateNoteChange: (cueId: string, content: string) => void
  isFirst: boolean
  nextAutoStart: boolean | null
  onToggleNextAutoStart: () => void
  privateNotesIndex: number
}

export function CueRow({
  cue,
  displayNumber,
  depth,
  columns,
  cells,
  rundownId,
  selected,
  onSelect,
  onDelete,
  onUpdate,
  onCellChange,
  live,
  isActive,
  isNext,
  liveRemainingMs,
  liveElapsedMs,
  onJump,
  privateNote,
  onPrivateNoteChange,
  isFirst,
  nextAutoStart,
  onToggleNextAutoStart,
  privateNotesIndex,
}: CueRowProps) {
  const [editingDuration, setEditingDuration] = useState(false)
  const [durationInput, setDurationInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(cue.title)
  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [subtitleInput, setSubtitleInput] = useState(cue.subtitle ?? '')
  const [editingStart, setEditingStart] = useState(false)
  const [startInput, setStartInput] = useState('')
  const durationRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cue.id })
  const rowRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // During live mode, pin the active cue to the top (list scrolls up under it)
  useEffect(() => {
    if (isActive) {
      rowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [isActive])

  useEffect(() => {
    setTitleInput(cue.title)
  }, [cue.title])

  useEffect(() => {
    setSubtitleInput(cue.subtitle ?? '')
  }, [cue.subtitle])

  // --- Duration editing ---
  function startDurationEdit() {
    setDurationInput(formatDuration(cue.duration_ms))
    setEditingDuration(true)
    setTimeout(() => durationRef.current?.select(), 0)
  }

  async function saveDuration() {
    setEditingDuration(false)
    const ms = parseDurationInput(durationInput)
    if (ms === null || ms === cue.duration_ms) return
    onUpdate(cue.id, { duration_ms: ms })
    await updateCue(cue.id, rundownId, { duration_ms: ms })
  }

  // --- Title editing ---
  async function saveTitle() {
    setEditingTitle(false)
    const t = titleInput.trim()
    if (t === cue.title) return
    onUpdate(cue.id, { title: t })
    await updateCue(cue.id, rundownId, { title: t })
  }

  // --- Subtitle editing ---
  async function saveSubtitle() {
    setEditingSubtitle(false)
    const s = subtitleInput.trim()
    if (s === (cue.subtitle ?? '')) return
    onUpdate(cue.id, { subtitle: s || null })
    await updateCue(cue.id, rundownId, { subtitle: s || null })
  }

  // --- Delete ---
  async function handleDelete() {
    onDelete(cue.id)
    const result = await deleteCue(cue.id, rundownId)
    if (result.error) toast.error(result.error)
  }

  // --- Start type toggle ---
  async function toggleStartType() {
    const newType = cue.start_type === 'soft' ? 'hard' : 'soft'
    const override = newType === 'hard' ? formatMsToTime(cue.calculated_start_ms) : null
    onUpdate(cue.id, { start_type: newType, start_time_override: override })
    await updateCue(cue.id, rundownId, { start_type: newType, start_time_override: override })
  }

  // --- Color ---
  async function setColor(color: string | null) {
    onUpdate(cue.id, { background_color: color })
    await updateCue(cue.id, rundownId, { background_color: color })
  }

  // --- Hard-start time editing ---
  function startStartEdit() {
    setStartInput(formatMsToTime(cue.calculated_start_ms))
    setEditingStart(true)
  }
  async function saveStart() {
    setEditingStart(false)
    const ms = parseTimeToMs(startInput)
    const override = formatMsToTime(ms)
    if (override === cue.start_time_override) return
    onUpdate(cue.id, { start_type: 'hard', start_time_override: override })
    await updateCue(cue.id, rundownId, { start_type: 'hard', start_time_override: override })
  }

  const startTimeLabel = formatMsToTime(cue.calculated_start_ms)
  const isHard = cue.start_type === 'hard'
  const hasGap = isHard && cue.gap_ms > 0
  const hasOverlap = isHard && cue.gap_ms < 0
  // For a hard cue, the natural (cascade) start it would have if soft = current − gap
  const naturalStartLabel = formatMsToTime(cue.calculated_start_ms - cue.gap_ms)
  const showStruck = isHard && cue.gap_ms !== 0

  // Live overtime flag for the active cue
  const liveOvertime = liveRemainingMs != null && liveRemainingMs < 0

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        rowRef.current = node
      }}
      style={style}
    >
      {/* CURRENT / NEXT cue label (live mode) */}
      {live && (isActive || isNext) && (
        <div
          className={cn(
            'flex items-center gap-2 px-10 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider',
            isActive ? 'text-red-500' : 'text-zinc-500'
          )}
        >
          {isActive ? 'Current cue' : 'Next cue'}
          <div
            className={cn(
              'h-px flex-1',
              isActive ? 'bg-red-500/40' : 'bg-zinc-700'
            )}
          />
        </div>
      )}

      {/* Gap/overlap indicator */}
      {isHard && cue.gap_ms !== 0 && (
        <div
          className={cn(
            'flex items-center text-xs px-14 py-0.5',
            hasGap ? 'text-emerald-600' : 'text-red-500'
          )}
        >
          <div className={cn('h-px flex-1 mr-2', hasGap ? 'bg-emerald-900' : 'bg-red-900')} />
          <span>{hasGap ? `+${formatDuration(cue.gap_ms)} gap` : `${formatDuration(-cue.gap_ms)} overlap`}</span>
          <div className={cn('h-px flex-1 ml-2', hasGap ? 'bg-emerald-900' : 'bg-red-900')} />
        </div>
      )}

      <div
        className={cn(
          'group relative flex items-stretch min-h-[40px] border-b border-zinc-800/60 transition-colors',
          isActive
            ? liveOvertime
              ? 'bg-red-950/50'
              : 'bg-emerald-950/40'
            : selected
              ? 'bg-zinc-800/60'
              : 'hover:bg-zinc-900/40',
          depth > 0 && 'border-l-2 border-zinc-700/70 bg-zinc-900/20',
          isNext && 'next-cue-pulse',
          isDragging ? 'shadow-lg' : ''
        )}
        style={
          !isActive && cue.background_color
            ? { backgroundColor: cue.background_color + '33' }
            : undefined
        }
      >
        {/* Column 1: drag handle (hover) · cue settings gear · select checkbox (hover) */}
        <div className="w-10 shrink-0 relative flex items-center justify-center group/col1">
          {/* Drag handle — appears on hover, top */}
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            className="absolute top-0.5 left-1/2 -translate-x-1/2 text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing opacity-0 group-hover/col1:opacity-100 transition-opacity"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {/* Cue settings gear — opens the cue options menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  title="Cue options"
                  className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                />
              }
            >
              <Settings className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-44">
              <DropdownMenuItem
                onClick={toggleStartType}
                className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
              >
                {isHard
                  ? <><Clock className="w-3.5 h-3.5" /> Make soft start</>
                  : <><AlarmClock className="w-3.5 h-3.5" /> Make hard start</>
                }
              </DropdownMenuItem>

              {/* Color picker */}
              <div className="px-2 py-1.5">
                <p className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Background
                </p>
                <div className="flex gap-1 flex-wrap">
                  {CUE_COLORS.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setColor(color)}
                      className={cn(
                        'w-5 h-5 rounded border transition-all',
                        color === cue.background_color
                          ? 'border-white scale-110'
                          : 'border-zinc-700 hover:border-zinc-500'
                      )}
                      style={{ backgroundColor: color ?? 'transparent' }}
                    />
                  ))}
                </div>
              </div>

              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={handleDelete}
                className="gap-2 text-xs text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete cue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Batch-select checkbox — toggles this cue additively (Shift = range) */}
          <button
            onClick={(e) => onSelect(cue.id, { shift: e.shiftKey, meta: true })}
            title="Select cue"
            className={cn(
              'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-all',
              selected
                ? 'opacity-100 bg-emerald-600 border-emerald-600'
                : 'opacity-0 group-hover/col1:opacity-100 border-zinc-600 hover:border-zinc-400'
            )}
          >
            {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </button>
        </div>

        {/* Cue number (auto-generated; click to select · jump in live mode) */}
        <div className="w-12 shrink-0 flex items-center">
          <span
            onClick={(e) => {
              e.stopPropagation()
              if (live) onJump(cue.id)
              else onSelect(cue.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
            }}
            title={live ? 'Jump to this cue' : 'Click to select'}
            className={cn(
              'text-xs px-2 rounded cursor-pointer transition-colors tabular-nums',
              isActive
                ? 'text-white bg-emerald-600'
                : selected
                  ? 'text-white bg-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {displayNumber}
          </span>
        </div>

        {/* Start time — editable when hard or the first (anchor) cue, else derived/read-only */}
        <div
          className="w-[84px] shrink-0 relative flex flex-col justify-center px-2"
          title={
            isHard
              ? 'Hard start — click to edit time'
              : isFirst
                ? 'Show start (anchor) — click to edit'
                : 'Soft start — derived from the previous cue'
          }
        >
          {editingStart ? (
            <input
              autoFocus
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onBlur={saveStart}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveStart()
                if (e.key === 'Escape') setEditingStart(false)
              }}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-white font-mono outline-none focus:ring-1 focus:ring-zinc-500"
            />
          ) : isHard || isFirst ? (
            <>
              {showStruck && (
                <span className="text-[10px] font-mono tabular-nums text-zinc-600 line-through leading-none">
                  {naturalStartLabel}
                </span>
              )}
              <button
                onClick={startStartEdit}
                className={cn(
                  'flex items-center gap-1 text-xs font-mono tabular-nums transition-colors text-left',
                  isActive
                    ? 'text-red-400 font-semibold'
                    : isHard
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {isHard && <Pin className="w-2.5 h-2.5 shrink-0 -rotate-45 fill-current" />}
                {startTimeLabel}
              </button>
            </>
          ) : (
            <span
              className={cn(
                'text-xs font-mono tabular-nums',
                isActive ? 'text-red-400 font-semibold' : 'text-zinc-500'
              )}
            >
              {startTimeLabel}
            </span>
          )}

          {/* Auto-start link to the next cue (down arrow when enabled) */}
          {nextAutoStart !== null && (
            <button
              data-testid="autostart-toggle"
              data-on={nextAutoStart ? '1' : '0'}
              onClick={(e) => {
                e.stopPropagation()
                onToggleNextAutoStart()
              }}
              title={
                nextAutoStart
                  ? 'Disable auto-start of next cue'
                  : 'Enable auto-start of next cue'
              }
              className={cn(
                'absolute left-1/2 -translate-x-1/2 -bottom-2 z-20 flex items-center justify-center w-5 h-4 rounded transition-all',
                nextAutoStart
                  ? 'text-emerald-400'
                  : 'text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100'
              )}
            >
              <ChevronDown
                className="w-3.5 h-3.5"
                strokeWidth={nextAutoStart ? 2.75 : 2}
              />
            </button>
          )}
        </div>

        {/* Duration (shows elapsed count-up for the active cue in live mode) */}
        <div className="w-[76px] shrink-0 flex flex-col justify-center px-1">
          {editingDuration ? (
            <input
              ref={durationRef}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={saveDuration}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDuration()
                if (e.key === 'Escape') setEditingDuration(false)
              }}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-white font-mono outline-none focus:ring-1 focus:ring-zinc-500"
            />
          ) : isActive && liveElapsedMs != null ? (
            <>
              <span className="text-[10px] font-mono tabular-nums text-zinc-600 leading-none">
                {formatDuration(cue.duration_ms)}
              </span>
              <span
                className={cn(
                  'text-xs font-mono font-semibold tabular-nums',
                  liveOvertime ? 'text-red-400' : 'text-emerald-400'
                )}
              >
                {formatDuration(liveElapsedMs)}
              </span>
            </>
          ) : (
            <button
              onClick={startDurationEdit}
              className="text-xs font-mono tabular-nums text-zinc-400 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-zinc-800 w-full text-left"
            >
              {formatDuration(cue.duration_ms)}
            </button>
          )}
        </div>

        {/* Title + subtitle */}
        <div className="group/title shrink-0 flex flex-col justify-center px-3 py-1" style={{ width: TITLE_COL_WIDTH }}>
          {editingTitle ? (
            <input
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') { setEditingTitle(false); setTitleInput(cue.title) }
              }}
              className="w-full bg-transparent text-sm text-white outline-none border-b border-zinc-500"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm text-left w-full truncate transition-colors"
              style={{ color: cue.background_color ? '#fff' : undefined }}
            >
              {cue.title || <span className="text-zinc-700 italic">Untitled cue</span>}
            </button>
          )}

          {editingSubtitle ? (
            <input
              autoFocus
              value={subtitleInput}
              onChange={(e) => setSubtitleInput(e.target.value)}
              onBlur={saveSubtitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveSubtitle()
                if (e.key === 'Escape') { setEditingSubtitle(false); setSubtitleInput(cue.subtitle ?? '') }
              }}
              placeholder="Subtitle"
              className="w-full bg-transparent text-xs text-zinc-400 outline-none border-b border-zinc-600 mt-0.5"
            />
          ) : cue.subtitle ? (
            <button
              onClick={() => setEditingSubtitle(true)}
              className="text-xs text-left w-full truncate text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              {cue.subtitle}
            </button>
          ) : (
            <button
              onClick={() => setEditingSubtitle(true)}
              className="text-xs text-left w-full truncate text-zinc-700 hover:text-zinc-500 opacity-0 group-hover/title:opacity-100 transition-opacity italic"
            >
              Add a subtitle…
            </button>
          )}
        </div>

        {/* Dynamic cells + Private Notes, interleaved by privateNotesIndex */}
        {(() => {
          const insertAt = Math.min(Math.max(0, privateNotesIndex), columns.length)
          const mergedIds = columns.map((c) => c.id as string)
          mergedIds.splice(insertAt, 0, PRIVATE_NOTES_ID)
          return mergedIds.map((id) => {
            if (id === PRIVATE_NOTES_ID) {
              return (
                <div
                  key={PRIVATE_NOTES_ID}
                  style={{ width: PRIVATE_NOTES_WIDTH }}
                  className="shrink-0 border-l border-amber-900/30 bg-amber-950/10 flex items-center px-1"
                >
                  <PrivateNoteCell
                    cueId={cue.id}
                    rundownId={rundownId}
                    value={privateNote}
                    onChange={onPrivateNoteChange}
                  />
                </div>
              )
            }
            const col = columns.find((c) => c.id === id)
            if (!col) return null
            return (
              <div
                key={col.id}
                style={{ width: col.width }}
                className="shrink-0 border-l border-zinc-800/60 flex items-center px-1"
              >
                {col.col_type === 'dropdown' ? (
                  <DropdownCell
                    cueId={cue.id}
                    columnId={col.id}
                    rundownId={rundownId}
                    options={col.options ?? []}
                    optionColors={col.option_colors}
                    value={cells[`${cue.id}:${col.id}`] ?? ''}
                    onContentChange={onCellChange}
                  />
                ) : (
                  <RichTextCell
                    cueId={cue.id}
                    columnId={col.id}
                    rundownId={rundownId}
                    initialContent={cells[`${cue.id}:${col.id}`] ?? ''}
                    onContentChange={onCellChange}
                  />
                )}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
