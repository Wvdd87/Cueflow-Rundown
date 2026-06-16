'use client'

import Link from 'next/link'
import { LayoutTemplate, Plus, Trash2, MoreHorizontal } from 'lucide-react'
import { createFromTemplate, deleteRundown } from '@/app/actions/rundowns'
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
    <div className="group border border-[#1d1d24] bg-[#0c0c11] hover:border-[#3a3a48] transition-colors p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-7 h-7 bg-[#16161c] border border-[#2e2e38] flex items-center justify-center shrink-0">
          <LayoutTemplate className="w-3.5 h-3.5 text-[#f0a838]" />
        </div>
        <Link href={`/rundown/${template.id}`} className="flex-1 min-w-0 text-sm font-semibold text-[#eef0f3] truncate hover:text-white transition-colors">
          {template.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#1d1d24] transition-colors shrink-0" />
            }
          >
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-44 p-0">
            <DropdownMenuItem
              onClick={handleDelete}
              className="gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[rgba(255,40,72,0.08)] focus:text-[#ff5a73] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-[#888b96] mb-3">Template</p>
      <button
        data-testid="use-template"
        onClick={handleUse}
        className="inline-flex items-center gap-1.5 h-8 px-3 font-cond text-[10px] font-bold uppercase tracking-[0.12em] bg-[#16161c] text-[#c8c9d0] border border-[#2e2e38] hover:border-[#3a3a48] hover:text-[#eef0f3] cursor-pointer transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Use template
      </button>
    </div>
  )
}
