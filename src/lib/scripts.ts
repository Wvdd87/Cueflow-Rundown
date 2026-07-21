import { stripHtml } from './utils'
import type { ScriptBlock } from './supabase/types'

export type { ScriptBlock }

const WORDS_PER_MINUTE = 150

/** Word count of a rich-text (HTML) script block. */
export function wordCount(html: string): number {
  const text = stripHtml(html)
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

/** Combined word count across all script blocks on a cue. */
export function scriptsWordCount(scripts: ScriptBlock[]): number {
  return scripts.reduce((sum, s) => sum + wordCount(s.content), 0)
}

/** Duration for a word count at the standard 150wpm speaking pace, rounded to the nearest second. */
export function autoDurationMs(words: number): number {
  return Math.round((words / WORDS_PER_MINUTE) * 60) * 1000
}

export function newScriptBlock(): ScriptBlock {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `script-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    content: '',
    collapsed: false,
  }
}

/**
 * Two-line collapsed preview: first ~15 words on one line, last ~15 words on
 * the next (each prefixed/suffixed with an ellipsis) — lets you scan both the
 * top and the tail of a script without expanding it. `last` is null when the
 * script is short enough that the first line already covers it in full.
 */
export function scriptCollapsedPreview(html: string, chunk = 15): { first: string; last: string | null } {
  const text = stripHtml(html)
  if (!text) return { first: '', last: null }
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= chunk) return { first: words.join(' '), last: null }
  return {
    first: words.slice(0, chunk).join(' ') + '…',
    last: '…' + words.slice(-chunk).join(' '),
  }
}
