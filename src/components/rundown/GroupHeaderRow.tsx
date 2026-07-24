'use client'

import { useState, useEffect } from 'react'
import {
  GripVertical,
  Settings,
  ChevronDown,
  ChevronRight,
  Ungroup,
  Trash2,
  AlignLeft,
  Plus,
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
import { formatMsToTimeDisplay } from '@/lib/timing'
import { inlineHtml } from '@/lib/utils'
import { CF, CUE_COLORS, textOn } from './layout'
import type { Cue } from '@/lib/supabase/types'
import type { TimeDisplay } from '@/lib/timing'
import type { RuleRowResult } from '@/lib/rules'

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
  rowWidth: number
  timeFormat?: TimeDisplay
  onToggleCollapse: () => void
  onSelect: (id: string, mods: { shift: boolean; meta: boolean }) => void
  onUpdate: (id: string, updates: Partial<Cue>) => void
  onUngroup?: (id: string) => void
  onDelete: (id: string) => void
  onConvertToCue?: (id: string) => void
  onAddAbove?: (id: string) => void
  onAddBelow?: (id: string) => void
  focused?: boolean
  onCellFocus?: (id: string, colId: string) => void
  ruleResult?: RuleRowResult
}

const MI = 'gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

export function GroupHeaderRow({
  heading,
  number,
  rundownId,
  aggregate,
  collapsed,
  selected,
  rowWidth,
  timeFormat = 'auto',
  onToggleCollapse,
  onSelect,
  onUpdate,
  onUngroup,
  onDelete,
  onConvertToCue,
  onAddAbove,
  onAddBelow,
  focused = false,
  onCellFocus,
  ruleResult,
}: GroupHeaderRowProps) {
  const isGroup = aggregate.count > 0
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(heading.title || (isGroup ? 'New group' : ''))

  useEffect(() => {
    setTitle(heading.title || (isGroup ? 'New group' : ''))
  }, [heading.title, isGroup])

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: heading.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: rowWidth,
    minHeight: CF.minRowH,
    marginTop: isGroup ? 0 : 30,
    marginBottom: CF.gap,
    gap: CF.gap,
    padding: `0 ${CF.rowPad}px`,
  }

  async function saveTitle() {
    setEditing(false)
    const fallback = isGroup ? 'New group' : ''
    const t = title.trim() || fallback
    if (t === heading.title) return
    onUpdate(heading.id, { title: t })
    await updateCue(heading.id, rundownId, { title: t })
  }

  async function setColor(color: string | null) {
    onUpdate(heading.id, { background_color: color })
    await updateCue(heading.id, rundownId, { background_color: color })
  }

  const effectiveBg = ruleResult?.backgroundColor ?? heading.background_color
  const autoCt = textOn(effectiveBg)
  const ct = ruleResult?.textColor ? { hi: ruleResult.textColor, mid: ruleResult.textColor, num: ruleResult.textColor } : autoCt
  const bandBg = effectiveBg
    ? effectiveBg
    : isGroup
      ? (selected ? 'rgba(240,168,56,0.18)' : '#1a1a20')
      : (selected ? 'rgba(240,168,56,0.14)' : '#15151b')
  const bandBorder = selected
    ? 'rgba(240,168,56,0.4)'
    : effectiveBg ? 'transparent' : '#26262e'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch"
      data-cue-id={heading.id}
      onMouseDownCapture={(e) => {
        if (e.shiftKey && !(e.target as HTMLElement).closest?.('[contenteditable="true"]')) e.preventDefault()
      }}
      onClick={(e) => e.stopPropagation()}
      onClickCapture={(e) => {
        const target = e.target as HTMLElement
        if (target.closest?.('[contenteditable="true"]')) return
        if (!target.closest('[data-col-id]')) return
        if (e.shiftKey) { e.preventDefault(); e.stopPropagation() }
        // Defer focus to after the click dispatches — see the CueRow note (#74):
        // a synchronous focusedCell update swallows the bubble onClick that opens
        // the editor for a filled (dangerouslySetInnerHTML) heading title.
        setTimeout(() => onCellFocus?.(heading.id, 'title'), 0)
      }}
    >
      {/* Control gutter */}
      <div
        className="shrink-0 relative flex items-center justify-center group/col1"
        style={{ width: CF.c1 }}
      >
        <button
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className="absolute top-[5px] left-1/2 -translate-x-1/2 text-[#7c7e8a] hover:text-[#eef0f3] cursor-grab active:cursor-grabbing opacity-0 group-hover/col1:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                title={isGroup ? 'Group options' : 'Heading options'}
                className="p-[3px] text-[#888b96] hover:text-[#eef0f3] data-[state=open]:bg-[#1d1d24] data-[state=open]:text-[#eef0f3] transition-colors"
              />
            }
          >
            <Settings className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-[190px] p-0">
            {onAddAbove && (
              <DropdownMenuItem onClick={() => onAddAbove(heading.id)} className={MI}>
                <Plus className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add cue above
              </DropdownMenuItem>
            )}
            {onAddBelow && (
              <DropdownMenuItem onClick={() => onAddBelow(heading.id)} className={MI}>
                <Plus className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add cue below
              </DropdownMenuItem>
            )}
            {(onAddAbove || onAddBelow) && <DropdownMenuSeparator className="bg-[#1d1d24]" />}
            {!isGroup && (
              <div className="px-3.5 py-2 border-b border-[#1d1d24]">
                <p className="font-cond text-[9px] font-bold uppercase tracking-[0.16em] text-[#888b96] mb-2">Background</p>
                <div className="flex gap-1 flex-wrap">
                  {CUE_COLORS.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => setColor(color)}
                      className="w-[22px] h-[22px] flex items-center justify-center transition-transform"
                      style={{
                        background: color ?? 'transparent',
                        border: `1.5px solid ${heading.background_color === color ? '#eef0f3' : '#3a3a48'}`,
                        transform: heading.background_color === color ? 'scale(1.12)' : 'none',
                      }}
                    >
                      {!color && <span className="text-[#9ba0ab] text-[10px]">✕</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isGroup ? (
              onUngroup && (
                <DropdownMenuItem onClick={() => onUngroup(heading.id)} className={MI}>
                  <Ungroup className="w-3.5 h-3.5 text-[#9ba0ab]" /> Ungroup
                </DropdownMenuItem>
              )
            ) : (
              onConvertToCue && (
                <DropdownMenuItem onClick={() => onConvertToCue(heading.id)} className={MI}>
                  <AlignLeft className="w-3.5 h-3.5 text-[#9ba0ab]" /> Convert to cue
                </DropdownMenuItem>
              )
            )}
            <DropdownMenuSeparator className="bg-[#1d1d24]" />
            <DropdownMenuItem
              onClick={() => onDelete(heading.id)}
              className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[rgba(255,40,72,0.08)] focus:text-[#ff5a73] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> {isGroup ? 'Delete group' : 'Delete heading'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Band — spans from the gutter to the private-notes edge, fills row height */}
      <div
        className="flex-1 min-w-0 flex items-center"
        style={{ background: bandBg, border: `1px solid ${bandBorder}`, paddingRight: 14 }}
      >
        {/* Number — fixed box aligned with the cue-number column */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: CF.num }}>
          {isGroup ? (
            <span
              onClick={(e) => { e.stopPropagation(); onSelect(heading.id, { shift: e.shiftKey, meta: e.metaKey || e.ctrlKey }) }}
              title="Click to select group"
              className="font-mono text-sm font-bold cursor-pointer px-[9px] py-0.5"
              style={{ color: selected ? '#06060a' : '#9ba0ab', background: selected ? '#f0a838' : 'transparent' }}
            >
              {number}
            </span>
          ) : (
            <span className="font-mono text-sm font-bold" style={{ color: effectiveBg ? ct.mid : '#7c7e8a' }}>
              {number}
            </span>
          )}
        </div>

        {/* Title + (group) aggregate */}
        <div
          data-row-id={heading.id}
          data-col-id="title"
          className="flex-1 min-w-0 pl-1"
          style={focused ? { boxShadow: 'inset 0 0 0 2px #f0a838' } : undefined}
        >
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditing(false); setTitle(heading.title || (isGroup ? 'New group' : '')) } }}
              className="w-full bg-transparent outline-none border-b border-[#f0a838]"
              style={{ fontSize: isGroup ? 14 : 16, fontWeight: isGroup ? 600 : 700, color: effectiveBg ? ct.hi : '#fff' }}
            />
          ) : (
            <button
              data-cell-trigger
              onClick={() => setEditing(true)}
              className="text-left w-full break-words [overflow-wrap:anywhere]"
              style={{
                fontSize: isGroup ? 14 : 16,
                fontWeight: isGroup ? 600 : 700,
                letterSpacing: isGroup ? undefined : '0.01em',
                color: heading.title ? (effectiveBg ? ct.hi : '#eef0f3') : '#5a5c66',
                fontStyle: heading.title ? 'normal' : 'italic',
              }}
            >
              {heading.title
                ? <span className="tiptap-cell" dangerouslySetInnerHTML={{ __html: inlineHtml(heading.title) }} />
                : (isGroup ? 'New group' : 'Untitled heading')}
            </button>
          )}
          {isGroup && (
            <div className="flex items-center gap-2.5 mt-0.5 font-mono text-[11px] text-[#888b96]">
              <span>{formatLong(aggregate.durationMs)}</span>
              <span className="text-[#5a5c66]">
                {formatMsToTimeDisplay(aggregate.startMs, timeFormat)} → {formatMsToTimeDisplay(aggregate.endMs, timeFormat)}
              </span>
              <span className="text-[#5a5c66]">· {aggregate.count} cue{aggregate.count === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        {/* Collapse chevron (group only) */}
        {isGroup && (
          <button
            data-testid="group-collapse"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand group' : 'Collapse group'}
            className="shrink-0 text-[#9ba0ab] hover:text-[#eef0f3] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronDown className="w-[18px] h-[18px]" />}
          </button>
        )}
      </div>
    </div>
  )
}
