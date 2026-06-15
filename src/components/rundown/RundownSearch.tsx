'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Hash, Heading as HeadingIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchCue {
  id: string
  displayNumber: string
  title: string
  cue_type: 'cue' | 'heading'
}

interface RundownSearchProps {
  cues: SearchCue[]
  onSelect: (id: string) => void
}

export function RundownSearch({ cues, onSelect }: RundownSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = query.trim()
    ? cues.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.title.toLowerCase().includes(q) ||
          c.displayNumber.toLowerCase().includes(q)
        )
      })
    : []

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Ctrl/Cmd+F to focus the search bar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const handleSelect = useCallback((id: string) => {
    onSelect(id)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }, [onSelect])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIndex]) handleSelect(results[activeIndex].id)
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 w-48 focus-within:border-zinc-500 transition-colors">
        <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => { if (query) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Search cues…"
          className="bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none w-full"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50 max-h-72 overflow-y-auto">
          {results.map((c, i) => (
            <button
              key={c.id}
              onPointerDown={(e) => {
                e.preventDefault()
                handleSelect(c.id)
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                i === activeIndex ? 'bg-zinc-700' : 'hover:bg-zinc-800'
              )}
            >
              {c.cue_type === 'heading' ? (
                <HeadingIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              ) : (
                <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              )}
              {c.displayNumber && (
                <span className="text-xs font-mono text-zinc-400 shrink-0">{c.displayNumber}</span>
              )}
              <span className="text-sm text-white truncate">{c.title || <span className="text-zinc-500 italic">Untitled</span>}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50 px-3 py-3">
          <p className="text-sm text-zinc-500">No cues match &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
