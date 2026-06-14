'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Play,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Settings as SettingsIcon,
  AtSign,
  DollarSign,
  Share2,
  MonitorPlay,
  FileDown,
  FileSpreadsheet,
  Code,
  Trash2,
  RotateCcw,
  LayoutTemplate,
} from 'lucide-react'
import {
  renameRundown,
  updateRundownStatus,
  saveAsTemplate,
} from '@/app/actions/rundowns'
import { ShareDialog } from './ShareDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  STATUS_CONFIG,
  RUNDOWN_STATUSES,
  normalizeStatus,
  type RundownStatus,
} from '@/lib/rundownStatus'
import type { Rundown, Column } from '@/lib/supabase/types'

interface RundownHeaderProps {
  rundown: Rundown
  columns: Column[]
  onPlayClick: () => void
  isLive: boolean
  onOpenSettings: (tab?: 'mentions' | 'variables' | 'display' | 'numbering') => void
  onResetTiming: () => void
  onOpenTrash: () => void
}

export function RundownHeader({
  rundown,
  columns,
  onPlayClick,
  isLive,
  onOpenSettings,
  onResetTiming,
  onOpenTrash,
}: RundownHeaderProps) {
  const [name, setName] = useState(rundown.name)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<RundownStatus>(
    normalizeStatus(rundown.status)
  )
  const [shareOpen, setShareOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function saveName() {
    setEditing(false)
    if (name.trim() === rundown.name || !name.trim()) {
      setName(rundown.name)
      return
    }
    const result = await renameRundown(rundown.id, name)
    if (result?.error) {
      toast.error(result.error)
      setName(rundown.name)
    }
  }

  async function changeStatus(next: RundownStatus) {
    setStatus(next)
    const result = await updateRundownStatus(rundown.id, next)
    if (result?.error) toast.error(result.error)
  }

  async function handleSaveTemplate() {
    const result = await saveAsTemplate(rundown.id)
    if (result?.error) toast.error(result.error)
    else toast.success('Saved as template')
  }

  const formattedDate = rundown.show_date
    ? new Date(rundown.show_date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  const meta = STATUS_CONFIG[status]
  const StatusIcon = meta.icon

  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-zinc-800 bg-zinc-950 shrink-0">
      <Link
        href="/dashboard"
        className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
      </Link>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') { setEditing(false); setName(rundown.name) }
            }}
            className="bg-transparent text-white font-medium text-sm outline-none border-b border-zinc-500 max-w-md"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-white font-medium text-sm hover:text-zinc-200 transition-colors truncate max-w-md text-left"
          >
            {name}
          </button>
        )}

        {/* Status badge */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                data-testid="status-badge"
                title="Change status"
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 hover:opacity-90 transition-opacity',
                  meta.badge
                )}
              />
            }
          >
            <StatusIcon className="w-3 h-3" />
            {meta.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-44">
            {RUNDOWN_STATUSES.map((s) => {
              const Icon = STATUS_CONFIG[s].icon
              return (
                <DropdownMenuItem
                  key={s}
                  onClick={() => changeStatus(s)}
                  className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
                >
                  <span className={cn('w-2 h-2 rounded-full', STATUS_CONFIG[s].dot)} />
                  <Icon className="w-3.5 h-3.5 text-zinc-400" />
                  {STATUS_CONFIG[s].label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {formattedDate && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
          <CalendarDays className="w-3.5 h-3.5" />
          {formattedDate}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onPlayClick}
          className={
            isLive
              ? 'bg-green-600 hover:bg-green-700 text-white gap-1.5'
              : 'bg-white text-zinc-900 hover:bg-zinc-100 gap-1.5'
          }
        >
          <Play className="w-3.5 h-3.5" />
          {isLive ? 'Live' : 'Run show'}
        </Button>

        {/* Rundown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                data-testid="rundown-menu"
                variant="outline"
                size="sm"
                className="bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 gap-1"
              />
            }
          >
            Rundown
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-52">
            <DropdownMenuItem
              render={<Link href="/dashboard" />}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenSettings()}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <SettingsIcon className="w-4 h-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenSettings('mentions')}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <AtSign className="w-4 h-4" /> Mentions
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenSettings('variables')}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <DollarSign className="w-4 h-4" /> Text Variables
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenTrash()}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
              data-testid="open-trash-menu-item"
            >
              <Trash2 className="w-4 h-4" /> Trash
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-zinc-800" />

            <DropdownMenuItem
              data-testid="save-as-template"
              onClick={handleSaveTemplate}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <LayoutTemplate className="w-4 h-4" /> Save as template
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-zinc-800" />

            <DropdownMenuItem
              data-testid="share-menu-item"
              onClick={() => setShareOpen(true)}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Share (read-only link)
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={`/rundown/${rundown.id}/export/pdf`} target="_blank" rel="noopener noreferrer" />}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={`/rundown/${rundown.id}/export/csv`} />}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </DropdownMenuItem>
            <SoonItem icon={<MonitorPlay className="w-4 h-4" />} label="Generate Output" />
            <SoonItem icon={<Code className="w-4 h-4" />} label="API Docs" />

            <DropdownMenuSeparator className="bg-zinc-800" />

            <DropdownMenuItem
              render={<Link href="/trash" />}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Trash
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onResetTiming}
              className="gap-2 text-sm focus:bg-zinc-800 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Reset rundown timing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ShareDialog
        rundownId={rundown.id}
        columns={columns}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </header>
  )
}

function SoonItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <DropdownMenuItem
      disabled
      className="gap-2 text-sm text-zinc-500 justify-between cursor-not-allowed"
    >
      <span className="flex items-center gap-2">
        {icon} {label}
      </span>
      <span className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1">
        Soon
      </span>
    </DropdownMenuItem>
  )
}
