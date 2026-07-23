'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DIALOG_CONTENT, DIALOG_HEADER } from './dialogStyles'
import { Keyboard } from 'lucide-react'

interface ShortcutGroup {
  title: string
  rows: [string, string][]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Focus mode',
    rows: [
      ['↑ ↓ ← →', 'Move focus between cells'],
      ['Enter / Space', 'Start editing the focused cell'],
      ['Escape', 'Clear focus'],
      ['⌘/Ctrl + Enter', 'Add a cue below the focused row'],
      ['⌘/Ctrl + D', 'Repeat the value from the cell above'],
      ['Shift + Arrows / Click', 'Extend the cell selection'],
      ['⌘/Ctrl + C / V', 'Copy / paste the selected cells'],
    ],
  },
  {
    title: 'Edit mode',
    rows: [
      ['Tab / Shift+Tab', 'Confirm the edit, move focus right / left'],
      ['Enter', 'Confirm the edit, move focus down a row'],
      ['Shift+Enter', 'Insert a new line in the focused field'],
      ['Escape', 'Confirm or cancel (field-dependent)'],
    ],
  },
  {
    title: 'Global',
    rows: [
      ['⌘/Ctrl + Z', 'Undo'],
      ['⌘/Ctrl + Shift + Z / Y', 'Redo'],
    ],
  },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${DIALOG_CONTENT} sm:max-w-md`}>
        <DialogHeader className={DIALOG_HEADER}>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#9ba0ab]" /> Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c7e8a] mb-2">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.rows.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between gap-4">
                    <kbd className="shrink-0 font-mono text-[11px] text-[#eef0f3] bg-[#16161c] border border-[#2e2e38] px-1.5 py-0.5">
                      {keys}
                    </kbd>
                    <span className="text-[12.5px] text-[#9ba0ab] text-right">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
