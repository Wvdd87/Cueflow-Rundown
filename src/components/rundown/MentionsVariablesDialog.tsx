'use client'

import { useState, useEffect } from 'react'
import { AtSign, DollarSign, Trash2, Plus, Pencil, Check, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FIELD, BTN_PRIMARY, BTN_SECONDARY, TAB, TAB_ON, TAB_OFF, ROW_TILE } from './dialogStyles'
import { useRundownData } from './RundownDataContext'
import { addMention, updateMention, deleteMention } from '@/app/actions/mentions'
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

  // Inline editing of an existing mention
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

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

  function startEditMention(m: Mention) {
    setEditId(m.id)
    setEditName(m.name)
    setEditDesc(m.description ?? '')
  }

  function cancelEditMention() {
    setEditId(null)
    setEditName('')
    setEditDesc('')
  }

  async function handleSaveMentionEdit(id: string) {
    const name = editName.trim()
    if (!name) return toast.error('Name is required')
    const description = editDesc.trim() || null
    setSavingEdit(true)
    const res = await updateMention(id, rundownId, { name, description })
    setSavingEdit(false)
    if (res.error) return toast.error(res.error)
    setMentions((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name, description } : m)).sort(byName)
    )
    cancelEditMention()
  }

  async function handleDeleteMention(id: string) {
    if (editId === id) cancelEditMention()
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
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-lg p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle>Mentions &amp; Variables</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 px-5 border-b border-[#1d1d24]">
          <button onClick={() => setTab('mentions')} className={cn(TAB, tab === 'mentions' ? TAB_ON : TAB_OFF)}>
            <AtSign className="w-3.5 h-3.5" />
            Mentions
            <span className="text-[#5a5c66]">({mentions.length})</span>
          </button>
          <button onClick={() => setTab('variables')} className={cn(TAB, tab === 'variables' ? TAB_ON : TAB_OFF)}>
            <DollarSign className="w-3.5 h-3.5" />
            Variables
            <span className="text-[#5a5c66]">({variables.length})</span>
          </button>
        </div>

        {tab === 'mentions' && (
          <div className="space-y-4 p-5">
            <p className="text-xs text-[#888b96]">
              Reusable references. Type <span className="text-[#5aa0e6]">@</span> in
              any cell to insert one; editing here updates every instance.
            </p>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {mentions.length === 0 && (
                <p className="text-sm text-[#5a5c66] italic py-2">No mentions yet</p>
              )}
              {mentions.map((m) =>
                editId === m.id ? (
                  <div key={m.id} className={cn('flex flex-col gap-2', ROW_TILE)}>
                    <input
                      data-testid="edit-mention-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      autoFocus
                      className={FIELD}
                      onKeyDown={(e) => { if (e.key === 'Escape') cancelEditMention() }}
                    />
                    <textarea
                      data-testid="edit-mention-desc"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      placeholder="Description (optional)"
                      className={cn(FIELD, 'resize-none')}
                      onKeyDown={(e) => { if (e.key === 'Escape') cancelEditMention() }}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEditMention} className={cn(BTN_SECONDARY, 'px-3 py-1.5')}>
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button
                        data-testid="save-mention-edit"
                        onClick={() => handleSaveMentionEdit(m.id)}
                        disabled={savingEdit || !editName.trim()}
                        className={cn(BTN_PRIMARY, 'px-3 py-1.5')}
                      >
                        <Check className="w-3.5 h-3.5" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className={cn('group flex items-start gap-2', ROW_TILE)}>
                    <span className="text-[#5aa0e6] text-sm mt-0.5">@</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#eef0f3] truncate">{m.name}</p>
                      {m.description && (
                        <p className="text-xs text-[#888b96] truncate">{m.description}</p>
                      )}
                    </div>
                    <button
                      data-testid="edit-mention-btn"
                      onClick={() => startEditMention(m)}
                      title="Edit mention"
                      className="opacity-0 group-hover:opacity-100 text-[#5a5c66] hover:text-[#c8c9d0] transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMention(m.id)}
                      title="Delete mention"
                      className="opacity-0 group-hover:opacity-100 text-[#5a5c66] hover:text-[#ff5a73] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="space-y-2 border-t border-[#1d1d24] pt-3">
              <input
                data-testid="new-mention-name"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="Name (e.g. Camera 1, Host bio)"
                className={FIELD}
              />
              <textarea
                data-testid="new-mention-desc"
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                rows={2}
                placeholder="Description (optional)"
                className={cn(FIELD, 'resize-none')}
              />
              <button data-testid="add-mention-btn" onClick={handleAddMention} disabled={savingM || !mName.trim()} className={BTN_PRIMARY}>
                <Plus className="w-4 h-4" /> Add mention
              </button>
            </div>
          </div>
        )}

        {tab === 'variables' && (
          <div className="space-y-4 p-5">
            <p className="text-xs text-[#888b96]">
              Reusable values. Type <span className="text-[#18d986]">$</span> in any
              cell to insert one; changing a value updates everywhere live.
            </p>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {variables.length === 0 && (
                <p className="text-sm text-[#5a5c66] italic py-2">No variables yet</p>
              )}
              {variables.map((v) => (
                <div key={v.id} className={cn('group flex items-center gap-2', ROW_TILE, 'py-1.5')}>
                  <span className="text-[#18d986] font-mono text-xs shrink-0">${v.key}</span>
                  <input
                    data-testid={`var-value-${v.key}`}
                    defaultValue={v.value}
                    onBlur={(e) => handleUpdateVariableValue(v, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                    placeholder="value"
                    className={cn(FIELD, 'flex-1 h-7 py-1')}
                  />
                  <button
                    onClick={() => handleDeleteVariable(v.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#5a5c66] hover:text-[#ff5a73] transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-[#1d1d24] pt-3">
              <div className="flex gap-2">
                <input data-testid="new-variable-key" value={vKey} onChange={(e) => setVKey(e.target.value)} placeholder="key" className={FIELD} />
                <input
                  data-testid="new-variable-value"
                  value={vValue}
                  onChange={(e) => setVValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddVariable() }}
                  placeholder="value"
                  className={FIELD}
                />
              </div>
              {vKey && (
                <p className="text-xs text-[#888b96]">
                  Will be saved as <span className="text-[#18d986] font-mono">${keyPreview}</span>
                </p>
              )}
              <button data-testid="add-variable-btn" onClick={handleAddVariable} disabled={savingV || !normalizeKey(vKey)} className={BTN_PRIMARY}>
                <Plus className="w-4 h-4" /> Add variable
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
