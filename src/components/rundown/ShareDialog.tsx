'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link2, Copy, Check, Trash2, Globe, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listShares, createShare, updateShare, revokeShare } from '@/app/actions/shares'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Column, RundownShare } from '@/lib/supabase/types'

interface ShareDialogProps {
  rundownId: string
  columns: Column[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareDialog({ rundownId, columns, open, onOpenChange }: ShareDialogProps) {
  const [shares, setShares] = useState<RundownShare[]>([])
  const [loading, setLoading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listShares(rundownId)
      .then((r) => setShares(r.shares))
      .finally(() => setLoading(false))
  }, [open, rundownId])

  const handleCreate = useCallback(async () => {
    setLoading(true)
    const r = await createShare(rundownId, newLabel, null) // null = all columns
    setLoading(false)
    if (r.error) return toast.error(r.error)
    if (r.share) {
      setShares((prev) => [...prev, r.share!])
      setNewLabel('')
    }
  }, [rundownId, newLabel])

  async function handleRevoke(id: string) {
    setShares((prev) => prev.filter((s) => s.id !== id))
    const r = await revokeShare(id)
    if (r.error) toast.error(r.error)
  }

  async function handleCopy(share: RundownShare) {
    await navigator.clipboard.writeText(`${origin}/share/${share.token}`)
    setCopiedId(share.id)
    toast.success('Link copied')
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function toggleColumn(share: RundownShare, colId: string) {
    const current = share.visible_columns ?? columns.map((c) => c.id)
    const next = current.includes(colId)
      ? current.filter((x) => x !== colId)
      : [...current, colId]
    setShares((prev) =>
      prev.map((s) => (s.id === share.id ? { ...s, visible_columns: next } : s))
    )
    const r = await updateShare(share.id, { visibleColumns: next })
    if (r.error) toast.error(r.error)
  }

  async function renameShare(share: RundownShare, label: string) {
    if (label === (share.label ?? '')) return
    setShares((prev) =>
      prev.map((s) => (s.id === share.id ? { ...s, label } : s))
    )
    await updateShare(share.id, { label })
  }

  const isVisible = (share: RundownShare, colId: string) =>
    share.visible_columns === null || share.visible_columns.includes(colId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4" /> Read-only links
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-zinc-400">
            Make a separate link per person or team. Each link can show a different
            set of columns, and follows the show live as you run it.
          </p>

          {/* Existing links */}
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {shares.length === 0 && !loading && (
              <p className="text-sm text-zinc-600 italic">No links yet.</p>
            )}
            {shares.map((share) => (
              <div
                key={share.id}
                data-testid="share-row"
                className="rounded-md border border-zinc-800 bg-zinc-800/40 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    defaultValue={share.label ?? ''}
                    onBlur={(e) => renameShare(share, e.target.value)}
                    placeholder="Link name (e.g. Camera team)"
                    className="h-7 bg-zinc-800 border-zinc-700 text-sm text-white placeholder:text-zinc-600"
                  />
                  <Button
                    data-testid="copy-share"
                    size="icon-sm"
                    onClick={() => handleCopy(share)}
                    className="bg-white text-zinc-900 hover:bg-zinc-100 shrink-0"
                    title="Copy link"
                  >
                    {copiedId === share.id ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <button
                    onClick={() => handleRevoke(share.id)}
                    title="Revoke link"
                    className="shrink-0 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Link2 className="w-3 h-3 shrink-0" />
                  <span data-testid="share-url" className="truncate">
                    {origin}/share/{share.token}
                  </span>
                </div>

                {columns.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
                      Visible columns
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map((col) => (
                        <button
                          key={col.id}
                          onClick={() => toggleColumn(share, col.id)}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full border transition-colors',
                            isVisible(share, col.id)
                              ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                              : 'border-zinc-700 text-zinc-600 line-through'
                          )}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New link */}
          <div className="flex items-center gap-2 border-t border-zinc-800 pt-3">
            <Input
              data-testid="new-share-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              placeholder="New link name (optional)"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
            />
            <Button
              data-testid="create-share"
              onClick={handleCreate}
              disabled={loading}
              className="bg-white text-zinc-900 hover:bg-zinc-100 gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Create link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
