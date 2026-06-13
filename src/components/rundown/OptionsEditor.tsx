'use client'

import { X, Plus, GripVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface OptionRow {
  value: string
  color: string | null
}

export const PILL_COLORS: { label: string; value: string | null }[] = [
  { label: 'None', value: null },
  { label: 'Red', value: '#7f1d1d' },
  { label: 'Amber', value: '#78350f' },
  { label: 'Green', value: '#14532d' },
  { label: 'Blue', value: '#1e3a5f' },
  { label: 'Purple', value: '#4a1d96' },
  { label: 'Pink', value: '#831843' },
  { label: 'Slate', value: '#334155' },
]

/** Convert UI rows ↔ persisted (options[], option_colors map). */
export function rowsToOptions(rows: OptionRow[]): {
  options: string[]
  optionColors: Record<string, string> | null
} {
  const options: string[] = []
  const colors: Record<string, string> = {}
  const seen = new Set<string>()
  for (const r of rows) {
    const v = r.value.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    options.push(v)
    if (r.color) colors[v] = r.color
  }
  return {
    options,
    optionColors: Object.keys(colors).length ? colors : null,
  }
}

export function optionsToRows(
  options: string[] | null,
  colors: Record<string, string> | null
): OptionRow[] {
  return (options ?? []).map((v) => ({ value: v, color: colors?.[v] ?? null }))
}

interface OptionsEditorProps {
  rows: OptionRow[]
  onChange: (rows: OptionRow[]) => void
}

export function OptionsEditor({ rows, onChange }: OptionsEditorProps) {
  function update(i: number, patch: Partial<OptionRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...rows, { value: '', color: null }])
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-zinc-700 shrink-0" />

          {/* Colour swatch */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  data-testid={`opt-color-${i}`}
                  title="Option colour"
                  className="w-6 h-6 shrink-0 rounded border border-zinc-600"
                  style={{ backgroundColor: row.color ?? 'transparent' }}
                />
              }
            >
              {!row.color && <X className="w-3 h-3 text-zinc-600 mx-auto" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-700 p-2">
              <div className="grid grid-cols-4 gap-1.5">
                {PILL_COLORS.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => update(i, { color: c.value })}
                    title={c.label}
                    className={cn(
                      'w-6 h-6 rounded border transition-all flex items-center justify-center',
                      row.color === c.value
                        ? 'border-white scale-110'
                        : 'border-zinc-700 hover:border-zinc-500'
                    )}
                    style={{ backgroundColor: c.value ?? 'transparent' }}
                  >
                    {c.value === null && <X className="w-3 h-3 text-zinc-500" />}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            data-testid={`opt-value-${i}`}
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={`Option ${i + 1}`}
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-600"
          />

          <button
            onClick={() => remove(i)}
            className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
            title="Remove option"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        data-testid="add-option-row"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add option
      </button>
    </div>
  )
}
