'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDuration } from '@/lib/timing'
import { cn } from '@/lib/utils'
import type { LiveShow } from './useLiveShow'
import type { CueTimingOutput } from '@/lib/timing'

interface TransportBarProps {
  live: LiveShow
  cues: CueTimingOutput[]
}

const NUDGE_PRESETS = [10_000, 30_000, 60_000, 300_000, 600_000]
const LABEL = 'font-cond text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#888b96]'

function formatSigned(ms: number): string {
  const sign = ms < 0 ? '−' : ''
  return sign + formatDuration(Math.abs(ms))
}

export function TransportBar({ live, cues }: TransportBarProps) {
  const [nudgeOpen, setNudgeOpen] = useState(false)
  const [customNudge, setCustomNudge] = useState('')
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeCue = cues.find((c) => c.id === live.activeCueId) ?? null
  const isLastCue = activeCue != null && cues[cues.length - 1]?.id === activeCue.id
  const overtime = live.isOvertime
  const remaining = live.remainingMs

  function applyCustomNudge(direction: 1 | -1) {
    const seconds = parseFloat(customNudge)
    if (isNaN(seconds) || seconds <= 0) return
    live.nudge(direction * seconds * 1000)
    setCustomNudge('')
    setNudgeOpen(false)
  }

  const overUnder = live.overUnderMs
  const onTime = Math.abs(overUnder) < 1000

  // Current-cue progress bar, driven at 60fps via rAF + a DOM ref (constant
  // width in JSX so React's 200ms ticks don't clobber the smooth value).
  const progressRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = progressRef.current
    if (!bar) return
    const paint = () => {
      const d = live.activeDurationMs
      const el = live.getElapsedMs()
      bar.style.width = d > 0 ? `${Math.min(100, (el / d) * 100)}%` : '0%'
      bar.style.background = d > 0 && el > d ? '#ff2848' : '#f0a838'
    }
    if (live.status === 'running') {
      let rafId = 0
      const loop = () => { paint(); rafId = requestAnimationFrame(loop) }
      rafId = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafId)
    }
    paint() // paused — freeze at the current position
  }, [live.status, live.activeCueId, live.activeDurationMs, live.getElapsedMs])

  return (
    <div className="relative shrink-0 flex items-center gap-4 h-[60px] bg-[#0d0d12] border-b border-[#22222a] px-[18px]">
      {/* Current-cue progress bar — sits right under the control bar */}
      <div className="absolute left-0 right-0 -bottom-px h-[3px] bg-[rgba(255,255,255,0.08)] pointer-events-none">
        <div ref={progressRef} data-testid="live-progress" className="h-full" style={{ width: '0%', background: '#f0a838' }} />
      </div>

      {/* Hero remaining countdown — aligned with the cue-number column */}
      <div className="flex items-center gap-3 flex-1 min-w-0 pl-12">
        <div className="shrink-0">
          <span
            data-testid="transport-remaining"
            className="font-mono text-[30px] font-bold tabular-nums leading-none"
            style={{ color: overtime ? '#ff2848' : '#f0a838' }}
          >
            {(overtime ? '+' : '') + formatDuration(Math.abs(remaining ?? 0))}
          </span>
          <span className="font-mono text-[11px] text-[#888b96] ml-[18px]">
            {formatDuration(live.elapsedMs)} / {formatDuration(live.activeDurationMs)}
            {live.nudgeMs !== 0 && (
              <span className="text-[#f0a838]">
                {' '}({live.nudgeMs > 0 ? '+' : '−'}{formatDuration(Math.abs(live.nudgeMs))})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Nudge */}
      <div className="flex items-center shrink-0 relative">
        <button
          onClick={() => live.nudge(-60_000)}
          className="h-8 px-2.5 inline-flex items-center bg-[#16161c] text-[#c8c9d0] border border-[#2e2e38] hover:bg-[#1d1d24] font-mono text-xs transition-colors"
        >
          −1m
        </button>
        <button
          onClick={() => live.nudge(60_000)}
          className="h-8 px-2.5 inline-flex items-center bg-[#16161c] text-[#c8c9d0] border border-[#2e2e38] border-l-0 hover:bg-[#1d1d24] font-mono text-xs transition-colors"
        >
          +1m
        </button>
        <DropdownMenu open={nudgeOpen} onOpenChange={setNudgeOpen}>
          <DropdownMenuTrigger
            render={
              <button className="h-8 w-7 inline-flex items-center justify-center bg-[#16161c] text-[#9ba0ab] border border-[#2e2e38] border-l-0 hover:text-[#eef0f3] transition-colors" />
            }
          >
            <ChevronUp className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="bg-[#111116] border-[#2e2e38] w-[260px] p-3">
            <p className={cn(LABEL, 'mb-2.5')}>Adjust active cue</p>
            <div className="grid grid-cols-5 gap-[3px] mb-1.5">
              {NUDGE_PRESETS.map((ms) => (
                <button
                  key={`m${ms}`}
                  onClick={() => live.nudge(-ms)}
                  className="py-1.5 bg-[#16161c] text-[#ff5a73] border border-[#2e2e38] hover:bg-[rgba(255,40,72,0.12)] font-mono text-[10px] transition-colors"
                >
                  −{formatDuration(ms)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-[3px] mb-2.5">
              {NUDGE_PRESETS.map((ms) => (
                <button
                  key={`p${ms}`}
                  onClick={() => live.nudge(ms)}
                  className="py-1.5 bg-[#16161c] text-[#18d986] border border-[#2e2e38] hover:bg-[rgba(24,217,134,0.12)] font-mono text-[10px] transition-colors"
                >
                  +{formatDuration(ms)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input
                value={customNudge}
                onChange={(e) => setCustomNudge(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustomNudge(1) }}
                placeholder="secs"
                inputMode="numeric"
                className="flex-1 min-w-0 bg-[#16161c] border border-[#2e2e38] px-2 py-1.5 text-xs text-[#eef0f3] font-mono outline-none focus:border-[#3a3a48]"
              />
              <button onClick={() => applyCustomNudge(-1)} className="px-2 py-1.5 bg-[#16161c] text-[#ff5a73] border border-[#2e2e38] hover:bg-[rgba(255,40,72,0.12)] text-xs">−</button>
              <button onClick={() => applyCustomNudge(1)} className="px-2 py-1.5 bg-[#16161c] text-[#18d986] border border-[#2e2e38] hover:bg-[rgba(24,217,134,0.12)] text-xs">+</button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transport buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={live.prev}
          disabled={!live.prevCueId}
          title="Previous cue"
          className="w-[34px] h-[34px] inline-flex items-center justify-center bg-[#16161c] border border-[#2e2e38] disabled:opacity-40"
          style={{ color: live.prevCueId ? '#c8c9d0' : '#3a3a48' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
            <line x1="5" y1="19" x2="5" y2="5" />
          </svg>
        </button>
        <button
          onClick={live.toggle}
          title={live.status === 'running' ? 'Pause' : 'Resume'}
          className="w-11 h-[42px] inline-flex items-center justify-center text-[#06060a]"
          style={{ background: live.status === 'running' ? '#f0a838' : '#18d986' }}
        >
          {live.status === 'running' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#06060a"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#06060a"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          )}
        </button>
        <button
          onClick={live.next}
          title={isLastCue ? 'End show' : 'Next cue'}
          className="h-[42px] px-4 inline-flex items-center gap-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ background: isLastCue ? '#ff2848' : '#f0a838', color: isLastCue ? '#fff' : '#06060a' }}
        >
          {isLastCue ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" /></svg>
              End
            </>
          ) : (
            <>
              Next
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4" /><rect x="17" y="4" width="2" height="16" /></svg>
            </>
          )}
        </button>
      </div>

      {/* Clock + over/under */}
      <div className="hidden lg:flex items-center gap-[18px] shrink-0 pl-3.5 border-l border-[#22222a]">
        <div className="text-right">
          <p className={cn(LABEL, 'leading-none')}>Time of day</p>
          <p className="font-mono text-[13px] tabular-nums text-[#c8c9d0]">
            {clock.toLocaleTimeString('en-US', { hour12: true })}
          </p>
        </div>
        <div className="text-right">
          <p className={cn(LABEL, 'leading-none')}>Over / Under</p>
          <p
            data-testid="transport-overunder"
            className="font-mono text-[13px] tabular-nums"
            style={{ color: onTime ? '#9ba0ab' : overUnder > 0 ? '#ff5a73' : '#18d986' }}
          >
            {onTime ? 'on time' : `${formatSigned(overUnder)} ${overUnder > 0 ? 'late' : 'early'}`}
          </p>
        </div>
      </div>
    </div>
  )
}
