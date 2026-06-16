'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Play,
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
  Undo2,
  Redo2,
} from 'lucide-react'
import {
  renameRundown,
  updateRundownStatus,
  saveAsTemplate,
} from '@/app/actions/rundowns'
import { ShareDialog } from './ShareDialog'
import { RundownSearch } from './RundownSearch'
import type { SearchCue } from './RundownSearch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
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
  onOpenSettings: (tab?: 'display' | 'numbering') => void
  onOpenMentions: (tab?: 'mentions' | 'variables') => void
  onResetTiming: () => void
  onOpenTrash: () => void
  canUndo: boolean
  canRedo: boolean
  undoLabel?: string
  redoLabel?: string
  onUndo: () => void
  onRedo: () => void
  searchCues: SearchCue[]
  onSearchSelect: (id: string) => void
}

const STATUS_DESC: Record<RundownStatus, string> = {
  draft: 'Work in progress',
  awaiting_data: 'Waiting on data',
  approved: 'Signed off',
  finalized: 'Locked for show',
  rejected: 'Needs changes',
}

// Shared CueFlow dropdown item class for the Rundown menu
const MENU_ITEM =
  'gap-2.5 px-4 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

export function RundownHeader({
  rundown,
  columns,
  onPlayClick,
  isLive,
  onOpenSettings,
  onOpenMentions,
  onResetTiming,
  onOpenTrash,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
  searchCues,
  onSearchSelect,
}: RundownHeaderProps) {
  const [name, setName] = useState(rundown.name)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<RundownStatus>(
    normalizeStatus(rundown.status)
  )
  const [statusOpen, setStatusOpen] = useState(false)
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
    setStatusOpen(false)
    const result = await updateRundownStatus(rundown.id, next)
    if (result?.error) toast.error(result.error)
  }

  async function handleSaveTemplate() {
    const result = await saveAsTemplate(rundown.id)
    if (result?.error) toast.error(result.error)
    else toast.success('Saved as template')
  }

  const cf = STATUS_CONFIG[status].cf

  return (
    <header className="flex items-center gap-3 px-5 h-14 border-b border-[#1d1d24] bg-[#07070a] shrink-0">
      {/* Amber logo / back-to-dashboard */}
      <Link
        href="/dashboard"
        title="Back to dashboard"
        className="w-[30px] h-[30px] bg-[#f0a838] hover:bg-[#ffba50] flex items-center justify-center shrink-0 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06060a" strokeWidth="2.5" strokeLinecap="square">
          <line x1="7" y1="6" x2="20" y2="6" />
          <line x1="7" y1="12" x2="20" y2="12" />
          <line x1="7" y1="18" x2="20" y2="18" />
          <line x1="3" y1="6" x2="3" y2="6" strokeLinecap="round" strokeWidth="3.2" />
          <line x1="3" y1="12" x2="3" y2="12" strokeLinecap="round" strokeWidth="3.2" />
          <line x1="3" y1="18" x2="3" y2="18" strokeLinecap="round" strokeWidth="3.2" />
        </svg>
      </Link>

      {/* Editable rundown name */}
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
          className="bg-transparent text-[#eef0f3] font-semibold text-base outline-none border-b border-[#f0a838] w-64 shrink-0"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-[#eef0f3] hover:text-white font-semibold text-base tracking-[-0.01em] truncate max-w-md text-left shrink-0 transition-colors"
        >
          {name}
        </button>
      )}

      {/* Status badge + selector */}
      <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
        <DropdownMenuTrigger
          render={
            <button
              data-testid="status-badge"
              title="Change status"
              className="inline-flex items-center gap-1.5 px-[7px] py-[3px] font-cond text-[10px] font-bold uppercase tracking-[0.14em] cursor-pointer shrink-0"
              style={{ background: cf.bg, border: `1px solid ${cf.bd}`, color: cf.fg }}
            />
          }
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
          {STATUS_CONFIG[status].label}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="bg-[#111116] border-[#3a3a48] text-[#c8c9d0] w-56 p-0"
        >
          {RUNDOWN_STATUSES.map((s) => {
            const sc = STATUS_CONFIG[s].cf
            const sel = status === s
            return (
              <DropdownMenuItem
                key={s}
                onClick={() => changeStatus(s)}
                className="gap-2.5 px-3 py-2.5 cursor-pointer focus:bg-[#16161c] data-[sel=true]:bg-[rgba(240,168,56,0.10)]"
                data-sel={sel}
                style={sel ? { borderLeft: '2px solid #f0a838', paddingLeft: 10 } : undefined}
              >
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: sc.dot }} />
                <span className="flex-1 min-w-0">
                  <span className={sel ? 'block text-[12.5px] text-[#eef0f3]' : 'block text-[12.5px] text-[#c8c9d0]'}>
                    {STATUS_CONFIG[s].label}
                  </span>
                  <span className="block font-mono text-[10.5px] text-[#7c7e8a] mt-px">
                    {STATUS_DESC[s]}
                  </span>
                </span>
                {sel && <span className="font-mono text-[11px] text-[#f0a838]">✓</span>}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <RundownSearch cues={searchCues} onSelect={onSearchSelect} />

      {/* Undo / Redo */}
      <div className="flex items-center">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title={canUndo ? `Undo: ${undoLabel} (⌘Z)` : 'Nothing to undo'}
          className="w-8 h-8 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title={canRedo ? `Redo: ${redoLabel} (⌘⇧Z)` : 'Nothing to redo'}
          className="w-8 h-8 flex items-center justify-center text-[#9ba0ab] hover:text-[#eef0f3] hover:bg-[#16161c] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Run show / End show */}
      {isLive ? (
        <button
          onClick={onPlayClick}
          className="inline-flex items-center gap-2 h-9 px-4 font-cond text-[11px] font-bold uppercase tracking-[0.14em] bg-[rgba(255,40,72,0.12)] text-[#ff4663] border border-[#ff2848] hover:bg-[rgba(255,40,72,0.20)] cursor-pointer transition-colors"
        >
          <span className="live-dot w-[7px] h-[7px] rounded-full bg-[#ff2848] inline-block" />
          End show
        </button>
      ) : (
        <button
          onClick={onPlayClick}
          className="inline-flex items-center gap-2 h-9 px-5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] hover:border-[#ffba50] cursor-pointer transition-colors"
        >
          <Play className="w-[11px] h-[11px] fill-[#06060a]" />
          Run show
        </button>
      )}

      {/* Rundown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              data-testid="rundown-menu"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 font-cond text-[11px] font-bold uppercase tracking-[0.12em] bg-[#111116] text-[#c8c9d0] border border-[#22222a] hover:border-[#3a3a48] hover:bg-[#16161c] cursor-pointer transition-colors"
            />
          }
        >
          Rundown
          <ChevronDown className="w-3 h-3 text-[#9ba0ab]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-60 p-0">
          <DropdownMenuItem render={<Link href="/dashboard" />} className={MENU_ITEM}>
            <LayoutDashboard className="w-3.5 h-3.5 text-[#9ba0ab]" /> Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenSettings()} className={MENU_ITEM}>
            <SettingsIcon className="w-3.5 h-3.5 text-[#9ba0ab]" /> Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-[#1d1d24]" />

          <DropdownMenuItem onClick={() => onOpenMentions('mentions')} className={MENU_ITEM}>
            <AtSign className="w-3.5 h-3.5 text-[#9ba0ab]" /> Mentions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenMentions('variables')} className={MENU_ITEM}>
            <DollarSign className="w-3.5 h-3.5 text-[#9ba0ab]" /> Text variables
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenTrash} data-testid="open-trash-menu-item" className={MENU_ITEM}>
            <Trash2 className="w-3.5 h-3.5 text-[#9ba0ab]" /> Trash
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-[#1d1d24]" />

          <DropdownMenuItem data-testid="save-as-template" onClick={handleSaveTemplate} className={MENU_ITEM}>
            <LayoutTemplate className="w-3.5 h-3.5 text-[#9ba0ab]" /> Save as template
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="share-menu-item" onClick={() => setShareOpen(true)} className={MENU_ITEM}>
            <Share2 className="w-3.5 h-3.5 text-[#9ba0ab]" /> Share (read-only link)
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<a href={`/rundown/${rundown.id}/export/pdf`} target="_blank" rel="noopener noreferrer" />}
            className={MENU_ITEM}
          >
            <FileDown className="w-3.5 h-3.5 text-[#9ba0ab]" /> Export PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<a href={`/rundown/${rundown.id}/export/csv`} />}
            className={MENU_ITEM}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#9ba0ab]" /> Export CSV
          </DropdownMenuItem>
          <SoonItem icon={<MonitorPlay className="w-3.5 h-3.5" />} label="Generate output" />
          <SoonItem icon={<Code className="w-3.5 h-3.5" />} label="API docs" />

          <DropdownMenuSeparator className="bg-[#1d1d24]" />

          <DropdownMenuItem onClick={onResetTiming} className={MENU_ITEM}>
            <RotateCcw className="w-3.5 h-3.5 text-[#9ba0ab]" /> Reset rundown timing
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
      className="gap-2.5 px-4 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#5a5c66] justify-between cursor-not-allowed"
    >
      <span className="flex items-center gap-2.5">
        <span className="text-[#5a5c66]">{icon}</span> {label}
      </span>
      <span className="text-[9px] text-[#5a5c66] border border-[#2e2e38] px-1 normal-case tracking-normal">
        Soon
      </span>
    </DropdownMenuItem>
  )
}
