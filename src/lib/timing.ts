import type { Cue } from './supabase/types'

export type StartType = 'soft' | 'hard'

export type CueTimingInput = Cue

export interface CueTimingOutput extends Cue {
  calculated_start_ms: number
  gap_ms: number // positive=gap (ok), negative=overlap (problem)
}

/** Parse "HH:MM:SS" to ms from midnight */
export function parseTimeToMs(time: string): number {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number)
  return (h * 3600 + m * 60 + s) * 1000
}

export type TimeDisplay = 'auto' | '24h' | '12h' | '12h_no_ampm'

/** Format ms-from-midnight to "HH:MM:SS" */
export function formatMsToTime(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/**
 * Format ms-from-midnight according to the rundown's time_display setting.
 * '12h' → "1:30:10 PM", '12h_no_ampm' → "1:30:10", everything else → "HH:MM:SS"
 */
export function formatMsToTimeDisplay(ms: number, format: TimeDisplay = 'auto'): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (format === '12h' || format === '12h_no_ampm') {
    const h12 = h % 12 || 12
    const ampm = h < 12 ? 'AM' : 'PM'
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return format === '12h' ? `${h12}:${mm}:${ss} ${ampm}` : `${h12}:${mm}:${ss}`
  }

  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/** Format duration ms to "H:MM:SS" or "M:SS" */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/**
 * Parse user duration input to ms.
 * Accepts:
 *   "5m" / "30s"          — explicit unit suffixes
 *   "M:SS" / "H:MM:SS"    — colon-separated
 *   Pure digits (smart right-aligned HHMMSS):
 *     1–2 digits → seconds          "15"     → 0:00:15
 *     3–4 digits → MM SS            "230"    → 0:02:30, "1530" → 0:15:30
 *     5–6 digits → HH MM SS         "12345"  → 1:23:45, "215630" → 21:56:30
 */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null

  if (s.endsWith('m')) {
    const v = parseFloat(s)
    return isNaN(v) ? null : Math.round(v * 60000)
  }
  if (s.endsWith('s')) {
    const v = parseFloat(s)
    return isNaN(v) ? null : Math.round(v * 1000)
  }

  if (s.includes(':')) {
    const parts = s.split(':').map(Number)
    if (parts.some(isNaN)) return null
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
    return null
  }

  if (/^\d+$/.test(s)) {
    if (s.length <= 2) {
      return parseInt(s, 10) * 1000
    } else if (s.length <= 4) {
      const sec = parseInt(s.slice(-2), 10)
      const min = parseInt(s.slice(0, -2), 10)
      if (sec >= 60) return null
      return (min * 60 + sec) * 1000
    } else {
      const sec = parseInt(s.slice(-2), 10)
      const min = parseInt(s.slice(-4, -2), 10)
      const hr = parseInt(s.slice(0, -4), 10)
      if (sec >= 60 || min >= 60) return null
      return (hr * 3600 + min * 60 + sec) * 1000
    }
  }

  return null
}

/** Cascade-calculate start times for all cues in order */
export function calculateTimings(cues: CueTimingInput[]): CueTimingOutput[] {
  const result: CueTimingOutput[] = []
  let cursor = 0
  // The first real cue is the show anchor — it has no predecessor to measure a
  // gap against, so we suppress its gap (otherwise a hard first cue at e.g.
  // 09:00 would report a bogus "+9:00:00 gap" relative to midnight).
  let anchored = false

  for (const cue of cues) {
    if (cue.start_type === 'hard' && cue.start_time_override) {
      const hardMs = parseTimeToMs(cue.start_time_override)
      const gap_ms = anchored ? hardMs - cursor : 0
      cursor = hardMs + cue.duration_ms
      result.push({ ...cue, calculated_start_ms: hardMs, gap_ms })
    } else {
      result.push({ ...cue, calculated_start_ms: cursor, gap_ms: 0 })
      cursor += cue.duration_ms
    }
    if (cue.cue_type !== 'heading') anchored = true
  }

  return result
}

export function formatGap(ms: number): string {
  const abs = Math.abs(ms)
  return `${ms < 0 ? '-' : '+'}${formatDuration(abs)}`
}
