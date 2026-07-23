'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Suggestion } from './useFieldSuggestions'

interface CellSuggestionsProps {
  suggestions: Suggestion[]
  highlighted: number
  onHover: (i: number) => void
  onPick: (value: string) => void
}

/** Autocomplete popover for a cell editor (#71.1 / #71.6). Presentational —
 *  keyboard nav is driven by the host editor via `highlighted`. */
export function CellSuggestions({ suggestions, highlighted, onHover, onPick }: CellSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div
      data-suggestion-popup
      className="absolute left-0 top-full mt-0.5 z-50 min-w-[180px] max-w-[340px] max-h-64 overflow-y-auto bg-[#111116] border border-[#2e2e38] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1"
      // Keep clicks inside the editor's wrapper so it doesn't blur/save early.
      onMouseDown={(e) => e.preventDefault()}
    >
      {suggestions.map((s, i) => {
        const prev = suggestions[i - 1]
        const showOtherDivider = s.source === 'other' && prev?.source !== 'other'
        const showSmartLabel = s.source === 'smart' && prev?.source !== 'smart'
        return (
          <div key={`${s.source}:${s.value}:${i}`}>
            {showOtherDivider && (
              <p className="px-2.5 pt-1.5 pb-0.5 font-cond text-[9px] font-bold uppercase tracking-[0.12em] text-[#5a5c66]">
                From other rundowns
              </p>
            )}
            {showSmartLabel && (
              <p className="px-2.5 pt-1.5 pb-0.5 font-cond text-[9px] font-bold uppercase tracking-[0.12em] text-[#f0a838] flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Suggested
              </p>
            )}
            <button
              data-testid="cell-suggestion"
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(s.value)}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-[12.5px] truncate transition-colors flex items-center gap-1.5',
                i === highlighted ? 'bg-[#1d1d24] text-[#eef0f3]' : 'text-[#c8c9d0] hover:bg-[#16161c]'
              )}
            >
              {s.source === 'smart' && <Sparkles className="w-3 h-3 text-[#f0a838] shrink-0" />}
              <span className="truncate">{s.value}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
