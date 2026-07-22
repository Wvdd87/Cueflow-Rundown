'use client'

import { useEffect, useRef, useState } from 'react'
import { Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, parseDurationInput } from '@/lib/timing'
import {
  emptyFilters,
  hasActiveFilters,
  computeDropdownDimensions,
  computeUsedColors,
  type CueFilterState,
  type CueKind,
} from './cueFilters'
import type { Cue, Column } from '@/lib/supabase/types'

const LABEL = 'font-cond text-[9px] font-bold uppercase tracking-[0.16em] text-[#888b96]'
const CHECK_ROW =
  'flex items-center gap-2 w-full text-left px-2 py-1.5 text-[12.5px] text-[#c8c9d0] hover:bg-[#16161c] transition-colors cursor-pointer'

const CUE_TYPE_LABELS: Record<CueKind, string> = {
  cue: 'Regular cue',
  grouped: 'Grouped sub-cue',
  heading: 'Heading',
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className="w-3.5 h-3.5 flex items-center justify-center shrink-0"
      style={{
        background: checked ? '#f0a838' : 'transparent',
        border: `1px solid ${checked ? '#f0a838' : '#3a3a48'}`,
      }}
    >
      {checked && <span className="w-1.5 h-1.5 bg-[#06060a]" />}
    </span>
  )
}

interface CueFilterButtonProps {
  columns: Column[]
  cues: Cue[]
  cells: Record<string, string>
  filters: CueFilterState
  onChange: (next: CueFilterState) => void
}

/** The "Filter" trigger + its popover panel — sits inline in the toolbar (left of Search). */
export function CueFilterButton({ columns, cues, cells, filters, onChange }: CueFilterButtonProps) {
  const [open, setOpen] = useState(false)
  const [durationMinInput, setDurationMinInput] = useState('')
  const [durationMaxInput, setDurationMaxInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const dropdownDims = computeDropdownDimensions(columns, cues, cells)
  const usedColors = computeUsedColors(cues)
  const active = hasActiveFilters(filters)

  useEffect(() => {
    setDurationMinInput(filters.durationMinMs != null ? formatDuration(filters.durationMinMs) : '')
    setDurationMaxInput(filters.durationMaxMs != null ? formatDuration(filters.durationMaxMs) : '')
  }, [filters.durationMinMs, filters.durationMaxMs])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleColumnValue(columnId: string, value: string) {
    const current = filters.columnValues[columnId] ?? []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    onChange({ ...filters, columnValues: { ...filters.columnValues, [columnId]: next } })
  }
  function toggleCueType(kind: CueKind) {
    const next = new Set(filters.cueTypes)
    next.has(kind) ? next.delete(kind) : next.add(kind)
    onChange({ ...filters, cueTypes: next })
  }
  function toggleColor(color: string | null) {
    const next = new Set(filters.colors)
    next.has(color) ? next.delete(color) : next.add(color)
    onChange({ ...filters, colors: next })
  }
  function commitDurationMin() {
    const ms = durationMinInput.trim() ? parseDurationInput(durationMinInput) : null
    onChange({ ...filters, durationMinMs: ms })
  }
  function commitDurationMax() {
    const ms = durationMaxInput.trim() ? parseDurationInput(durationMaxInput) : null
    onChange({ ...filters, durationMaxMs: ms })
  }
  function clearAll() {
    onChange(emptyFilters())
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        data-testid="filter-btn"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 h-9 px-3 font-cond text-[10.5px] font-bold uppercase tracking-[0.12em] border transition-colors cursor-pointer',
          active
            ? 'bg-[rgba(240,168,56,0.12)] border-[#f0a838] text-[#f0a838]'
            : 'bg-[#111116] border-[#22222a] text-[#9ba0ab] hover:border-[#3a3a48]'
        )}
      >
        <Filter className="w-3 h-3" />
        Filter
        {active && (
          <span className="ml-0.5 font-mono text-[9px] bg-[#f0a838] text-[#06060a] w-4 h-4 flex items-center justify-center rounded-full">
            {activeDimensionCount(filters)}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="filter-panel"
          className="absolute top-[calc(100%+6px)] left-0 w-80 max-h-[70vh] overflow-y-auto bg-[#111116] border border-[#2e2e38] shadow-[0_18px_50px_rgba(0,0,0,0.8)] z-[620] p-3.5 space-y-4"
        >
          {/* Text search */}
          <div>
            <p className={cn(LABEL, 'mb-1.5')}>Text search</p>
            <input
              value={filters.text}
              onChange={(e) => onChange({ ...filters, text: e.target.value })}
              placeholder="Title, subtitle, or script…"
              className="w-full bg-[#0a0a0d] border border-[#2e2e38] px-2.5 py-1.5 text-[12.5px] text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]"
            />
          </div>

          {/* Dynamic dropdown-column dimensions (WHO / WHERE / SCREEN / …) */}
          {dropdownDims.map((dim) => (
            <div key={dim.columnId}>
              <p className={cn(LABEL, 'mb-1')}>{dim.columnName}</p>
              <div className="max-h-32 overflow-y-auto">
                {dim.values.map((v) => (
                  <button
                    key={v}
                    onClick={() => toggleColumnValue(dim.columnId, v)}
                    className={CHECK_ROW}
                  >
                    <Checkbox checked={(filters.columnValues[dim.columnId] ?? []).includes(v)} />
                    {dim.optionColors?.[v] && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dim.optionColors[v] }} />
                    )}
                    <span className="truncate">{v}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Cue type */}
          <div>
            <p className={cn(LABEL, 'mb-1')}>Cue type</p>
            {(['cue', 'grouped', 'heading'] as CueKind[]).map((k) => (
              <button key={k} onClick={() => toggleCueType(k)} className={CHECK_ROW}>
                <Checkbox checked={filters.cueTypes.has(k)} />
                <span>{CUE_TYPE_LABELS[k]}</span>
              </button>
            ))}
          </div>

          {/* Row color */}
          {usedColors.length > 0 && (
            <div>
              <p className={cn(LABEL, 'mb-1.5')}>Row color</p>
              <div className="flex gap-1 flex-wrap">
                {usedColors.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => toggleColor(color)}
                    title={color ?? 'No color'}
                    className="w-[22px] h-[22px] flex items-center justify-center transition-transform"
                    style={{
                      background: color ?? 'transparent',
                      border: `1.5px solid ${filters.colors.has(color) ? '#eef0f3' : '#3a3a48'}`,
                      transform: filters.colors.has(color) ? 'scale(1.12)' : 'none',
                    }}
                  >
                    {!color && <span className="text-[#9ba0ab] text-[10px]">✕</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Not final yet */}
          <button
            onClick={() => onChange({ ...filters, notFinalOnly: !filters.notFinalOnly })}
            className={CHECK_ROW}
          >
            <Checkbox checked={filters.notFinalOnly} />
            <span>Not final yet</span>
          </button>

          {/* Duration range */}
          <div>
            <p className={cn(LABEL, 'mb-1.5')}>Duration</p>
            <div className="flex items-center gap-2">
              <input
                value={durationMinInput}
                onChange={(e) => setDurationMinInput(e.target.value)}
                onBlur={commitDurationMin}
                onKeyDown={(e) => e.key === 'Enter' && commitDurationMin()}
                placeholder="Min"
                className="w-full bg-[#0a0a0d] border border-[#2e2e38] px-2 py-1.5 text-[12.5px] font-mono text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]"
              />
              <span className="text-[#5a5c66] text-xs shrink-0">–</span>
              <input
                value={durationMaxInput}
                onChange={(e) => setDurationMaxInput(e.target.value)}
                onBlur={commitDurationMax}
                onKeyDown={(e) => e.key === 'Enter' && commitDurationMax()}
                placeholder="Max"
                className="w-full bg-[#0a0a0d] border border-[#2e2e38] px-2 py-1.5 text-[12.5px] font-mono text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-[#1d1d24]">
            <button
              onClick={clearAll}
              disabled={!active}
              className="font-cond text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#7c7e8a] hover:text-[#c8c9d0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={() => setOpen(false)}
              className="font-cond text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#06060a] bg-[#f0a838] hover:bg-[#ffba50] px-3 py-1.5 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface CueFilterChipsRowProps {
  columns: Column[]
  filters: CueFilterState
  onChange: (next: CueFilterState) => void
  className?: string
}

/** Second toolbar line — only meaningful (and only ever rendered by the caller)
 *  once a filter is active, showing dismissible chips + a "Clear all" action. */
export function CueFilterChipsRow({ columns, filters, onChange, className }: CueFilterChipsRowProps) {
  function clearColumn(columnId: string) {
    const next = { ...filters.columnValues }
    delete next[columnId]
    onChange({ ...filters, columnValues: next })
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <FilterChips columns={columns} filters={filters} onChange={onChange} onClearColumn={clearColumn} />
      <button
        onClick={() => onChange(emptyFilters())}
        className="ml-1 inline-flex items-center gap-1 font-cond text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#5a5c66] hover:text-[#c8c9d0] transition-colors shrink-0"
      >
        Clear all filters
      </button>
    </div>
  )
}

function activeDimensionCount(f: CueFilterState): number {
  let n = 0
  if (f.text.trim()) n++
  n += Object.values(f.columnValues).filter((v) => v.length > 0).length
  if (f.cueTypes.size > 0) n++
  if (f.colors.size > 0) n++
  if (f.notFinalOnly) n++
  if (f.durationMinMs != null || f.durationMaxMs != null) n++
  return n
}

const CHIP =
  'inline-flex items-center gap-1.5 h-7 px-2.5 font-cond text-[10px] font-bold uppercase tracking-[0.08em] bg-[#16161c] border border-[#2e2e38] text-[#c8c9d0] shrink-0'

function FilterChips({
  columns,
  filters,
  onChange,
  onClearColumn,
}: {
  columns: Column[]
  filters: CueFilterState
  onChange: (next: CueFilterState) => void
  onClearColumn: (columnId: string) => void
}) {
  const chips: { key: string; label: string; onClear: () => void }[] = []

  if (filters.text.trim()) {
    chips.push({
      key: 'text',
      label: `Search: "${filters.text.trim()}"`,
      onClear: () => onChange({ ...filters, text: '' }),
    })
  }

  for (const [columnId, values] of Object.entries(filters.columnValues)) {
    if (values.length === 0) continue
    const col = columns.find((c) => c.id === columnId)
    chips.push({
      key: `col-${columnId}`,
      label: `${col?.name ?? 'Column'}: ${values.join(', ')}`,
      onClear: () => onClearColumn(columnId),
    })
  }

  if (filters.cueTypes.size > 0) {
    chips.push({
      key: 'cueTypes',
      label: `Type: ${[...filters.cueTypes].map((k) => CUE_TYPE_LABELS[k]).join(', ')}`,
      onClear: () => onChange({ ...filters, cueTypes: new Set() }),
    })
  }

  if (filters.colors.size > 0) {
    chips.push({
      key: 'colors',
      label: `Color: ${filters.colors.size}`,
      onClear: () => onChange({ ...filters, colors: new Set() }),
    })
  }

  if (filters.notFinalOnly) {
    chips.push({
      key: 'notFinal',
      label: 'Not final yet',
      onClear: () => onChange({ ...filters, notFinalOnly: false }),
    })
  }

  if (filters.durationMinMs != null || filters.durationMaxMs != null) {
    const min = filters.durationMinMs != null ? formatDuration(filters.durationMinMs) : null
    const max = filters.durationMaxMs != null ? formatDuration(filters.durationMaxMs) : null
    const label =
      min && max ? `Duration: ${min}–${max}` : min ? `Duration: ≥${min}` : `Duration: ≤${max}`
    chips.push({
      key: 'duration',
      label,
      onClear: () => onChange({ ...filters, durationMinMs: null, durationMaxMs: null }),
    })
  }

  return (
    <>
      {chips.map((chip) => (
        <span key={chip.key} className={CHIP}>
          {chip.label}
          <button onClick={chip.onClear} className="text-[#7c7e8a] hover:text-[#eef0f3] transition-colors">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </>
  )
}
