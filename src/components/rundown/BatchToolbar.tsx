'use client'

import { useState } from 'react'
import {
  CheckSquare,
  Copy,
  Group,
  Ungroup,
  ArrowUpDown,
  PaintBucket,
  PencilLine,
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
import { parseDurationInput } from '@/lib/timing'
import { cn } from '@/lib/utils'
import type { Column } from '@/lib/supabase/types'

interface BatchToolbarProps {
  count: number
  canUngroup: boolean
  columns: Column[]
  onSelectAll: () => void
  onDuplicate: () => void
  duplicating?: boolean
  onGroup: () => void
  onUngroup: () => void
  onMove: (target: 'top' | 'bottom' | number) => void
  onBackground: (color: string | null) => void
  /** Common value of a column across the selected leaf cues, or null when mixed. */
  commonCellValue: (colId: string) => string | null
  onBulkSetCell: (colId: string, value: string) => void
  onBulkSetDuration: (ms: number) => void
  onBulkSetNotFinal: (value: boolean) => void
  onDelete: () => void
  onClear: () => void
}

const ITEM =
  'inline-flex items-center gap-1.5 h-7 px-2.5 font-cond text-[10px] font-bold uppercase tracking-[0.1em] bg-transparent border border-transparent text-[#c8c9d0] hover:bg-[#1d1d24] hover:border-[#3a3a48] transition-colors cursor-pointer'

export function BatchToolbar({
  count,
  canUngroup,
  columns,
  onSelectAll,
  onDuplicate,
  duplicating,
  onGroup,
  onUngroup,
  onMove,
  onBackground,
  commonCellValue,
  onBulkSetCell,
  onBulkSetDuration,
  onBulkSetNotFinal,
  onDelete,
  onClear,
}: BatchToolbarProps) {
  const [movePos, setMovePos] = useState('')
  const [bgOpen, setBgOpen] = useState(false)
  const [fieldOpen, setFieldOpen] = useState(false)

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

      {/* Set field (bulk edit) */}
      <DropdownMenu open={fieldOpen} onOpenChange={setFieldOpen}>
        <DropdownMenuTrigger render={<button data-testid="batch-set-field" className={ITEM} />}>
          <PencilLine className="w-[11px] h-[11px]" /> Set field
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#111116] border-[#2e2e38] p-3 w-64">
          <BulkFieldForm
            columns={columns}
            commonCellValue={commonCellValue}
            onSetCell={(colId, v) => { onBulkSetCell(colId, v); setFieldOpen(false) }}
            onSetDuration={(ms) => { onBulkSetDuration(ms); setFieldOpen(false) }}
            onSetNotFinal={(b) => { onBulkSetNotFinal(b); setFieldOpen(false) }}
          />
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

const F_LABEL = 'font-cond text-[9px] font-bold uppercase tracking-[0.12em] text-[#7c7e8a] mb-1'
const F_INPUT = 'w-full bg-[#16161c] border border-[#2e2e38] px-2 py-1.5 text-xs text-[#eef0f3] outline-none focus:border-[#3a3a48]'
const F_APPLY = 'w-full mt-2 inline-flex items-center justify-center h-7 font-cond text-[10px] font-bold uppercase tracking-[0.1em] bg-[#f0a838] text-[#06060a] hover:bg-[#ffba50] transition-colors cursor-pointer disabled:opacity-50'

function BulkFieldForm({
  columns,
  commonCellValue,
  onSetCell,
  onSetDuration,
  onSetNotFinal,
}: {
  columns: Column[]
  commonCellValue: (colId: string) => string | null
  onSetCell: (colId: string, value: string) => void
  onSetDuration: (ms: number) => void
  onSetNotFinal: (value: boolean) => void
}) {
  const editable = columns.filter((c) => c.col_type === 'richtext' || c.col_type === 'dropdown')
  const [field, setField] = useState<string>(editable[0]?.id ?? 'duration')
  const [text, setText] = useState('')
  const [dur, setDur] = useState('')

  const col = editable.find((c) => c.id === field)
  const common = col ? commonCellValue(col.id) : null
  const mixed = common === null

  return (
    <div className="space-y-2" data-testid="bulk-field-form">
      <div>
        <p className={F_LABEL}>Field</p>
        <select
          data-testid="bulk-field-select"
          value={field}
          onChange={(e) => { setField(e.target.value); setText('') }}
          className={F_INPUT}
        >
          {editable.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="duration">Duration</option>
          <option value="not_final">Not final</option>
        </select>
      </div>

      {col?.col_type === 'richtext' && (
        <div>
          <p className={F_LABEL}>Value</p>
          <input
            data-testid="bulk-field-text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSetCell(col.id, text) }}
            placeholder={mixed ? 'Multiple values' : 'New value'}
            className={F_INPUT}
          />
          <button className={F_APPLY} onClick={() => onSetCell(col.id, text)}>Apply to selection</button>
        </div>
      )}

      {col?.col_type === 'dropdown' && (
        <div>
          <p className={F_LABEL}>Option</p>
          <select data-testid="bulk-field-dropdown" value={text} onChange={(e) => setText(e.target.value)} className={F_INPUT}>
            <option value="">{mixed ? 'Multiple values' : 'Select an option…'}</option>
            {(col.options ?? []).map((o) => <option key={o} value={JSON.stringify([o])}>{o}</option>)}
          </select>
          <button className={F_APPLY} disabled={!text} onClick={() => onSetCell(col.id, text)}>Apply to selection</button>
        </div>
      )}

      {field === 'duration' && (
        <div>
          <p className={F_LABEL}>Duration</p>
          <input
            data-testid="bulk-field-duration"
            autoFocus
            value={dur}
            onChange={(e) => setDur(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { const ms = parseDurationInput(dur); if (ms != null) onSetDuration(ms) } }}
            placeholder="mm:ss or 90"
            className={F_INPUT}
          />
          <button
            className={F_APPLY}
            disabled={parseDurationInput(dur) == null}
            onClick={() => { const ms = parseDurationInput(dur); if (ms != null) onSetDuration(ms) }}
          >
            Apply to selection
          </button>
        </div>
      )}

      {field === 'not_final' && (
        <div className="flex gap-1.5">
          <button data-testid="bulk-not-final-on" className={cn(F_APPLY, 'mt-0')} onClick={() => onSetNotFinal(true)}>Mark not final</button>
          <button data-testid="bulk-not-final-off" className={cn(F_APPLY, 'mt-0 bg-transparent border border-[#2e2e38] text-[#c8c9d0] hover:bg-[#1d1d24] hover:text-[#eef0f3]')} onClick={() => onSetNotFinal(false)}>Clear</button>
        </div>
      )}
    </div>
  )
}
