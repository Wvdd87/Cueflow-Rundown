export const VARIABLE_KEY_RE = /^[a-z0-9-]+$/

/** Coerce arbitrary input into a valid variable key (lowercase, hyphenated). */
export function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
