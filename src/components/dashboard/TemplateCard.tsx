'use client'

import Link from 'next/link'
import { LayoutTemplate, Plus, Trash2, MoreHorizontal } from 'lucide-react'
import { createFromTemplate, deleteRundown } from '@/app/actions/rundowns'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { Rundown } from '@/lib/supabase/types'

export function TemplateCard({ template }: { template: Rundown }) {
  async function handleUse() {
    const result = await createFromTemplate(template.id) // redirects on success
    if (result?.error) toast.error(result.error)
  }

  async function handleDelete() {
    const result = await deleteRundown(template.id)
    if (result.error) toast.error(result.error)
    else toast.success('Template deleted')
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="w-8 h-8 rounded-md bg-blue-950/40 flex items-center justify-center shrink-0">
        <LayoutTemplate className="w-4 h-4 text-blue-400" />
      </div>

      <Link href={`/rundown/${template.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate hover:text-zinc-200 transition-colors">
          {template.name}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">Template</p>
      </Link>

      <Button
        data-testid="use-template"
        size="sm"
        onClick={handleUse}
        className="bg-white text-zinc-900 hover:bg-zinc-100 gap-1.5 shrink-0"
      >
        <Plus className="w-3.5 h-3.5" /> Use
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
            />
          }
        >
          <MoreHorizontal className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-44">
          <DropdownMenuItem
            onClick={handleDelete}
            className="gap-2 text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
