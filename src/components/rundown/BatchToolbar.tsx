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
  Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CUE_COLORS } from './layout'
import { cn } from '@/lib/utils'

interface BatchToolbarProps {
  count: number
  canUngroup: boolean
  onSelectAll: () => void
  onDuplicate: () => void
  duplicating?: boolean
  onGroup: () => void
  onUngroup: () => void
  onMove: (target: 'top' | 'bottom' | number) => void
  onBackground: (color: string | null) => void
  onDelete: () => void
  onClear: () => void
}

const ITEM =
  'inline-flex items-center gap-1.5 h-7 px-2.5 font-cond text-[10px] font-bold uppercase tracking-[0.1em] bg-transparent border border-transparent text-[#c8c9d0] hover:bg-[#1d1d24] hover:border-[#3a3a48] transition-colors cursor-pointer'

export function BatchToolbar({
  count,
  canUngroup,
  onSelectAll,
  onDuplicate,
  duplicating,
  onGroup,
  onUngroup,
  onMove,
  onBackground,
  onDelete,
  onClear,
}: BatchToolbarProps) {
  const [movePos, setMovePos] = useState('')
  const [bgOpen, setBgOpen] = useState(false)

  return (
    <div
      data-testid="batch-toolbar"
      className="shrink-0 flex items-center gap-0.5 h-10 px-3.5 bg-[#16161c] border-b border-[#2e2e38]"
    >
      <span className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0a838] mr-3 tabular-nums">
        {count} selected
      </span>

      <button data-testid="batch-select-all" onClick={onSelectAll} className={ITEM}>
        <CheckSquare className="w-[11px] h-[11px]" /> Select all
      </button>
      <button data-testid="batch-clear" onClick={onClear} className={ITEM}>
        <X className="w-[11px] h-[11px]" /> Unselect all
      </button>
      <button
        data-testid="batch-duplicate"
        onClick={onDuplicate}
        disabled={duplicating}
        className={cn(ITEM, duplicating && 'opacity-60 pointer-events-none')}
      >
        {duplicating ? <Loader2 className="w-[11px] h-[11px] animate-spin" /> : <Copy className="w-[11px] h-[11px]" />}
        {duplicating ? 'Duplicating…' : 'Duplicate'}
      </button>
      <button data-testid="batch-group" onClick={onGroup} className={ITEM}>
        <Group className="w-[11px] h-[11px]" /> Group
      </button>
      <button
        data-testid="batch-ungroup"
        onClick={canUngroup ? onUngroup : undefined}
        className={cn(ITEM, !canUngroup && 'opacity-40 pointer-events-none')}
      >
        <Ungroup className="w-[11px] h-[11px]" /> Ungroup
      </button>

      {/* Move */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className={ITEM} />}>
          <ArrowUpDown className="w-[11px] h-[11px]" /> Move
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-44 p-0">
          <DropdownMenuItem
            onClick={() => onMove('top')}
            className="px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.08em] focus:bg-[#16161c] cursor-pointer"
          >
            Move to top
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onMove('bottom')}
            className="px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.08em] focus:bg-[#16161c] cursor-pointer"
          >
            Move to bottom
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#1d1d24]" />
          <div className="p-2">
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
              className="w-full bg-[#16161c] border border-[#2e2e38] px-2 py-1.5 text-xs text-[#eef0f3] font-mono outline-none focus:border-[#3a3a48]"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Background */}
      <DropdownMenu open={bgOpen} onOpenChange={setBgOpen}>
        <DropdownMenuTrigger render={<button data-testid="batch-bg" className={ITEM} />}>
          <PaintBucket className="w-[11px] h-[11px]" /> Background
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#111116] border-[#2e2e38] p-2.5">
          <div className="grid grid-cols-5 gap-1.5">
            {CUE_COLORS.map((color, i) => (
              <button
                key={i}
                data-testid={`batch-bg-${i}`}
                onClick={() => { onBackground(color); setBgOpen(false) }}
                className="w-6 h-6 flex items-center justify-center transition-colors"
                style={{ background: color ?? 'transparent', border: '1px solid #3a3a48' }}
              >
                {color === null && <X className="w-3 h-3 text-[#888b96]" />}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        data-testid="batch-delete"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 font-cond text-[10px] font-bold uppercase tracking-[0.1em] bg-transparent border border-transparent text-[#ff4663] hover:bg-[rgba(255,40,72,0.1)] hover:border-[rgba(255,40,72,0.3)] transition-colors cursor-pointer"
      >
        <Trash2 className="w-[11px] h-[11px]" /> Delete
      </button>

    </div>
  )
}
