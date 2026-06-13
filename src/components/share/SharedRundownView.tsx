'use client'

import { useEffect, useMemo, useRef } from 'react'
import { buildCueLayout } from '@/components/rundown/cueTree'
import { useLiveSubscription } from '@/components/rundown/liveSync'
import {
  calculateTimings,
  formatMsToTime,
  formatDuration,
  type CueTimingOutput,
} from '@/lib/timing'
import { resolveVariablesHtml } from '@/lib/cellHtml'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import type { Rundown, Column, Cue, Cell, Variable } from '@/lib/supabase/types'

export interface SharedData {
  rundown: Rundown
  columns: Column[]
  cues: Cue[]
  cells: Cell[]
  variables: Variable[]
}

export function SharedRundownView({ data }: { data: SharedData }) {
  const { rundown, columns = [], cues = [], cells = [], variables = [] } = data
  const live = useLiveSubscription(rundown.id)
  const activeRowRef = useRef<HTMLDivElement>(null)

  const varMap = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.key, v.value])),
    [variables]
  )
  const cellMap = useMemo(
    () =>
      Object.fromEntries(
        cells.map((c) => [`${c.cue_id}:${c.column_id}`, c.content ?? ''])
      ),
    [cells]
  )
  const layout = useMemo(() => buildCueLayout(cues), [cues])
  const timedMap = useMemo(() => {
    const timed = calculateTimings(layout.docOrder)
    return Object.fromEntries(timed.map((t) => [t.id, t])) as Record<
      string,
      CueTimingOutput
    >
  }, [layout])

  // Keep the live cue pinned to the top as the operator advances
  useEffect(() => {
    if (live.activeCueId) {
      activeRowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [live.activeCueId])

  const showDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  function renderCells(cueId: string) {
    return columns.map((col) => {
      const raw = cellMap[`${cueId}:${col.id}`] ?? ''
      if (col.col_type === 'dropdown') {
        const color = col.option_colors?.[raw]
        return (
          <div key={col.id} style={{ width: col.width }} className="shrink-0 border-l border-zinc-800/60 px-2 py-1.5">
            {raw ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded text-zinc-100 font-medium"
                style={{ backgroundColor: color ?? 'rgba(63,63,70,0.7)' }}
              >
                {raw}
              </span>
            ) : null}
          </div>
        )
      }
      return (
        <div key={col.id} style={{ width: col.width }} className="shrink-0 border-l border-zinc-800/60 px-2 py-1.5">
          <div
            className="tiptap-cell text-sm text-zinc-300 break-words"
            dangerouslySetInnerHTML={{ __html: resolveVariablesHtml(raw, varMap) }}
          />
        </div>
      )
    })
  }

  function cueRow(cue: Cue, number: string, depth: number) {
    const t = timedMap[cue.id]
    const isActive = live.activeCueId === cue.id
    return (
      <div
        key={cue.id}
        ref={isActive ? activeRowRef : undefined}
        className={cn(
          'flex items-stretch min-h-[40px] border-b border-zinc-800/60',
          isActive ? 'bg-emerald-950/40' : '',
          depth > 0 && 'border-l-2 border-zinc-700/70 bg-zinc-900/20'
        )}
      >
        <div className="w-12 shrink-0 flex items-center px-2">
          <span
            className={cn(
              'text-xs px-2 rounded tabular-nums',
              isActive ? 'bg-emerald-600 text-white' : 'text-zinc-400'
            )}
          >
            {number}
          </span>
        </div>
        <div className="w-[84px] shrink-0 flex items-center px-2 text-xs font-mono tabular-nums text-zinc-400">
          {cue.start_type === 'hard' ? '⚑ ' : ''}
          {formatMsToTime(t?.calculated_start_ms ?? 0)}
        </div>
        <div className="w-[76px] shrink-0 flex items-center px-2 text-xs font-mono tabular-nums text-zinc-400">
          {formatDuration(cue.duration_ms)}
        </div>
        <div className="w-[240px] grow min-w-0 flex flex-col justify-center px-3 py-1.5">
          <span className="text-sm text-white truncate">
            {cue.title || <span className="text-zinc-600 italic">Untitled</span>}
          </span>
          {cue.subtitle && <span className="text-xs text-zinc-500 truncate">{cue.subtitle}</span>}
        </div>
        {renderCells(cue.id)}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-6 h-14 border-b border-zinc-800 bg-zinc-950">
        <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0">
          <span className="text-zinc-900 font-bold text-xs">R</span>
        </div>
        <h1 className="font-semibold text-sm truncate">{rundown.name}</h1>
        <StatusBadge status={rundown.status} />
        {live.status === 'running' && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live
          </span>
        )}
        {showDate && <span className="text-xs text-zinc-500 ml-auto">{showDate}</span>}
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5 ml-2">
          Read-only
        </span>
      </header>

      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className="flex items-stretch border-b border-zinc-800 bg-zinc-900/60 select-none">
          <div className="w-12 shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">#</div>
          <div className="w-[84px] shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Start</div>
          <div className="w-[76px] shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Dur.</div>
          <div className="w-[240px] grow px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Title</div>
          {columns.map((col) => (
            <div key={col.id} style={{ width: col.width }} className="shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-l border-zinc-800 truncate">
              {col.name}
            </div>
          ))}
        </div>

        {layout.items.map((item) => {
          if (item.type === 'group') {
            const dur = item.children.reduce((s, c) => s + c.duration_ms, 0)
            return (
              <div key={item.heading.id}>
                <div className="flex items-stretch min-h-[40px] bg-zinc-800/40 border-b border-zinc-800">
                  <div className="w-12 shrink-0 flex items-center px-2 text-xs text-zinc-400">{item.number}</div>
                  <div className="grow flex items-center gap-3 px-3 py-2">
                    <span className="text-sm font-semibold text-white">{item.heading.title || 'Group'}</span>
                    <span className="text-[11px] font-mono text-zinc-500">{formatDuration(dur)}</span>
                  </div>
                </div>
                {item.children.map((ch) => cueRow(ch, layout.numberOf[ch.id] ?? '', 1))}
              </div>
            )
          }
          return cueRow(item.cue, item.number, 0)
        })}

        {cues.length === 0 && (
          <p className="text-sm text-zinc-600 py-12 text-center">This rundown has no cues yet.</p>
        )}
      </div>
    </div>
  )
}
