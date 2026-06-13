'use client'

import { useState, useEffect } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Square,
  Minus,
  Plus,
  ChevronUp,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/timing'
import { cn } from '@/lib/utils'
import type { LiveShow } from './useLiveShow'
import type { CueTimingOutput } from '@/lib/timing'

interface TransportBarProps {
  live: LiveShow
  cues: CueTimingOutput[]
}

const NUDGE_PRESETS = [10_000, 30_000, 60_000, 300_000, 600_000]

function formatSigned(ms: number): string {
  const sign = ms < 0 ? '−' : ''
  return sign + formatDuration(Math.abs(ms))
}

export function TransportBar({ live, cues }: TransportBarProps) {
  const [nudgeOpen, setNudgeOpen] = useState(false)
  const [customNudge, setCustomNudge] = useState('')
  const [clock, setClock] = useState(() => new Date())

  // running time-of-day clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeCue = cues.find((c) => c.id === live.activeCueId) ?? null
  const isLastCue =
    activeCue != null && cues[cues.length - 1]?.id === activeCue.id

  function applyCustomNudge(direction: 1 | -1) {
    const seconds = parseFloat(customNudge)
    if (isNaN(seconds) || seconds <= 0) return
    live.nudge(direction * seconds * 1000)
    setCustomNudge('')
    setNudgeOpen(false)
  }

  const overUnder = live.overUnderMs
  const onTime = Math.abs(overUnder) < 1000

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 py-2.5 flex items-center gap-4">
      {/* Status + elapsed (count-up) + current cue */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              live.status === 'running'
                ? 'bg-red-500 animate-pulse'
                : 'bg-amber-500'
            )}
          />
        </span>
        <div className="shrink-0">
          <span
            className={cn(
              'text-2xl font-mono font-semibold tabular-nums leading-none',
              live.isOvertime ? 'text-red-500' : 'text-white'
            )}
            data-testid="transport-elapsed"
          >
            {formatDuration(live.elapsedMs)}
          </span>
          <span className="text-[10px] text-zinc-500 ml-1.5">
            / {formatDuration(live.activeDurationMs)}
            {live.nudgeMs !== 0 && (
              <span className="text-amber-400">
                {' '}
                ({live.nudgeMs > 0 ? '+' : '−'}
                {formatDuration(Math.abs(live.nudgeMs))})
              </span>
            )}
          </span>
        </div>
        <div className="min-w-0 hidden md:block">
          <p
            data-testid="transport-cue-title"
            className="text-sm text-white truncate"
          >
            {activeCue?.title || (
              <span className="text-zinc-600 italic">Untitled cue</span>
            )}
          </p>
          <p className="text-[11px] text-zinc-500">
            Cue {activeCue?.cue_number || '·'}
          </p>
        </div>
      </div>

      {/* Nudge */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => live.nudge(-60_000)}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white font-mono"
        >
          <Minus className="w-3 h-3" />
          1m
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => live.nudge(60_000)}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white font-mono"
        >
          <Plus className="w-3 h-3" />
          1m
        </Button>

        <DropdownMenu open={nudgeOpen} onOpenChange={setNudgeOpen}>
          <DropdownMenuTrigger
            render={
              <button className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" />
            }
          >
            <ChevronUp className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            side="top"
            className="bg-zinc-900 border-zinc-700 text-zinc-200 w-56 p-3"
          >
            <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider">
              Adjust active cue
            </p>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {NUDGE_PRESETS.map((ms) => (
                <button
                  key={ms}
                  onClick={() => live.nudge(-ms)}
                  className="text-xs py-1 rounded bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-white transition-colors font-mono"
                >
                  −{formatDuration(ms)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1 mb-3">
              {NUDGE_PRESETS.map((ms) => (
                <button
                  key={ms}
                  onClick={() => live.nudge(ms)}
                  className="text-xs py-1 rounded bg-zinc-800 hover:bg-emerald-900/60 text-zinc-300 hover:text-white transition-colors font-mono"
                >
                  +{formatDuration(ms)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input
                value={customNudge}
                onChange={(e) => setCustomNudge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyCustomNudge(1)
                }}
                placeholder="secs"
                inputMode="numeric"
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <button
                onClick={() => applyCustomNudge(-1)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-white text-xs transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => applyCustomNudge(1)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-emerald-900/60 text-zinc-300 hover:text-white text-xs transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={live.prev}
          disabled={!live.prevCueId}
          className="text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30"
          title="Previous cue"
        >
          <SkipBack className="w-4 h-4 fill-current" />
        </Button>
        <Button
          size="icon"
          onClick={live.toggle}
          className={cn(
            'rounded-full',
            live.status === 'running'
              ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950'
              : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950'
          )}
          title={live.status === 'running' ? 'Pause' : 'Resume'}
        >
          {live.status === 'running' ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
        </Button>
        <Button
          size="sm"
          onClick={live.next}
          className={cn(
            'gap-1.5',
            isLastCue
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-white text-zinc-900 hover:bg-zinc-100'
          )}
          title={isLastCue ? 'End show' : 'Next cue'}
        >
          {isLastCue ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              End
            </>
          ) : (
            <>
              Next
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </>
          )}
        </Button>
      </div>

      {/* Clock + Over/Under */}
      <div className="hidden lg:flex items-center gap-4 shrink-0 pl-2 border-l border-zinc-800">
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none">
            Time of day
          </p>
          <p className="text-sm font-mono tabular-nums text-zinc-300">
            {clock.toLocaleTimeString('en-US', { hour12: true })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none">
            Over / Under
          </p>
          <p
            data-testid="transport-overunder"
            className={cn(
              'text-sm font-mono tabular-nums',
              onTime
                ? 'text-zinc-400'
                : overUnder > 0
                  ? 'text-red-400'
                  : 'text-emerald-400'
            )}
          >
            {onTime
              ? 'on time'
              : `${formatSigned(overUnder)} ${overUnder > 0 ? 'late' : 'early'}`}
          </p>
        </div>
      </div>
    </div>
  )
}
