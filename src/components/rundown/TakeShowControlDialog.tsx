'use client'

import { Radio } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TakeShowControlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Label of whoever currently holds show control (e.g. "Stage Manager"). */
  leaderLabel: string | null
  /** Display number of the cue the current leader is on (e.g. "3.2"). */
  currentCueNumber: string | null
  /** Title of the cue the current leader is on. */
  currentCueTitle: string | null
  /** Take control and resume from the leader's current cue. */
  onContinue: () => void
  /** Take control and restart the show from the top. */
  onStartOver: () => void
}

const BTN_PRIMARY =
  'inline-flex items-center justify-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] cursor-pointer'
const BTN_GHOST =
  'inline-flex items-center justify-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-transparent text-[#9ba0ab] border border-[#2e2e38] hover:text-[#eef0f3] cursor-pointer'

export function TakeShowControlDialog({
  open,
  onOpenChange,
  leaderLabel,
  currentCueNumber,
  currentCueTitle,
  onContinue,
  onStartOver,
}: TakeShowControlDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-md p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[#eef0f3]">
            <Radio className="w-4 h-4 text-[#f0a838]" /> Take show control
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[#9ba0ab]">
            <span className="text-[#eef0f3]">{leaderLabel || 'Someone'}</span> is running the show
            {currentCueNumber && (
              <>
                {', currently on '}
                <span className="font-mono text-[#f0a838]">{currentCueNumber}</span>
                {currentCueTitle ? <span className="text-[#c8c9d0]"> — {currentCueTitle}</span> : null}
              </>
            )}
            . Continue from there, or start over from the top?
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              data-testid="takeover-start-over-btn"
              onClick={() => {
                onOpenChange(false)
                onStartOver()
              }}
              className={BTN_GHOST}
            >
              Start over
            </button>
            <button
              data-testid="takeover-continue-btn"
              onClick={() => {
                onOpenChange(false)
                onContinue()
              }}
              className={BTN_PRIMARY}
            >
              Continue from current cue
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
