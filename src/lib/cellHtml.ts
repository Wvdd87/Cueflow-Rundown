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
