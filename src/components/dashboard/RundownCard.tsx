'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, MoreHorizontal, Pencil, Copy, Trash2, Check, X } from 'lucide-react'
import { renameRundown, deleteRundown, duplicateRundown } from '@/app/actions/rundowns'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/StatusBadge'
import { toast } from 'sonner'
import type { Rundown } from '@/lib/supabase/types'

interface RundownCardProps {
  rundown: Rundown
}

export function RundownCard({ rundown }: RundownCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(rundown.name)
  const [saving, setSaving] = useState(false)

  async function saveRename() {
    if (!name.trim() || name === rundown.name) {
      setRenaming(false)
      setName(rundown.name)
      return
    }
    setSaving(true)
    const result = await renameRundown(rundown.id, name)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      setName(rundown.name)
    }
    setRenaming(false)
  }

  async function handleDelete() {
    const result = await deleteRundown(rundown.id)
    if (result.error) toast.error(result.error)
    else toast.success('Rundown deleted')
  }

  async function handleDuplicate() {
    const result = await duplicateRundown(rundown.id)
    if (result.error) toast.error(result.error)
    else toast.success('Rundown duplicated')
  }

  const formattedDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-zinc-400" />
      </div>

      <div className="flex-1 min-w-0">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename()
                if (e.key === 'Escape') { setRenaming(false); setName(rundown.name) }
              }}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <button onClick={saveRename} disabled={saving} className="text-zinc-400 hover:text-white">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setRenaming(false); setName(rundown.name) }} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link href={`/rundown/${rundown.id}`} className="block">
            <p className="text-sm font-medium text-white truncate hover:text-zinc-200 transition-colors">
              {rundown.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={rundown.status} />
              {formattedDate && (
                <p className="text-xs text-zinc-500">{formattedDate}</p>
              )}
            </div>
          </Link>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button data-testid="rundown-menu-btn" variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0" />}
        >
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-zinc-900 border-zinc-700 text-zinc-200 w-44"
        >
          <DropdownMenuItem
            onClick={() => setRenaming(true)}
            className="gap-2 focus:bg-zinc-800 focus:text-white cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDuplicate}
            className="gap-2 focus:bg-zinc-800 focus:text-white cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            data-testid="rundown-delete"
            onClick={handleDelete}
            className="gap-2 text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
