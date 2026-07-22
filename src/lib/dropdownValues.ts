/** Shared parse/serialize for dropdown-column cell content — a single value is
 *  stored as the raw string, multiple values as a JSON array (see #2/#55). */

export function parseDropdownCellValues(raw: string): string[] {
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

export function serializeDropdownCellValues(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  return JSON.stringify(values)
}
