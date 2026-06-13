'use client'

import { useState } from 'react'
import {
  CheckSquare,
  Copy,
  Group,
  Ungroup,
  ArrowUpDown,
  PaintBucket,
  Trash2,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const BG_COLORS: (string | null)[] = [
  null,
  '#1e293b', '#7f1d1d', '#78350f', '#14532d',
  '#1e3a5f', '#4a1d96', '#831843', '#064e3b',
]

interface BatchToolbarProps {
  count: number
  canUngroup: boolean
  onSelectAll: () => void
  onDuplicate: () => void
  onGroup: () => void
  onUngroup: () => void
  onMove: (target: 'top' | 'bottom' | number) => void
  onBackground: (color: string | null) => void
  onDelete: () => void
  onClear: () => void
}

export function BatchToolbar({
  count,
  canUngroup,
  onSelectAll,
  onDuplicate,
  onGroup,
  onUngroup,
  onMove,
  onBackground,
  onDelete,
  onClear,
}: BatchToolbarProps) {
  const [movePos, setMovePos] = useState('')
  const [bgOpen, setBgOpen] = useState(false)

  const item =
    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-zinc-200 hover:bg-zinc-700 transition-colors'
  const disabled = 'opacity-40 pointer-events-none'

  return (
    <div
      data-testid="batch-toolbar"
      className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-zinc-800 border-b border-zinc-700"
    >
      <span className="text-xs font-medium text-zinc-400 mr-1 tabular-nums">
        {count} selected
      </span>

      <button data-testid="batch-select-all" onClick={onSelectAll} className={item}>
        <CheckSquare className="w-4 h-4" /> Select all
      </button>

      <button data-testid="batch-duplicate" onClick={onDuplicate} className={item}>
        <Copy className="w-4 h-4" /> Duplicate
      </button>

      <button data-testid="batch-group" onClick={onGroup} className={item}>
        <Group className="w-4 h-4" /> Group
      </button>

      <button
        data-testid="batch-ungroup"
        onClick={onUngroup}
        className={cn(item, !canUngroup && disabled)}
      >
        <Ungroup className="w-4 h-4" /> Ungroup
      </button>

      {/* Move */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className={item} />}>
          <ArrowUpDown className="w-4 h-4" /> Move
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700 text-zinc-200 w-44">
          <DropdownMenuItem
            onClick={() => onMove('top')}
            className="text-xs focus:bg-zinc-800 cursor-pointer"
          >
            Move to top
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onMove('bottom')}
            className="text-xs focus:bg-zinc-800 cursor-pointer"
          >
            Move to bottom
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <div className="flex items-center gap-1 px-2 py-1.5">
            <input
              value={movePos}
              onChange={(e) => setMovePos(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = parseInt(movePos, 10)
                  if (!isNaN(n)) onMove(n - 1)
                  setMovePos('')
                }
              }}
              placeholder="position #"
              inputMode="numeric"
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Background */}
      <DropdownMenu open={bgOpen} onOpenChange={setBgOpen}>
        <DropdownMenuTrigger render={<button data-testid="batch-bg" className={item} />}>
          <PaintBucket className="w-4 h-4" /> Background
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-700 p-2">
          <div className="grid grid-cols-5 gap-1.5">
            {BG_COLORS.map((color, i) => (
              <button
                key={i}
                data-testid={`batch-bg-${i}`}
                onClick={() => { onBackground(color); setBgOpen(false) }}
                className="w-6 h-6 rounded border border-zinc-700 hover:border-zinc-400 transition-colors flex items-center justify-center"
                style={{ backgroundColor: color ?? 'transparent' }}
              >
                {color === null && <X className="w-3 h-3 text-zinc-500" />}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        data-testid="batch-delete"
        onClick={onDelete}
        className={cn(item, 'text-red-400 hover:bg-red-950/50')}
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>

      <button
        data-testid="batch-clear"
        onClick={onClear}
        className={cn(item, 'ml-auto text-zinc-400')}
      >
        <X className="w-4 h-4" /> Clear selection
      </button>
    </div>
  )
}
