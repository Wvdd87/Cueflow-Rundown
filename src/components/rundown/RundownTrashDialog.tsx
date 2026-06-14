'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, Clock, AlignLeft, Columns3 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-zinc-400" /> Rundown trash
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-zinc-500 -mt-1">
          Deleted cues and columns are kept here for 30 days before being permanently removed.
        </p>

        {loading && (
          <p className="text-sm text-zinc-500 py-4 text-center">Loading…</p>
        )}

        {isEmpty && (
          <div className="py-8 text-center">
            <Trash2 className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Trash is empty</p>
          </div>
        )}

        {!loading && cues.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5" /> Cues
            </p>
            {cues.map((cue) => {
              const days = cue.deleted_at ? daysRemaining(cue.deleted_at) : 0
              const when = cue.deleted_at ? relativeTime(cue.deleted_at) : ''
              return (
                <div
                  key={cue.id}
                  data-testid={`trash-cue-${cue.id}`}
                  className="flex items-center gap-3 rounded-md bg-zinc-800/50 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {cue.title || <span className="italic text-zinc-500">Untitled cue</span>}
                    </p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {when}
                      <span className="text-zinc-600">·</span>
                      <span className={cn(days <= 3 ? 'text-red-400' : 'text-zinc-500')}>
                        {days}d remaining
                      </span>
                    </p>
                  </div>
                  <Button
                    data-testid={`restore-cue-${cue.id}`}
                    size="sm"
                    variant="ghost"
                    disabled={restoringId === cue.id}
                    onClick={() => handleRestoreCue(cue.id)}
                    className="shrink-0 gap-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {!loading && columns.length > 0 && (
          <div className={cn('space-y-1', cues.length > 0 && 'mt-2')}>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Columns3 className="w-3.5 h-3.5" /> Columns
            </p>
            {columns.map((col) => {
              const days = col.deleted_at ? daysRemaining(col.deleted_at) : 0
              const when = col.deleted_at ? relativeTime(col.deleted_at) : ''
              return (
                <div
                  key={col.id}
                  data-testid={`trash-column-${col.id}`}
                  className="flex items-center gap-3 rounded-md bg-zinc-800/50 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{col.name}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {when}
                      <span className="text-zinc-600">·</span>
                      <span className={cn(days <= 3 ? 'text-red-400' : 'text-zinc-500')}>
                        {days}d remaining
                      </span>
                    </p>
                  </div>
                  <Button
                    data-testid={`restore-column-${col.id}`}
                    size="sm"
                    variant="ghost"
                    disabled={restoringId === col.id}
                    onClick={() => handleRestoreColumn(col.id)}
                    className="shrink-0 gap-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
