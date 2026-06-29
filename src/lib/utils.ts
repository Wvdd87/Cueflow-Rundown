import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip HTML tags and decode common entities — for search, export, undo labels. */
export function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** For inline display: strip outer <p>…</p> wrapper so text renders inline. */
export function inlineHtml(html: string): string {
  if (!html) return ''
  return html.replace(/^<p>([\s\S]*)<\/p>$/, '$1').trim()
}
