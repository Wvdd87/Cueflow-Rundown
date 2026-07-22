'use client'

import { TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface NotFinalCueRef {
  id: string
  displayNumber: string
  title: string
}

interface FinalizeWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notFinalCues: NotFinalCueRef[]
  onScrollToCue: (id: string) => void
  onConfirm: () => void
}

const BTN_PRIMARY =
  'inline-flex items-center justify-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] cursor-pointer'
const BTN_GHOST =
  'inline-flex items-center justify-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-transparent text-[#9ba0ab] border border-[#2e2e38] hover:text-[#eef0f3] cursor-pointer'

export function FinalizeWarningDialog({
  open,
  onOpenChange,
  notFinalCues,
  onScrollToCue,
  onConfirm,
}: FinalizeWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-md p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[#eef0f3]">
            <TriangleAlert className="w-4 h-4 text-[#f0a838]" /> Unfinished cues detected
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[#9ba0ab]">
            {notFinalCues.length} cue{notFinalCues.length === 1 ? ' is' : 's are'} still marked{' '}
            <span className="text-[#f0a838]">not final</span>. Review them before finalizing, or proceed anyway.
          </p>

          <div className="max-h-64 overflow-y-auto border border-[#1d1d24]">
            {notFinalCues.map((c) => (
              <button
                key={c.id}
                data-testid="not-final-cue-item"
                onClick={() => {
                  onOpenChange(false)
                  onScrollToCue(c.id)
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left border-b border-[#1d1d24] last:border-b-0 hover:bg-[#16161c] transition-colors"
              >
                <span className="font-mono text-[12px] font-bold text-[#f0a838] w-8 shrink-0">{c.displayNumber}</span>
                <span className="flex-1 min-w-0 text-[13px] text-[#eef0f3] truncate">
                  {c.title || <span className="italic text-[#5a5c66]">Untitled cue</span>}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onOpenChange(false)} className={BTN_GHOST}>
              Review cues
            </button>
            <button
              data-testid="finalize-anyway-btn"
              onClick={() => {
                onOpenChange(false)
                onConfirm()
              }}
              className={BTN_PRIMARY}
            >
              Mark as Final anyway
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
