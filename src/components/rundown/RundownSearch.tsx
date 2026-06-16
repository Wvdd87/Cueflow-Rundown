'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
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
    <div ref={containerRef} className="relative w-60 shrink-0">
      <div className={cn(
        'flex items-center gap-2 h-9 px-2.5 bg-[#111116] border transition-colors',
        open ? 'border-[#3a3a48]' : 'border-[#22222a]'
      )}>
        <Search className="w-3.5 h-3.5 text-[#888b96] shrink-0" />
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
          className="bg-transparent text-[13px] text-[#eef0f3] placeholder:text-[#5a5c66] outline-none w-full"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-72 bg-[#111116] border border-[#2e2e38] shadow-[0_18px_50px_rgba(0,0,0,0.8)] z-[620] max-h-[340px] overflow-y-auto">
          {results.map((c, i) => (
            <button
              key={c.id}
              onPointerDown={(e) => {
                e.preventDefault()
                handleSelect(c.id)
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors',
                i > 0 && 'border-t border-[#1d1d24]',
                i === activeIndex ? 'bg-[#16161c]' : 'hover:bg-[#16161c]'
              )}
            >
              <span className="font-mono text-[12px] font-bold w-7 shrink-0" style={{ color: c.cue_type === 'heading' ? '#7c7e8a' : '#f0a838' }}>
                {c.cue_type === 'heading' ? '§' : (c.displayNumber || '')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-[#eef0f3] truncate">
                  {c.title || <span className="text-[#5a5c66] italic">Untitled</span>}
                </span>
              </span>
              {c.cue_type === 'heading' && (
                <span className="font-cond text-[9px] font-bold uppercase tracking-[0.12em] text-[#5a5c66] shrink-0">
                  Heading
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-72 bg-[#111116] border border-[#2e2e38] shadow-[0_18px_50px_rgba(0,0,0,0.8)] z-[620] px-4 py-3.5">
          <p className="text-[12.5px] text-[#5a5c66] italic">No cues match “{query}”</p>
        </div>
      )}
    </div>
  )
}
