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
 * Accepts: "5:00" (M:SS), "1:05:00" (H:MM:SS), "300" (seconds), "5m" or "30s"
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

  const parts = s.split(':').map(Number)
  if (parts.some(isNaN)) return null

  if (parts.length === 1) return parts[0] * 1000
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  return null
}

/** Cascade-calculate start times for all cues in order */
export function calculateTimings(cues: CueTimingInput[]): CueTimingOutput[] {
  const result: CueTimingOutput[] = []
  let cursor = 0

  for (const cue of cues) {
    if (cue.start_type === 'hard' && cue.start_time_override) {
      const hardMs = parseTimeToMs(cue.start_time_override)
      const gap_ms = hardMs - cursor
      cursor = hardMs + cue.duration_ms
      result.push({ ...cue, calculated_start_ms: hardMs, gap_ms })
    } else {
      result.push({ ...cue, calculated_start_ms: cursor, gap_ms: 0 })
      cursor += cue.duration_ms
    }
  }

  return result
}

export function formatGap(ms: number): string {
  const abs = Math.abs(ms)
  return `${ms < 0 ? '-' : '+'}${formatDuration(abs)}`
}
