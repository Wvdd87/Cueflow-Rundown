'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { parseTimeToMs } from '@/lib/timing'

export type LiveStatus = 'idle' | 'running' | 'paused'

export interface LiveCue {
  id: string
  duration_ms: number
  auto_start: boolean
  start_type: 'soft' | 'hard'
  start_time_override: string | null
}

/** Current local time-of-day in ms from midnight (matches stored hard times). */
function timeOfDayMs(): number {
  const d = new Date()
  return (
    ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 +
    d.getMilliseconds()
  )
}

export interface LiveShow {
  status: LiveStatus
  isLive: boolean
  activeCueId: string | null
  nextCueId: string | null
  prevCueId: string | null
  /** ms elapsed within the active cue */
  elapsedMs: number
  /** active cue duration + nudge (effective target) */
  activeDurationMs: number
  /** activeDurationMs - elapsedMs (negative when over) */
  remainingMs: number
  isOvertime: boolean
  /** running schedule delta: positive = behind/late, negative = ahead/early */
  overUnderMs: number
  /** manual time added/removed from the active cue this run */
  nudgeMs: number
  start: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  end: () => void
  jumpTo: (cueId: string) => void
  nudge: (ms: number) => void
}

/**
 * Live-show transport state machine.
 *
 * Timing is wall-clock based: we record `performance.now()` when a running
 * segment begins and accumulate elapsed time across pause/resume cycles, so the
 * countdown stays accurate even if the tick interval drifts or the tab throttles.
 */
export function useLiveShow(cues: LiveCue[]): LiveShow {
  const [status, setStatus] = useState<LiveStatus>('idle')
  const [activeCueId, setActiveCueId] = useState<string | null>(null)
  const [nudgeMs, setNudgeMs] = useState(0)
  // forces a re-render on each tick while running so derived times refresh
  const [, setTick] = useState(0)

  const segmentStartRef = useRef(0) // performance.now() when current running segment began
  const accumulatedRef = useRef(0) // ms accrued in active cue before current segment
  const driftRef = useRef(0) // accumulated schedule drift from completed cues
  const statusRef = useRef<LiveStatus>(status)
  statusRef.current = status
  const cuesRef = useRef(cues)
  cuesRef.current = cues
  const activeIdRef = useRef<string | null>(activeCueId)
  activeIdRef.current = activeCueId
  const nudgeRef = useRef(0)
  nudgeRef.current = nudgeMs
  const nextRef = useRef<() => void>(() => {})
  const jumpRef = useRef<(id: string) => void>(() => {})

  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => {
      const idx = activeIdRef.current
        ? cuesRef.current.findIndex((c) => c.id === activeIdRef.current)
        : -1

      // Hard-start auto-fire: jump to an upcoming hard-start cue once the
      // wall-clock time of day reaches its fixed start time.
      if (idx >= 0) {
        const nowMs = timeOfDayMs()
        for (let i = idx + 1; i < cuesRef.current.length; i++) {
          const c = cuesRef.current[i]
          if (c.start_type === 'hard' && c.start_time_override) {
            if (nowMs >= parseTimeToMs(c.start_time_override)) {
              jumpRef.current(c.id)
              return
            }
          }
        }
      }

      // Auto-advance: if the active cue's duration has elapsed and the next
      // cue is flagged auto-start, advance to it automatically.
      const active = idx >= 0 ? cuesRef.current[idx] : null
      const upcoming = idx >= 0 ? cuesRef.current[idx + 1] : null
      if (active && upcoming?.auto_start) {
        const elapsed =
          accumulatedRef.current +
          (statusRef.current === 'running'
            ? performance.now() - segmentStartRef.current
            : 0)
        if (elapsed >= active.duration_ms + nudgeRef.current) {
          nextRef.current()
          return
        }
      }
      setTick((t) => t + 1)
    }, 200)
    return () => clearInterval(id)
  }, [status])

  const activeIndex = activeCueId
    ? cues.findIndex((c) => c.id === activeCueId)
    : -1
  const activeCue = activeIndex >= 0 ? cues[activeIndex] : null
  const nextCue =
    activeIndex >= 0 && activeIndex < cues.length - 1
      ? cues[activeIndex + 1]
      : null
  const prevCue = activeIndex > 0 ? cues[activeIndex - 1] : null

  // Derived timing — recomputed every render (ticks while running)
  const segElapsed =
    status === 'running' && activeCue
      ? performance.now() - segmentStartRef.current
      : 0
  const elapsedMs = activeCue ? accumulatedRef.current + segElapsed : 0
  const activeDurationMs = activeCue ? activeCue.duration_ms + nudgeMs : 0
  const remainingMs = activeDurationMs - elapsedMs
  const isOvertime = !!activeCue && remainingMs < 0
  // schedule drift so far + overrun on the current cue
  const overUnderMs =
    driftRef.current +
    (activeCue ? Math.max(0, elapsedMs - activeCue.duration_ms) : 0)

  /** Elapsed in the active cue right now (ref-based, safe inside callbacks). */
  const elapsedNow = useCallback(() => {
    const seg =
      statusRef.current === 'running'
        ? performance.now() - segmentStartRef.current
        : 0
    return accumulatedRef.current + seg
  }, [])

  /** Bank the leaving cue's actual-vs-planned delta into the running drift. */
  const accrueDrift = useCallback(
    (leavingId: string | null) => {
      if (!leavingId) return
      const c = cuesRef.current.find((x) => x.id === leavingId)
      if (c) driftRef.current += elapsedNow() - c.duration_ms
    },
    [elapsedNow]
  )

  /** Make a cue active and reset its timing. Preserves run/pause status. */
  const goToCue = useCallback((cueId: string) => {
    accumulatedRef.current = 0
    segmentStartRef.current = performance.now()
    setNudgeMs(0)
    setActiveCueId(cueId)
  }, [])

  const start = useCallback(() => {
    const first = cues[0]
    if (!first) return
    accumulatedRef.current = 0
    segmentStartRef.current = performance.now()
    driftRef.current = 0
    setNudgeMs(0)
    setActiveCueId(first.id)
    setStatus('running')
  }, [cues])

  const pause = useCallback(() => {
    setStatus((prev) => {
      if (prev !== 'running') return prev
      accumulatedRef.current += performance.now() - segmentStartRef.current
      return 'paused'
    })
  }, [])

  const resume = useCallback(() => {
    setStatus((prev) => {
      if (prev !== 'paused') return prev
      segmentStartRef.current = performance.now()
      return 'running'
    })
  }, [])

  const end = useCallback(() => {
    accumulatedRef.current = 0
    driftRef.current = 0
    setNudgeMs(0)
    setActiveCueId(null)
    setStatus('idle')
  }, [])

  const next = useCallback(() => {
    const idx = activeIdRef.current
      ? cuesRef.current.findIndex((c) => c.id === activeIdRef.current)
      : -1
    const upcoming =
      idx >= 0 && idx < cuesRef.current.length - 1 ? cuesRef.current[idx + 1] : null
    accrueDrift(activeIdRef.current)
    if (!upcoming) {
      end()
      return
    }
    goToCue(upcoming.id)
  }, [accrueDrift, end, goToCue])
  nextRef.current = next

  const prev = useCallback(() => {
    const idx = activeIdRef.current
      ? cuesRef.current.findIndex((c) => c.id === activeIdRef.current)
      : -1
    const earlier = idx > 0 ? cuesRef.current[idx - 1] : null
    if (!earlier) return
    accrueDrift(activeIdRef.current)
    goToCue(earlier.id)
  }, [accrueDrift, goToCue])

  const toggle = useCallback(() => {
    if (status === 'idle') start()
    else if (status === 'running') pause()
    else resume()
  }, [status, start, pause, resume])

  const jumpTo = useCallback(
    (cueId: string) => {
      if (statusRef.current === 'idle') return
      accrueDrift(activeIdRef.current)
      goToCue(cueId)
    },
    [accrueDrift, goToCue]
  )
  jumpRef.current = jumpTo

  const nudge = useCallback((ms: number) => {
    setNudgeMs((n) => n + ms)
  }, [])

  return {
    status,
    isLive: status !== 'idle',
    activeCueId,
    nextCueId: nextCue?.id ?? null,
    prevCueId: prevCue?.id ?? null,
    elapsedMs,
    activeDurationMs,
    remainingMs,
    isOvertime,
    overUnderMs,
    nudgeMs,
    start,
    pause,
    resume,
    toggle,
    next,
    prev,
    end,
    jumpTo,
    nudge,
  }
}
