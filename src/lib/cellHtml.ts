/** Parse a dropdown cell's stored value into its list of selected options.
 *  Single selections are stored as a plain string; multi-selections as a JSON
 *  array (e.g. `["host 3","host 1"]`). */
export function parseDropdownValues(raw: string | null | undefined): string[] {
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed))
        return parsed.filter((v): v is string => typeof v === 'string' && !!v)
    } catch {}
  }
  return [raw]
}

/** Strip rich-text HTML down to readable plain text. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim()
}

/** Resolve a cell's stored value to plain text for exports.
 *  Dropdown cells become a comma-joined option list; rich-text cells have their
 *  $-variable and @-mention chips resolved to current values before tags are
 *  stripped. */
export function cellToPlainText(
  raw: string | null | undefined,
  variableMap: Record<string, string>,
  colType: string,
  mentionNameById: Record<string, string> = {},
): string {
  if (!raw) return ''
  if (colType === 'dropdown') return parseDropdownValues(raw).join(', ')
  return stripHtml(resolveMentionsHtml(resolveVariablesHtml(raw, variableMap), mentionNameById))
}

/** Replace the visible text of @-mention chips with the mention's current name,
 *  so renaming a mention updates every instance. Unknown ids are left as-is. */
export function resolveMentionsHtml(
  html: string,
  mentionNameById: Record<string, string>
): string {
  return html.replace(
    /<span([^>]*?)data-mention-suggestion-char="@"([^>]*?)>([\s\S]*?)<\/span>/g,
    (full, pre: string, post: string) => {
      const attrs = pre + post
      const idMatch = attrs.match(/data-id="([^"]*)"/)
      const id = idMatch ? idMatch[1] : ''
      const name = mentionNameById[id]
      if (name == null) return full
      const safe = `@${name}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<span${pre}data-mention-suggestion-char="@"${post}>${safe}</span>`
    }
  )
}

/** Replace $-variable chips in stored cell HTML with their current values.
 *  Deterministic + dependency-free, safe on server or client. */
export function resolveVariablesHtml(
  html: string,
  variableMap: Record<string, string>
): string {
  return html.replace(
    /<span([^>]*?)data-mention-suggestion-char="\$"([^>]*?)>([\s\S]*?)<\/span>/g,
    (_full, pre: string, post: string) => {
      const attrs = pre + post
      const idMatch = attrs.match(/data-id="([^"]*)"/)
      const key = idMatch ? idMatch[1] : ''
      const val = variableMap[key]
      const text = val == null || val === '' ? `$${key}` : val
      const safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<span${pre}data-mention-suggestion-char="$"${post}>${safe}</span>`
    }
  )
}
