'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link2, Copy, Check, Trash2, Globe, Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FIELD, BTN_PRIMARY } from './dialogStyles'
import { listShares, createShare, updateShare, revokeShare } from '@/app/actions/shares'
import { CollabLinksSection } from './CollabLinksSection'
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
  const [creating, setCreating] = useState(false)
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
    setCreating(true)
    try {
      const r = await createShare(rundownId, newLabel, null) // null = all columns
      if (r.error) return toast.error(r.error)
      if (r.share) {
        setShares((prev) => [...prev, r.share!])
        setNewLabel('')
        toast.success('Link ready')
      }
    } finally {
      setCreating(false)
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
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-lg p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#9ba0ab]" /> Read-only links
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-5 overflow-y-auto max-h-[calc(85vh-68px)]">
          <p className="text-sm text-[#9ba0ab]">
            Make a separate link per person or team. Each link can show a different
            set of columns, and follows the show live as you run it.
          </p>

          {/* Existing links */}
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {shares.length === 0 && !loading && (
              <p className="text-sm text-[#5a5c66] italic">No links yet.</p>
            )}
            {shares.map((share) => (
              <div
                key={share.id}
                data-testid="share-row"
                className="border border-[#2e2e38] bg-[#16161c] p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={share.label ?? ''}
                    onBlur={(e) => renameShare(share, e.target.value)}
                    placeholder="Link name (e.g. Camera team)"
                    className={cn(FIELD, 'h-7 py-1')}
                  />
                  <button
                    data-testid="copy-share"
                    onClick={() => handleCopy(share)}
                    className="shrink-0 flex items-center justify-center h-7 w-7 bg-[#f0a838] text-[#06060a] hover:bg-[#ffba50] transition-colors"
                    title="Copy link"
                  >
                    {copiedId === share.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleRevoke(share.id)}
                    title="Revoke link"
                    className="shrink-0 text-[#5a5c66] hover:text-[#ff5a73] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#888b96]">
                  <Link2 className="w-3 h-3 shrink-0" />
                  <span data-testid="share-url" className="truncate font-mono">
                    {origin}/share/{share.token}
                  </span>
                </div>

                {columns.length > 0 && (
                  <div className="pt-1">
                    <p className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c7e8a] mb-1.5">
                      Visible columns
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map((col) => (
                        <button
                          key={col.id}
                          onClick={() => toggleColumn(share, col.id)}
                          className={cn(
                            'text-xs px-2 py-0.5 border transition-colors',
                            isVisible(share, col.id)
                              ? 'bg-[#1d1d24] border-[#3a3a48] text-[#eef0f3]'
                              : 'border-[#2e2e38] text-[#5a5c66] line-through'
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
          <div className="flex items-center gap-2 border-t border-[#1d1d24] pt-3">
            <input
              data-testid="new-share-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="New link name (optional)"
              disabled={creating}
              className={cn(FIELD, creating && 'opacity-60')}
            />
            <button
              data-testid="create-share"
              onClick={handleCreate}
              disabled={creating}
              className={cn(BTN_PRIMARY, 'shrink-0', creating && 'opacity-70 pointer-events-none')}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Generating link…' : 'Create link'}
            </button>
          </div>

          <CollabLinksSection rundownId={rundownId} columns={columns} open={open} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
