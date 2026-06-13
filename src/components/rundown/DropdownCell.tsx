'use client'

import { ChevronDown, Check, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { upsertCell } from '@/app/actions/cues'
import { cn } from '@/lib/utils'

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
  const valueColor = value ? optionColors?.[value] : null
  async function select(v: string) {
    if (v === value) return
    onContentChange(cueId, columnId, v)
    await upsertCell(cueId, columnId, v, rundownId)
  }

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
        {value ? (
          <span
            className="text-xs px-1.5 py-0.5 rounded text-zinc-100 truncate font-medium"
            style={{ backgroundColor: valueColor ?? 'rgba(63,63,70,0.7)' }}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-zinc-700 italic">—</span>
        )}
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
            onClick={() => select(opt)}
            className={cn(
              'gap-2 text-xs focus:bg-zinc-800 cursor-pointer justify-between',
              opt === value && 'text-white'
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-600"
                style={{ backgroundColor: optionColors?.[opt] ?? 'transparent' }}
              />
              <span className="truncate">{opt}</span>
            </span>
            {opt === value && <Check className="w-3 h-3 shrink-0" />}
          </DropdownMenuItem>
        ))}
        {value && (
          <>
            <DropdownMenuSeparator className="bg-zinc-800" />
            <DropdownMenuItem
              onClick={() => select('')}
              className="gap-2 text-xs text-zinc-400 focus:bg-zinc-800 cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
