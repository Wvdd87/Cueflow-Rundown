'use client'

import { Plus, ChevronDown, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { upsertCell } from '@/app/actions/cues'

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

const OPTION_ITEM =
  'grid grid-cols-[auto_1fr] gap-2.5 items-center px-3 py-2.5 text-[12.5px] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

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

  function optionList(list: string[]) {
    return (
      <DropdownMenuContent
        align="start"
        className="bg-[#111116] border-[#3a3a48] text-[#c8c9d0] min-w-[170px] max-h-60 overflow-y-auto p-0"
      >
        {list.length === 0 ? (
          <div className="px-3 py-2.5 text-[12px] text-[#5a5c66] italic">No options — edit the column</div>
        ) : (
          list.map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => addValue(opt)} className={OPTION_ITEM}>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#3a3a48]"
                style={{ backgroundColor: optionColors?.[opt] ?? 'transparent' }}
              />
              <span className="truncate">{opt}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    )
  }

  // Empty state
  if (values.length === 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              data-testid="dropdown-cell"
              className="group/dd w-full flex items-center justify-between gap-1 px-1.5 py-1 hover:bg-[#1d1d24]/50 transition-colors"
            />
          }
        >
          <span className="text-[13px] text-[#5a5c66] italic">—</span>
          <ChevronDown className="w-3 h-3 text-[#5a5c66] shrink-0" />
        </DropdownMenuTrigger>
        {optionList(options)}
      </DropdownMenu>
    )
  }

  // Has values: stacked full-width colour blocks + borderless "+ Add"
  return (
    <div data-testid="dropdown-cell" className="group/ddc w-full flex flex-col gap-1.5 py-0.5">
      {values.map((v) => (
        <div
          key={v}
          className="flex items-center gap-1 w-full group/badge"
        >
          <span
            data-testid="dropdown-badge"
            className="flex-1 text-[12.5px] px-2.5 py-[5px] text-white font-semibold break-words [overflow-wrap:anywhere]"
            style={{ backgroundColor: optionColors?.[v] ?? 'rgba(63,63,70,0.85)' }}
          >
            {v}
          </span>
          <button
            onClick={() => removeValue(v)}
            title={`Remove ${v}`}
            className="opacity-0 group-hover/badge:opacity-100 shrink-0 text-[#5a5c66] hover:text-[#c8c9d0] transition-opacity"
          >
            <X className="w-[11px] h-[11px]" />
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
                className="self-start inline-flex items-center gap-1.5 mt-px font-cond text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c7e8a] hover:text-[#c8c9d0] transition-colors"
              />
            }
          >
            <Plus className="w-2.5 h-2.5" /> Add
          </DropdownMenuTrigger>
          {optionList(remaining)}
        </DropdownMenu>
      )}
    </div>
  )
}
