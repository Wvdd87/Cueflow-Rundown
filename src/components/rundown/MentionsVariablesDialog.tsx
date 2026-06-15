'use client'

import { useState, useEffect } from 'react'
import { AtSign, DollarSign, Trash2, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRundownData } from './RundownDataContext'
import { addMention, deleteMention } from '@/app/actions/mentions'
import {
  addVariable,
  updateVariable,
  deleteVariable,
} from '@/app/actions/variables'
import { normalizeKey } from '@/lib/variables'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Mention, Variable } from '@/lib/supabase/types'

interface MentionsVariablesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: 'mentions' | 'variables'
}

const byName = (a: Mention, b: Mention) => a.name.localeCompare(b.name)
const byKey = (a: Variable, b: Variable) => a.key.localeCompare(b.key)

export function MentionsVariablesDialog({
  open,
  onOpenChange,
  initialTab = 'mentions',
}: MentionsVariablesDialogProps) {
  const { rundownId, mentions, variables, setMentions, setVariables } =
    useRundownData()
  const [tab, setTab] = useState<'mentions' | 'variables'>(initialTab)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  const [mName, setMName] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [savingM, setSavingM] = useState(false)

  const [vKey, setVKey] = useState('')
  const [vValue, setVValue] = useState('')
  const [savingV, setSavingV] = useState(false)

  async function handleAddMention() {
    const name = mName.trim()
    if (!name) return
    setSavingM(true)
    const res = await addMention(rundownId, name, mDesc.trim() || null)
    setSavingM(false)
    if (res.error) return toast.error(res.error)
    if (res.mention) {
      setMentions((prev) => [...prev, res.mention!].sort(byName))
      setMName('')
      setMDesc('')
    }
  }

  async function handleDeleteMention(id: string) {
    setMentions((prev) => prev.filter((m) => m.id !== id))
    const res = await deleteMention(id, rundownId)
    if (res.error) toast.error(res.error)
  }

  async function handleAddVariable() {
    const key = normalizeKey(vKey)
    if (!key) return toast.error('Enter a valid key')
    setSavingV(true)
    const res = await addVariable(rundownId, key, vValue)
    setSavingV(false)
    if (res.error) return toast.error(res.error)
    if (res.variable) {
      setVariables((prev) => [...prev, res.variable!].sort(byKey))
      setVKey('')
      setVValue('')
    }
  }

  async function handleUpdateVariableValue(v: Variable, value: string) {
    if (value === v.value) return
    setVariables((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, value } : x))
    )
    const res = await updateVariable(v.id, rundownId, { value })
    if (res.error) toast.error(res.error)
  }

  async function handleDeleteVariable(id: string) {
    setVariables((prev) => prev.filter((v) => v.id !== id))
    const res = await deleteVariable(id, rundownId)
    if (res.error) toast.error(res.error)
  }

  const keyPreview = normalizeKey(vKey)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mentions &amp; Variables</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-zinc-800 -mx-1 px-1">
          <button
            onClick={() => setTab('mentions')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              tab === 'mentions'
                ? 'border-white text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            <AtSign className="w-3.5 h-3.5" />
            Mentions
            <span className="text-xs text-zinc-600">({mentions.length})</span>
          </button>
          <button
            onClick={() => setTab('variables')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              tab === 'variables'
                ? 'border-white text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            )}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Variables
            <span className="text-xs text-zinc-600">({variables.length})</span>
          </button>
        </div>

        {tab === 'mentions' && (
          <div className="space-y-4 mt-1">
            <p className="text-xs text-zinc-500">
              Reusable references. Type <span className="text-blue-400">@</span> in
              any cell to insert one; editing here updates every instance.
            </p>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {mentions.length === 0 && (
                <p className="text-sm text-zinc-600 italic py-2">No mentions yet</p>
              )}
              {mentions.map((m) => (
                <div
                  key={m.id}
                  className="group flex items-start gap-2 rounded-md bg-zinc-800/50 px-3 py-2"
                >
                  <span className="text-blue-400 text-sm mt-0.5">@</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.name}</p>
                    {m.description && (
                      <p className="text-xs text-zinc-500 truncate">{m.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteMention(m.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <Input
                data-testid="new-mention-name"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="Name (e.g. Camera 1, Host bio)"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
              <textarea
                data-testid="new-mention-desc"
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                rows={2}
                placeholder="Description (optional)"
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 resize-none"
              />
              <Button
                data-testid="add-mention-btn"
                onClick={handleAddMention}
                disabled={savingM || !mName.trim()}
                className="bg-white text-zinc-900 hover:bg-zinc-100 gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add mention
              </Button>
            </div>
          </div>
        )}

        {tab === 'variables' && (
          <div className="space-y-4 mt-1">
            <p className="text-xs text-zinc-500">
              Reusable values. Type <span className="text-emerald-400">$</span> in any
              cell to insert one; changing a value updates everywhere live.
            </p>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {variables.length === 0 && (
                <p className="text-sm text-zinc-600 italic py-2">No variables yet</p>
              )}
              {variables.map((v) => (
                <div
                  key={v.id}
                  className="group flex items-center gap-2 rounded-md bg-zinc-800/50 px-3 py-1.5"
                >
                  <span className="text-emerald-400 font-mono text-xs shrink-0">
                    ${v.key}
                  </span>
                  <Input
                    data-testid={`var-value-${v.key}`}
                    defaultValue={v.value}
                    onBlur={(e) => handleUpdateVariableValue(v, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    placeholder="value"
                    className="flex-1 h-7 bg-zinc-800 border-zinc-700 text-white text-sm placeholder:text-zinc-600"
                  />
                  <button
                    onClick={() => handleDeleteVariable(v.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <div className="flex gap-2">
                <Input
                  data-testid="new-variable-key"
                  value={vKey}
                  onChange={(e) => setVKey(e.target.value)}
                  placeholder="key"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                />
                <Input
                  data-testid="new-variable-value"
                  value={vValue}
                  onChange={(e) => setVValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddVariable()
                  }}
                  placeholder="value"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              {vKey && (
                <p className="text-xs text-zinc-500">
                  Will be saved as{' '}
                  <span className="text-emerald-400 font-mono">${keyPreview}</span>
                </p>
              )}
              <Button
                data-testid="add-variable-btn"
                onClick={handleAddVariable}
                disabled={savingV || !normalizeKey(vKey)}
                className="bg-white text-zinc-900 hover:bg-zinc-100 gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add variable
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
