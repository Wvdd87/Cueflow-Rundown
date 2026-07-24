'use client'

import { useEffect, useRef } from 'react'
import { X, ChevronUp, ChevronDown, CaseSensitive, Equal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Column } from '@/lib/supabase/types'

export interface FindReplaceState {
  find: string
  replace: string
  scope: string // 'all' | 'title' | column id
  matchCase: boolean
  wholeValue: boolean
}

interface FindReplacePanelProps {
  open: boolean
  onClose: () => void
  columns: Column[]
  state: FindReplaceState
  setState: (patch: Partial<FindReplaceState>) => void
  matchCount: number
  /** 1-based position of the current match, or 0 when there are none. */
  current: number
  onPrev: () => void
  onNext: () => void
  onReplace: () => void
  onReplaceAll: () => void
}

const INPUT = 'w-full bg-[#16161c] border border-[#2e2e38] px-2 py-1.5 text-xs text-[#eef0f3] outline-none focus:border-[#3a3a48]'
const TOGGLE = (on: boolean) =>
  cn(
    'shrink-0 flex items-center justify-center h-7 w-7 border transition-colors',
    on
      ? 'border-[#f0a838]/60 text-[#f0a838] bg-[rgba(240,168,56,0.1)]'
      : 'border-[#2e2e38] text-[#9ba0ab] hover:text-[#eef0f3] hover:border-[#3a3a48]'
  )
const ICON_BTN = 'shrink-0 flex items-center justify-center h-7 w-7 border border-[#2e2e38] text-[#9ba0ab] hover:text-[#eef0f3] hover:border-[#3a3a48] transition-colors disabled:opacity-40 disabled:pointer-events-none'
const BTN = 'px-2.5 h-7 font-cond text-[10px] font-bold uppercase tracking-[0.1em] border border-[#2e2e38] text-[#c8c9d0] hover:bg-[#1d1d24] hover:text-[#eef0f3] transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none'

export function FindReplacePanel({
  open,
  onClose,
  columns,
  state,
  setState,
  matchCount,
  current,
  onPrev,
  onNext,
  onReplace,
  onReplaceAll,
}: FindReplacePanelProps) {
  const findRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) findRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      data-testid="find-replace-panel"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
      className="absolute right-4 top-3 z-40 w-[320px] bg-[#111116] border border-[#2e2e38] border-t-2 border-t-[#f0a838] shadow-xl p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <p className="font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c7e8a]">Find &amp; replace</p>
        <button onClick={onClose} className="text-[#7c7e8a] hover:text-[#eef0f3]" data-testid="find-replace-close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <input
          ref={findRef}
          data-testid="find-input"
          value={state.find}
          onChange={(e) => setState({ find: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.shiftKey ? onPrev() : onNext()) }}
          placeholder="Find"
          className={INPUT}
        />
        <button className={TOGGLE(state.matchCase)} title="Match case" onClick={() => setState({ matchCase: !state.matchCase })} data-testid="find-match-case">
          <CaseSensitive className="w-4 h-4" />
        </button>
        <button className={TOGGLE(state.wholeValue)} title="Whole value only" onClick={() => setState({ wholeValue: !state.wholeValue })} data-testid="find-whole-value">
          <Equal className="w-3.5 h-3.5" />
        </button>
      </div>

      <input
        data-testid="replace-input"
        value={state.replace}
        onChange={(e) => setState({ replace: e.target.value })}
        placeholder="Replace with"
        className={INPUT}
      />

      <select
        data-testid="find-scope"
        value={state.scope}
        onChange={(e) => setState({ scope: e.target.value })}
        className={INPUT}
      >
        <option value="all">All columns</option>
        <option value="title">Title</option>
        {columns.filter((c) => c.col_type === 'richtext').map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span data-testid="find-count" className="font-mono text-[11px] text-[#888b96] tabular-nums">
          {matchCount === 0 ? 'No matches' : `${current} of ${matchCount}`}
        </span>
        <div className="flex items-center gap-1.5">
          <button className={ICON_BTN} onClick={onPrev} disabled={matchCount === 0} title="Previous match" data-testid="find-prev">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button className={ICON_BTN} onClick={onNext} disabled={matchCount === 0} title="Next match" data-testid="find-next">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button className={BTN} onClick={onReplace} disabled={matchCount === 0} data-testid="replace-one">Replace</button>
          <button className={BTN} onClick={onReplaceAll} disabled={matchCount === 0} data-testid="replace-all">All</button>
        </div>
      </div>
    </div>
  )
}
