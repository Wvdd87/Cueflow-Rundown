'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Settings,
  Check,
  Trash2,
  Clock,
  AlarmClock,
  Pin,
  ChevronDown,
  Heading as HeadingIcon,
  Copy,
  Plus,
  GripVertical,
  Ungroup,
  ScrollText,
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
import { RichTextCell } from './RichTextCell'
import { InlineTipTap } from './InlineTipTap'
import { DropdownCell } from './DropdownCell'
import { PrivateNoteCell } from './PrivateNoteCell'
import { ScriptDrawer } from './ScriptDrawer'
import {
  CF,
  CUE_COLORS,
  textOn,
  PRIVATE_NOTES_WIDTH,
  TITLE_COL_WIDTH,
  PRIVATE_NOTES_ID,
} from './layout'
import { formatDuration, parseDurationInput, formatMsToTime, formatMsToTimeDisplay, parseClockInput } from '@/lib/timing'
import { scriptsWordCount, autoDurationMs } from '@/lib/scripts'
import { cn, inlineHtml } from '@/lib/utils'
import type { Cue, Column, ScriptBlock } from '@/lib/supabase/types'
import type { CueTimingOutput, TimeDisplay } from '@/lib/timing'

type SelectMods = { shift: boolean; meta: boolean }

interface CueRowProps {
  cue: CueTimingOutput
  displayNumber: string
  depth: number
  rowWidth: number
  columns: Column[]
  cells: Record<string, string>
  rundownId: string
  selected: boolean
  onSelect: (id: string, mods: SelectMods) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Cue>) => void
  onConvertToHeading: (id: string) => void
  onAddAbove: (id: string) => void
  onAddBelow: (id: string) => void
  onDuplicate: (id: string) => void
  onRemoveFromGroup?: (id: string) => void
  onCellChange: (cueId: string, columnId: string, content: string) => void
  onAddScript: (id: string) => void
  onScriptsChange: (id: string, scripts: ScriptBlock[]) => void
  onDeleteScript: (id: string, scriptId: string) => void
  onToggleScriptCollapsed: (id: string, scriptId: string) => void
  onSetDurationMode: (id: string, mode: 'manual' | 'auto') => void
  focusScriptId?: string | null
  live: boolean
  isActive: boolean
  isNext: boolean
  liveRemainingMs: number | null
  liveElapsedMs: number | null
  liveGetElapsedMs?: () => number
  onJump: (cueId: string) => void
  privateNote: string
  onPrivateNoteChange: (cueId: string, content: string) => void
  isFirst: boolean
  nextAutoStart: boolean | null
  onToggleNextAutoStart: () => void
  privateNotesIndex: number
  privateNotesWidth?: number
  titleIndex?: number
  timeFormat?: TimeDisplay
  titleWidth?: number
  groupColor?: string | null
  groupTitle?: string
  groupNumber?: string
  focusTitle?: boolean
}

const LABEL_FONT =
  'font-cond text-[9px] font-bold uppercase tracking-[0.18em]'

export function CueRow({
  cue,
  displayNumber,
  depth,
  rowWidth,
  columns,
  cells,
  rundownId,
  selected,
  onSelect,
  onDelete,
  onUpdate,
  onConvertToHeading,
  onAddAbove,
  onAddBelow,
  onDuplicate,
  onRemoveFromGroup,
  onCellChange,
  onAddScript,
  onScriptsChange,
  onDeleteScript,
  onToggleScriptCollapsed,
  onSetDurationMode,
  focusScriptId,
  live,
  isActive,
  isNext,
  liveRemainingMs,
  liveElapsedMs,
  liveGetElapsedMs,
  onJump,
  privateNote,
  onPrivateNoteChange,
  isFirst,
  nextAutoStart,
  onToggleNextAutoStart,
  privateNotesIndex,
  privateNotesWidth = PRIVATE_NOTES_WIDTH,
  titleIndex = 0,
  timeFormat = 'auto',
  titleWidth = TITLE_COL_WIDTH,
  groupColor,
  groupTitle,
  groupNumber,
  focusTitle = false,
}: CueRowProps) {
  const [editingDuration, setEditingDuration] = useState(false)
  const [durationInput, setDurationInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(focusTitle)

  useEffect(() => {
    if (focusTitle) setEditingTitle(true)
  }, [focusTitle])
  const [editingSubtitle, setEditingSubtitle] = useState(false)
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
    marginBottom: CF.gap,
  }

  // During live mode, pin the active cue to the top — offset by the sticky
  // column header so the active cue isn't hidden behind it.
  useEffect(() => {
    if (!isActive) return
    const cont = document.querySelector('[data-cue-scroll]') as HTMLElement | null
    const row = rowRef.current
    if (!cont || !row) {
      rowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return
    }
    const cr = cont.getBoundingClientRect()
    const rr = row.getBoundingClientRect()
    cont.scrollTo({ top: cont.scrollTop + (rr.top - cr.top) - (CF.headerH + 8), behavior: 'smooth' })
  }, [isActive])

  // --- Editing handlers ---
  function startDurationEdit() {
    setDurationInput(formatDuration(cue.duration_ms))
    setEditingDuration(true)
    setTimeout(() => durationRef.current?.select(), 0)
  }
  async function saveDuration() {
    setEditingDuration(false)
    const ms = parseDurationInput(durationInput)
    if (ms === null || ms === cue.duration_ms) return
    const updates: Partial<Cue> = { duration_ms: ms }
    // Editing the duration directly always wins over the script-derived value.
    if (cue.duration_mode === 'auto') updates.duration_mode = 'manual'
    onUpdate(cue.id, updates)
    await updateCue(cue.id, rundownId, updates)
  }
  function saveTitleHtml(html: string) {
    setEditingTitle(false)
    if (html === cue.title) return
    onUpdate(cue.id, { title: html })
    updateCue(cue.id, rundownId, { title: html })
  }
  function saveSubtitleHtml(html: string) {
    setEditingSubtitle(false)
    const value = !html || html === '<p></p>' ? null : html
    if (value === cue.subtitle) return
    onUpdate(cue.id, { subtitle: value })
    updateCue(cue.id, rundownId, { subtitle: value })
  }
  function handleDelete() { onDelete(cue.id) }
  async function toggleStartType() {
    const newType = cue.start_type === 'soft' ? 'hard' : 'soft'
    const override = newType === 'hard' ? formatMsToTime(cue.calculated_start_ms) : null
    onUpdate(cue.id, { start_type: newType, start_time_override: override })
    await updateCue(cue.id, rundownId, { start_type: newType, start_time_override: override })
  }
  async function setColor(color: string | null) {
    onUpdate(cue.id, { background_color: color })
    await updateCue(cue.id, rundownId, { background_color: color })
  }
  function startStartEdit() {
    setStartInput(formatMsToTime(cue.calculated_start_ms))
    setEditingStart(true)
  }
  async function saveStart() {
    setEditingStart(false)
    const ms = parseClockInput(startInput)
    if (ms === null) return
    const override = formatMsToTime(ms)
    if (override === cue.start_time_override) return
    onUpdate(cue.id, { start_type: 'hard', start_time_override: override })
    await updateCue(cue.id, rundownId, { start_type: 'hard', start_time_override: override })
  }

  const startTimeLabel = formatMsToTimeDisplay(cue.calculated_start_ms, timeFormat)
  const isHard = cue.start_type === 'hard'
  const hasGap = isHard && cue.gap_ms > 0
  const liveOvertime = liveRemainingMs != null && liveRemainingMs < 0
  const isAutoDuration = cue.duration_mode === 'auto'
  const scriptWords = cue.scripts.length > 0 ? scriptsWordCount(cue.scripts) : 0

  // ── Block-model colours ──
  const ct = textOn(cue.background_color)
  const baseCellBg = cue.background_color || '#16161c'
  const numColor = isActive ? '#fff' : isNext ? '#eef0f3' : selected ? '#06060a' : (cue.background_color ? ct.num : '#9ba0ab')
  const remColor = liveRemainingMs == null ? '#eef0f3' : liveRemainingMs < 0 ? '#ff2848' : liveRemainingMs <= 30000 ? '#f0a838' : '#18d986'

  // shared tile base (block model)
  function tile(width: number, extra?: React.CSSProperties): React.CSSProperties {
    // content is top-aligned within the row
    return { width, minHeight: CF.minRowH, flexShrink: 0, background: baseCellBg, display: 'flex', alignItems: 'flex-start', padding: '12px 14px', ...extra }
  }

  const labelIndent = CF.rowPad + CF.c1 + CF.gap // 66

  // CueFlow cue-menu item class
  const MI = 'gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        rowRef.current = node
      }}
      style={style}
      data-cue-id={cue.id}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Parent group — shown above the current-cue indicator so a sub-cue's
          group context (e.g. "3 — YOUNG VITO") stays visible once it's pinned to the top */}
      {live && isActive && depth > 0 && groupNumber !== undefined && (
        <div
          data-testid="live-parent-group"
          className={cn('flex items-center gap-1.5 pt-1', LABEL_FONT)}
          style={{ paddingLeft: labelIndent, color: '#7c7e8a' }}
        >
          <span className="font-mono" style={{ color: groupColor ?? '#9ba0ab' }}>{groupNumber}</span>
          <span
            className="truncate normal-case tracking-normal font-sans text-[11px]"
            dangerouslySetInnerHTML={{ __html: inlineHtml(groupTitle || '') || 'Untitled group' }}
          />
        </div>
      )}

      {/* CURRENT / NEXT cue label (live mode) */}
      {live && (isActive || isNext) && (
        <div
          className={cn('flex items-center gap-2 pt-0.5 pb-1', LABEL_FONT)}
          style={{ paddingLeft: labelIndent, color: isActive ? '#ff5a73' : '#7c7e8a' }}
        >
          {isActive ? 'Current cue' : 'Next cue'}
          <div className="h-px flex-1" style={{ background: isActive ? 'rgba(255,40,72,0.5)' : '#22222a' }} />
        </div>
      )}

      {/* Gap / overlap indicator (white gap, red overlap) — text on the LEFT */}
      {isHard && cue.gap_ms !== 0 && !isActive && (
        <div
          className="flex items-center gap-2 pb-1 font-mono text-[11px]"
          style={{ paddingLeft: labelIndent, color: hasGap ? '#eef0f3' : '#ff5a73' }}
        >
          <span>{hasGap ? `+${formatDuration(cue.gap_ms)} gap` : `${formatDuration(-cue.gap_ms)} overlap`}</span>
          <div className="h-px flex-1" style={{ background: hasGap ? 'rgba(238,240,243,0.18)' : 'rgba(255,40,72,0.25)' }} />
        </div>
      )}

      {/* Row — block model */}
      <div
        className="group relative flex"
        style={{ gap: CF.gap, padding: `0 ${CF.rowPad}px` }}
      >
        {/* Control gutter (drag / settings / select) — stacked at top */}
        <div
          className="shrink-0 flex flex-col items-center pt-2 gap-1.5 group/col1"
          style={{ width: CF.c1, boxShadow: depth > 0 ? `inset 3px 0 0 ${groupColor ?? '#4a4a5a'}` : 'none' }}
        >
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            className="text-[#7c7e8a] hover:text-[#eef0f3] cursor-grab active:cursor-grabbing opacity-0 group-hover/col1:opacity-100 transition-opacity"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  title="Cue options"
                  data-testid="cue-settings-btn"
                  className="p-[3px] text-[#7c7e8a] hover:text-[#eef0f3] data-[state=open]:bg-[#1d1d24] data-[state=open]:text-[#eef0f3] transition-colors"
                />
              }
            >
              <Settings className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-[188px] p-0">
              <DropdownMenuItem onClick={toggleStartType} className={MI}>
                {isHard
                  ? <><Clock className="w-3.5 h-3.5 text-[#f0a838]" /> Make soft start</>
                  : <><AlarmClock className="w-3.5 h-3.5 text-[#9ba0ab]" /> Make hard start</>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddAbove(cue.id)} className={MI}>
                <Plus className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add cue above
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddBelow(cue.id)} className={MI}>
                <Plus className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add cue below
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(cue.id)} className={MI}>
                <Copy className="w-3.5 h-3.5 text-[#9ba0ab]" /> Duplicate cue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddScript(cue.id)} data-testid="add-script-menu-item" className={MI}>
                <ScrollText className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add script
              </DropdownMenuItem>

              {/* Background swatches */}
              <div className="px-3.5 py-2 border-t border-b border-[#1d1d24]">
                <p className="font-cond text-[9px] font-bold uppercase tracking-[0.16em] text-[#888b96] mb-2">Background</p>
                <div className="flex gap-1 flex-wrap">
                  {CUE_COLORS.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setColor(color)}
                      className="w-[22px] h-[22px] flex items-center justify-center transition-transform"
                      style={{
                        background: color ?? 'transparent',
                        border: `1.5px solid ${cue.background_color === color ? '#eef0f3' : '#3a3a48'}`,
                        transform: cue.background_color === color ? 'scale(1.12)' : 'none',
                      }}
                    >
                      {!color && <span className="text-[#9ba0ab] text-[10px]">✕</span>}
                    </button>
                  ))}
                </div>
              </div>

              {depth > 0 && onRemoveFromGroup && (
                <DropdownMenuItem onClick={() => onRemoveFromGroup(cue.id)} className={MI}>
                  <Ungroup className="w-3.5 h-3.5 text-[#9ba0ab]" /> Remove from group
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onConvertToHeading(cue.id)} data-testid="convert-to-heading-menu-item" className={MI}>
                <HeadingIcon className="w-3.5 h-3.5 text-[#9ba0ab]" /> Convert to heading
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1d1d24]" />
              <DropdownMenuItem
                onClick={handleDelete}
                data-testid="delete-cue-menu-item"
                className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[rgba(255,40,72,0.08)] focus:text-[#ff5a73] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete cue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={(e) => onSelect(cue.id, { shift: e.shiftKey, meta: true })}
            title="Select cue"
            className={cn(
              'w-3.5 h-3.5 flex items-center justify-center transition-all',
              selected ? 'opacity-100' : 'opacity-0 group-hover/col1:opacity-100'
            )}
            style={{
              background: selected ? '#f0a838' : 'transparent',
              border: `1px solid ${selected ? '#f0a838' : '#3a3a48'}`,
            }}
          >
            {selected && <Check className="w-2.5 h-2.5 text-[#06060a]" strokeWidth={3.5} />}
          </button>
        </div>

        {/* Number */}
        <div
          onClick={(e) => {
            e.stopPropagation()
            if (live) onJump(cue.id)
            else onSelect(cue.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
          }}
          title={live ? 'Jump to this cue' : 'Click to select'}
          style={tile(CF.num, {
            justifyContent: 'center',
            cursor: 'pointer',
            background: isActive ? '#ff2848' : isNext ? 'transparent' : selected ? '#f0a838' : baseCellBg,
            border: isNext ? '1.5px solid #6b6b76' : 'none',
          })}
        >
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: numColor }}>
            {displayNumber}
          </span>
        </div>

        {/* Start time */}
        <div
          style={tile(CF.start, { flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 2, cursor: isHard || isFirst ? 'text' : 'default', position: 'relative' })}
          onClick={() => (isHard || isFirst) && startStartEdit()}
          title={isHard ? 'Hard start — click to edit time' : isFirst ? 'Show start (anchor) — click to edit' : 'Soft start — derived from the previous cue'}
        >
          {editingStart ? (
            <input
              autoFocus
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onBlur={saveStart}
              onKeyDown={(e) => { if (e.key === 'Enter') saveStart(); if (e.key === 'Escape') setEditingStart(false) }}
              className="w-full bg-[#0a0a0d] border border-[#f0a838] px-1 py-0.5 text-xs text-[#eef0f3] font-mono outline-none"
            />
          ) : isHard || isFirst ? (
            <span
              className="inline-flex items-center gap-1 font-mono text-[13px] tabular-nums"
              style={{ fontWeight: isHard ? 600 : 400, color: isActive ? ct.hi : isHard ? '#eef0f3' : ct.mid }}
            >
              {startTimeLabel}
              {isHard && <Pin className="w-2.5 h-2.5 shrink-0 -rotate-45 fill-current ml-0.5" />}
            </span>
          ) : (
            <span className="font-mono text-[13px] tabular-nums" style={{ color: ct.mid }}>{startTimeLabel}</span>
          )}

          {/* Auto-start chevron to next cue (hidden during live) */}
          {!live && nextAutoStart !== null && (
            <button
              data-testid="autostart-toggle"
              data-on={nextAutoStart ? '1' : '0'}
              onClick={(e) => { e.stopPropagation(); onToggleNextAutoStart() }}
              title={nextAutoStart ? 'Disable auto-start of next cue' : 'Enable auto-start of next cue'}
              className={cn(
                'absolute left-1/2 -translate-x-1/2 -bottom-[13px] z-20 flex items-center justify-center w-5 h-[18px] transition-colors',
                !nextAutoStart && 'opacity-0 group-hover:opacity-100'
              )}
              style={{ background: '#09090d', border: '1px solid #1d1d24', color: nextAutoStart ? '#eef0f3' : '#3a3a48' }}
            >
              <ChevronDown className="w-3 h-3" strokeWidth={nextAutoStart ? 2.75 : 2} />
            </button>
          )}
        </div>

        {/* Duration */}
        <div
          style={tile(CF.dur, { flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1, cursor: 'text', position: 'relative' })}
          onClick={() => !editingDuration && !(isActive && live) && startDurationEdit()}
        >
          {editingDuration ? (
            <>
              <input
                ref={durationRef}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={saveDuration}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDuration(); if (e.key === 'Escape') setEditingDuration(false) }}
                className="w-full bg-[#0a0a0d] border border-[#f0a838] px-1 py-0.5 text-[13px] text-[#eef0f3] font-mono outline-none"
              />
              {/* The auto-duration option only surfaces here, as part of editing — not as a persistent badge */}
              {cue.scripts.length > 0 && (
                <button
                  data-testid="use-auto-duration-btn"
                  title={
                    scriptWords > 0
                      ? `Use auto duration — from ${scriptWords} script word${scriptWords === 1 ? '' : 's'}`
                      : 'Use auto duration (scripts are currently empty)'
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingDuration(false)
                    onSetDurationMode(cue.id, 'auto')
                  }}
                  className="mt-1 font-mono text-[8px] font-bold uppercase tracking-wide px-1.5 py-[1px] text-[#f0a838] hover:bg-[rgba(240,168,56,0.12)] transition-colors"
                  style={{ border: '1px solid rgba(240,168,56,0.5)' }}
                >
                  Use auto
                </button>
              )}
            </>
          ) : isActive && liveRemainingMs != null ? (
            <>
              <span className="font-mono text-[10px] tabular-nums leading-none" style={{ color: ct.mid }}>
                {formatDuration(cue.duration_ms)}
              </span>
              <span className="font-mono text-[21px] font-bold tabular-nums leading-[1.1]" style={{ color: remColor }}>
                {liveOvertime ? '+' : ''}{formatDuration(Math.abs(liveRemainingMs))}
              </span>
            </>
          ) : (
            <span
              className="font-mono text-[15px] font-semibold tabular-nums"
              style={{ color: isAutoDuration ? '#f0a838' : ct.hi, opacity: isAutoDuration ? 0.9 : 1 }}
            >
              {formatDuration(cue.duration_ms)}
            </span>
          )}

          {/* Passive "Auto" status pill — the only persistent indication that this cue's
              duration is script-driven; the option to change it lives in the click-to-edit flow above. */}
          {isAutoDuration && !editingDuration && !(isActive && live) && (
            <span
              data-testid="duration-auto-pill"
              title={
                scriptWords > 0
                  ? `Auto — from ${scriptWords} script word${scriptWords === 1 ? '' : 's'}`
                  : 'Auto — scripts are currently empty, showing the last value'
              }
              className="absolute left-1/2 -translate-x-1/2 -bottom-[13px] z-20 flex items-center justify-center px-1.5 h-[18px] font-mono text-[8px] font-bold uppercase tracking-wide"
              style={{
                background: '#09090d',
                border: `1px solid ${scriptWords > 0 ? 'rgba(240,168,56,0.5)' : 'rgba(255,90,115,0.5)'}`,
                color: scriptWords > 0 ? '#f0a838' : '#ff5a73',
              }}
            >
              Auto
            </span>
          )}
        </div>

        {/* Left-of-title dynamic cells */}
        {(() => {
          const leftCols = columns.slice(0, titleIndex)
          return leftCols.map((col) => (
            <div key={col.id} style={tile(col.width, { padding: '10px 2px' })}>
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
          ))
        })()}

        {/* Title + subtitle */}
        <div className="group/title shrink-0 flex flex-col" style={{ width: titleWidth, minHeight: CF.minRowH, background: baseCellBg, padding: '12px 16px' }}>
          {editingTitle ? (
            <InlineTipTap
              initialContent={cue.title}
              onSave={saveTitleHtml}
              editorClassName="tiptap-cell focus:outline-none w-full text-[15px] font-medium border-b border-[#f0a838]"
              className="w-full"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-[16px] font-medium text-left w-full leading-[1.35] break-words [overflow-wrap:anywhere] transition-colors"
              style={{ color: cue.title ? ct.hi : (cue.background_color ? ct.mid : '#6b6d78') }}
            >
              {cue.title
                ? <span className="tiptap-cell" dangerouslySetInnerHTML={{ __html: inlineHtml(cue.title) }} />
                : <span style={{ fontStyle: 'italic' }}>Untitled cue</span>}
            </button>
          )}

          {editingSubtitle ? (
            <InlineTipTap
              initialContent={cue.subtitle ?? ''}
              onSave={saveSubtitleHtml}
              editorClassName="tiptap-cell focus:outline-none w-full text-xs border-b border-[#3a3a48] mt-0.5"
              className="w-full mt-0.5"
            />
          ) : cue.subtitle ? (
            <button
              onClick={() => setEditingSubtitle(true)}
              className="text-xs text-left w-full break-words [overflow-wrap:anywhere] mt-0.5 leading-[1.3] transition-colors"
              style={{ color: ct.mid }}
            >
              <span className="tiptap-cell" dangerouslySetInnerHTML={{ __html: inlineHtml(cue.subtitle) }} />
            </button>
          ) : (
            <button
              onClick={() => setEditingSubtitle(true)}
              className="text-xs text-left w-full mt-0.5 italic opacity-0 group-hover/title:opacity-100 transition-opacity"
              style={{ color: cue.background_color ? ct.mid : '#5a5c66' }}
            >
              Add a subtitle…
            </button>
          )}

          {cue.scripts.length > 0 && (
            <button
              onClick={() => onAddScript(cue.id)}
              title="Add another script block"
              className="inline-flex items-center gap-1 text-[10px] text-left w-fit mt-1 opacity-0 group-hover/title:opacity-100 transition-opacity"
              style={{ color: cue.background_color ? ct.mid : '#5a5c66' }}
            >
              <Plus className="w-2.5 h-2.5" /> Add script
            </button>
          )}
        </div>

        {/* Right-of-title dynamic cells + Private Notes */}
        {(() => {
          const rightCols = columns.slice(titleIndex)
          const pnInRight = Math.max(0, privateNotesIndex - titleIndex)
          const insertAt = Math.min(Math.max(0, pnInRight), rightCols.length)
          const mergedIds = rightCols.map((c) => c.id as string)
          mergedIds.splice(insertAt, 0, PRIVATE_NOTES_ID)
          return mergedIds.map((id) => {
            if (id === PRIVATE_NOTES_ID) {
              return (
                <div key={PRIVATE_NOTES_ID} style={tile(privateNotesWidth, { padding: '10px 2px' })}>
                  <PrivateNoteCell
                    cueId={cue.id}
                    rundownId={rundownId}
                    value={privateNote}
                    onChange={onPrivateNoteChange}
                  />
                </div>
              )
            }
            const col = rightCols.find((c) => c.id === id)
            if (!col) return null
            return (
              <div key={col.id} style={tile(col.width, { padding: '10px 2px' })}>
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

      <ScriptDrawer
        scripts={cue.scripts}
        focusScriptId={focusScriptId}
        indent={labelIndent}
        width={rowWidth}
        onChange={(scripts) => onScriptsChange(cue.id, scripts)}
        onDelete={(scriptId) => onDeleteScript(cue.id, scriptId)}
        onToggleCollapsed={(scriptId) => onToggleScriptCollapsed(cue.id, scriptId)}
      />
    </div>
  )
}
