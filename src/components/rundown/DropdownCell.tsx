'use client'

import { Plus, ChevronDown, Check, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { upsertCell } from '@/app/actions/cues'
import { cn } from '@/lib/utils'

function parseValues(raw: string): string[] {
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

function serializeValues(values: string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  return JSON.stringify(values)
}

interface DropdownCellProps {
  cueId: string
  columnId: string
  rundownId: string
  options: string[]
  optionColors: Record<string, string> | null
  value: string
  onContentChange: (cueId: string, columnId: string, content: string) => void
}

export function DropdownCell({
  cueId,
  columnId,
  rundownId,
  options,
  optionColors,
  value,
  onContentChange,
}: DropdownCellProps) {
  const values = parseValues(value)
  const remaining = options.filter((o) => !values.includes(o))

  async function addValue(v: string) {
    const next = serializeValues([...values, v])
    onContentChange(cueId, columnId, next)
    await upsertCell(cueId, columnId, next, rundownId)
  }

  async function removeValue(v: string) {
    const next = serializeValues(values.filter((x) => x !== v))
    onContentChange(cueId, columnId, next)
    await upsertCell(cueId, columnId, next, rundownId)
  }

  // Empty state: keep the original single-select UX
  if (values.length === 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              data-testid="dropdown-cell"
              className="group/dd w-full flex items-center justify-between gap-1 px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors"
            />
          }
        >
          <span className="text-sm text-zinc-700 italic">—</span>
          <ChevronDown className="w-3 h-3 text-zinc-600 group-hover/dd:text-zinc-400 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="bg-zinc-900 border-zinc-700 text-zinc-200 min-w-[140px] max-h-64 overflow-y-auto"
        >
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-zinc-500 italic">
              No options — edit the column
            </div>
          )}
          {options.map((opt) => (
            <DropdownMenuItem
              key={opt}
              onClick={() => addValue(opt)}
              className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-600"
                style={{ backgroundColor: optionColors?.[opt] ?? 'transparent' }}
              />
              <span className="truncate">{opt}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Has values: stacked badges + remove × + add + on hover
  return (
    <div
      data-testid="dropdown-cell"
      className="group/ddc w-full flex flex-col gap-0.5 px-2 py-1"
    >
      {values.map((v) => (
        <div key={v} className="flex items-center gap-1 group/badge">
          <span
            data-testid="dropdown-badge"
            className="text-xs px-1.5 py-0.5 rounded text-zinc-100 font-medium truncate max-w-full"
            style={{ backgroundColor: optionColors?.[v] ?? 'rgba(63,63,70,0.7)' }}
          >
            {v}
          </span>
          <button
            onClick={() => removeValue(v)}
            title={`Remove ${v}`}
            className="opacity-0 group-hover/badge:opacity-100 shrink-0 text-zinc-500 hover:text-zinc-200 transition-opacity"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}

      {remaining.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                data-testid="dropdown-add"
                title="Add selection"
                className="opacity-0 group-hover/ddc:opacity-100 flex items-center gap-0.5 text-zinc-600 hover:text-zinc-300 transition-opacity"
              />
            }
          >
            <Plus className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-zinc-900 border-zinc-700 text-zinc-200 min-w-[140px] max-h-64 overflow-y-auto"
          >
            {remaining.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onClick={() => addValue(opt)}
                className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-600"
                  style={{ backgroundColor: optionColors?.[opt] ?? 'transparent' }}
                />
                <span className="truncate">{opt}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
