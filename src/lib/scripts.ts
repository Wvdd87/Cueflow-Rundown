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

/** First ~15 words of a script block, for the single-line collapsed preview. */
export function scriptPreview(html: string, wordLimit = 15): string {
  const text = stripHtml(html)
  if (!text) return ''
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= wordLimit) return words.join(' ')
  return words.slice(0, wordLimit).join(' ') + '…'
}
