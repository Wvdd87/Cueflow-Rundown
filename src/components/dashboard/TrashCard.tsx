'use client'

import { FileText, RotateCcw, Trash2 } from 'lucide-react'
import { restoreRundown, purgeRundown } from '@/app/actions/rundowns'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Rundown } from '@/lib/supabase/types'

export function TrashCard({ rundown }: { rundown: Rundown }) {
  async function handleRestore() {
    const result = await restoreRundown(rundown.id)
    if (result.error) toast.error(result.error)
    else toast.success('Rundown restored')
  }

  async function handlePurge() {
    const result = await purgeRundown(rundown.id)
    if (result.error) toast.error(result.error)
    else toast.success('Permanently deleted')
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-zinc-500" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-300 truncate">{rundown.name}</p>
        {rundown.deleted_at && (
          <p className="text-xs text-zinc-600 mt-0.5">
            Deleted {new Date(rundown.deleted_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <Button
        data-testid="restore-rundown"
        size="sm"
        variant="outline"
        onClick={handleRestore}
        className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 gap-1.5 shrink-0"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Restore
      </Button>
      <Button
        data-testid="purge-rundown"
        size="sm"
        onClick={handlePurge}
        className="bg-red-600 hover:bg-red-700 text-white gap-1.5 shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete forever
      </Button>
    </div>
  )
}
