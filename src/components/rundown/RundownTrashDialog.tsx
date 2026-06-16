'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, Clock, AlignLeft, Columns3 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ROW_TILE } from './dialogStyles'
import { getTrashedCues } from '@/app/actions/cues'
import { getTrashedColumns, restoreColumn } from '@/app/actions/columns'
import { restoreCue } from '@/app/actions/cues'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Cue, Column } from '@/lib/supabase/types'

interface RundownTrashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rundownId: string
  onRestored: () => void
}

function daysRemaining(deletedAt: string): number {
  const expiry = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)))
}

function relativeTime(deletedAt: string): string {
  const ms = Date.now() - new Date(deletedAt).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function RundownTrashDialog({
  open,
  onOpenChange,
  rundownId,
  onRestored,
}: RundownTrashDialogProps) {
  const [cues, setCues] = useState<Cue[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [trashedCues, trashedColumns] = await Promise.all([
      getTrashedCues(rundownId),
      getTrashedColumns(rundownId),
    ])
    setCues(trashedCues)
    setColumns(trashedColumns)
    setLoading(false)
  }, [rundownId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  async function handleRestoreCue(id: string) {
    setRestoringId(id)
    const res = await restoreCue(id, rundownId)
    setRestoringId(null)
    if (res.error) return toast.error(res.error)
    setCues((prev) => prev.filter((c) => c.id !== id))
    toast.success('Cue restored')
    onRestored()
  }

  async function handleRestoreColumn(id: string) {
    setRestoringId(id)
    const res = await restoreColumn(id, rundownId)
    setRestoringId(null)
    if (res.error) return toast.error(res.error)
    setColumns((prev) => prev.filter((c) => c.id !== id))
    toast.success('Column restored')
    onRestored()
  }

  const isEmpty = !loading && cues.length === 0 && columns.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-lg p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#9ba0ab]" /> Rundown trash
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-3">
          <p className="text-xs text-[#888b96]">
            Deleted cues and columns are kept here for 30 days before being permanently removed.
          </p>

          {loading && <p className="text-sm text-[#888b96] py-4 text-center">Loading…</p>}

          {isEmpty && (
            <div className="py-8 text-center">
              <Trash2 className="w-8 h-8 text-[#2e2e38] mx-auto mb-2" />
              <p className="text-sm text-[#888b96]">Trash is empty</p>
            </div>
          )}

          {!loading && cues.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c7e8a] mb-2 flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5" /> Cues
              </p>
              {cues.map((cue) => {
                const days = cue.deleted_at ? daysRemaining(cue.deleted_at) : 0
                const when = cue.deleted_at ? relativeTime(cue.deleted_at) : ''
                return (
                  <div key={cue.id} data-testid={`trash-cue-${cue.id}`} className={cn('flex items-center gap-3', ROW_TILE)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#eef0f3] truncate">
                        {cue.title || <span className="italic text-[#5a5c66]">Untitled cue</span>}
                      </p>
                      <p className="text-xs text-[#888b96] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {when}
                        <span className="text-[#5a5c66]">·</span>
                        <span className={cn(days <= 3 ? 'text-[#ff5a73]' : 'text-[#888b96]')}>{days}d remaining</span>
                      </p>
                    </div>
                    <button
                      data-testid={`restore-cue-${cue.id}`}
                      disabled={restoringId === cue.id}
                      onClick={() => handleRestoreCue(cue.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 font-cond text-[10px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] border border-[#2e2e38] hover:border-[#3a3a48] hover:text-[#eef0f3] transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && columns.length > 0 && (
            <div className={cn('space-y-1.5', cues.length > 0 && 'mt-2')}>
              <p className="font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c7e8a] mb-2 flex items-center gap-1.5">
                <Columns3 className="w-3.5 h-3.5" /> Columns
              </p>
              {columns.map((col) => {
                const days = col.deleted_at ? daysRemaining(col.deleted_at) : 0
                const when = col.deleted_at ? relativeTime(col.deleted_at) : ''
                return (
                  <div key={col.id} data-testid={`trash-column-${col.id}`} className={cn('flex items-center gap-3', ROW_TILE)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#eef0f3] truncate">{col.name}</p>
                      <p className="text-xs text-[#888b96] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {when}
                        <span className="text-[#5a5c66]">·</span>
                        <span className={cn(days <= 3 ? 'text-[#ff5a73]' : 'text-[#888b96]')}>{days}d remaining</span>
                      </p>
                    </div>
                    <button
                      data-testid={`restore-column-${col.id}`}
                      disabled={restoringId === col.id}
                      onClick={() => handleRestoreColumn(col.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 font-cond text-[10px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] border border-[#2e2e38] hover:border-[#3a3a48] hover:text-[#eef0f3] transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
