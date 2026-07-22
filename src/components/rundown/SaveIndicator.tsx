'use client'

import { Loader2, Check, AlertTriangle } from 'lucide-react'
import type { SaveStatus } from './RundownDataContext'

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const config = {
    saving: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Saving…', color: '#9ba0ab' },
    saved: { icon: <Check className="w-3 h-3" />, label: 'Saved', color: '#18d986' },
    error: { icon: <AlertTriangle className="w-3 h-3" />, label: 'Save failed', color: '#ff5a73' },
  }[status]

  return (
    <span
      data-testid="save-indicator"
      className="inline-flex items-center gap-1.5 font-cond text-[10px] font-bold uppercase tracking-[0.1em] shrink-0"
      style={{ color: config.color }}
    >
      {config.icon}
      {config.label}
    </span>
  )
}
