'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'

export interface SuggestionItem {
  id: string
  label: string
  hint?: string | null
}

export interface SuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

interface SuggestionListProps {
  items: SuggestionItem[]
  char: string
  command: (item: SuggestionItem) => void
}

/** Caret-anchored dropdown for @-mention / $-variable suggestions. */
export const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  function SuggestionList({ items, char, command }, ref) {
    const [selected, setSelected] = useState(0)

    useEffect(() => setSelected(0), [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelected((s) => (s + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelected((s) => (s + 1) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (items[selected]) command(items[selected])
          return true
        }
        return false
      },
    }))

    return (
      <div
        data-testid="suggestion-popup"
        className="min-w-[160px] max-w-[260px] rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
      >
        {items.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-zinc-500 italic">
            No matches — add one in Settings
          </div>
        ) : (
          items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                command(item)
              }}
              onMouseEnter={() => setSelected(i)}
              className={[
                'w-full flex items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors',
                i === selected ? 'bg-zinc-700 text-white' : 'text-zinc-300',
              ].join(' ')}
            >
              <span
                className={
                  char === '$'
                    ? 'text-emerald-400 font-mono text-xs'
                    : 'text-blue-400 text-xs'
                }
              >
                {char}
              </span>
              <span className="truncate flex-1">{item.label}</span>
              {item.hint && (
                <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">
                  {item.hint}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    )
  }
)
