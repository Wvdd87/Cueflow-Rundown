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

// ── Rich-text parsing for exports ──
// TipTap stores cue titles/subtitles/cells as HTML. For the PDF export we
// parse that HTML into styled line/segment structures so formatting (bold,
// italic, lists, colours…) survives instead of being flattened to plain text.

export interface RichSegment {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  link?: string
  color?: string
  highlight?: string
  /** Inline heading level 1–3 from the editor's HeadingSize mark (span[data-hs]). */
  hsize?: number
}

export interface RichLine {
  segments: RichSegment[]
  /** List marker rendered before the line ("•", "1.", …). */
  marker?: string
  /** Nesting depth for nested lists (0 = top level). */
  indent: number
  /** Heading level 1–3 when the line came from <h1>–<h3>. */
  heading?: number
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Parse well-formed TipTap HTML into styled lines. Tag-soup safe enough for
 *  editor output; unknown tags are ignored and only their text is kept. */
export function parseRichHtml(html: string | null | undefined): RichLine[] {
  if (!html) return []
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? []
  const lines: RichLine[] = []
  let current: RichLine | null = null
  const style = { bold: 0, italic: 0, underline: 0, strike: 0 }
  const links: string[] = []
  const colors: string[] = []
  const highlights: string[] = []
  const hsizes: (number | undefined)[] = []
  const listStack: { type: 'ul' | 'ol'; count: number }[] = []
  let pendingMarker: string | undefined
  let headingLevel = 0

  const ensureLine = () => {
    if (!current) {
      current = {
        segments: [],
        marker: pendingMarker,
        indent: Math.max(0, listStack.length - 1),
        heading: headingLevel || undefined,
      }
      pendingMarker = undefined
      lines.push(current)
    }
  }
  const endLine = () => {
    current = null
  }

  for (const tok of tokens) {
    if (tok[0] === '<') {
      const isClose = tok[1] === '/'
      const name = tok.replace(/^<\/?\s*([a-zA-Z0-9]+)[\s\S]*$/, '$1').toLowerCase()
      switch (name) {
        case 'p':
        case 'div':
        case 'br':
          endLine()
          break
        case 'h1':
        case 'h2':
        case 'h3':
          endLine()
          headingLevel = isClose ? 0 : Number(name[1])
          break
        case 'ul':
        case 'ol':
          if (isClose) listStack.pop()
          else listStack.push({ type: name, count: 0 })
          endLine()
          break
        case 'li':
          endLine()
          if (!isClose) {
            const top = listStack[listStack.length - 1]
            if (top?.type === 'ol') {
              top.count++
              pendingMarker = `${top.count}.`
            } else {
              pendingMarker = '•'
            }
          }
          break
        case 'strong':
        case 'b':
          style.bold += isClose ? -1 : 1
          break
        case 'em':
        case 'i':
          style.italic += isClose ? -1 : 1
          break
        case 'u':
          style.underline += isClose ? -1 : 1
          break
        case 's':
        case 'strike':
        case 'del':
          style.strike += isClose ? -1 : 1
          break
        case 'a':
          if (isClose) links.pop()
          else links.push(tok.match(/href="([^"]*)"/i)?.[1] ?? '')
          break
        case 'mark':
          if (isClose) highlights.pop()
          else highlights.push(tok.match(/background-color:\s*([^;"']+)/i)?.[1]?.trim() ?? '#fde047')
          break
        case 'span':
          if (isClose) {
            colors.pop()
            hsizes.pop()
          } else {
            colors.push(tok.match(/(?:^|[;"\s])color:\s*([^;"']+)/i)?.[1]?.trim() ?? '')
            const hs = tok.match(/data-hs="([1-3])"/i)
            hsizes.push(hs ? Number(hs[1]) : undefined)
          }
          break
      }
    } else {
      const text = decodeEntities(tok)
      if (!text || (!text.trim() && !current)) continue
      ensureLine()
      current!.segments.push({
        text,
        bold: style.bold > 0 || undefined,
        italic: style.italic > 0 || undefined,
        underline: style.underline > 0 || undefined,
        strike: style.strike > 0 || undefined,
        link: links[links.length - 1] || undefined,
        color: colors.filter(Boolean).pop() || undefined,
        highlight: highlights[highlights.length - 1] || undefined,
        hsize: [...hsizes].reverse().find((v) => v !== undefined),
      })
    }
  }

  return lines.filter((l) => l.segments.some((s) => s.text.trim() !== ''))
}

/** Rich-line version of cellToPlainText: dropdowns become one plain line,
 *  rich-text cells keep their formatting with variables/mentions resolved. */
export function cellToRichLines(
  raw: string | null | undefined,
  variableMap: Record<string, string>,
  colType: string,
  mentionNameById: Record<string, string> = {},
): RichLine[] {
  if (!raw) return []
  if (colType === 'dropdown') {
    const v = parseDropdownValues(raw).join(', ')
    return v ? [{ segments: [{ text: v }], indent: 0 }] : []
  }
  return parseRichHtml(resolveMentionsHtml(resolveVariablesHtml(raw, variableMap), mentionNameById))
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
