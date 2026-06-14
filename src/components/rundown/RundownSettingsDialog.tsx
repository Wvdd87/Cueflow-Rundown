'use client'

import { useState, useEffect } from 'react'
import { AtSign, DollarSign, Trash2, Plus, Clock, Hash } from 'lucide-react'
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
import { updateRundownSettings } from '@/app/actions/rundowns'
import { normalizeKey } from '@/lib/variables'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCueNumber } from './cueTree'
import type { Mention, Variable } from '@/lib/supabase/types'
import type { TimeDisplay } from '@/lib/timing'

interface RundownSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: 'mentions' | 'variables' | 'display' | 'numbering'
}

const byName = (a: Mention, b: Mention) => a.name.localeCompare(b.name)
const byKey = (a: Variable, b: Variable) => a.key.localeCompare(b.key)

const TIME_OPTIONS: { value: TimeDisplay; label: string; example: string }[] = [
  { value: 'auto',        label: 'Auto (24 hour)',       example: '13:30:10' },
  { value: '24h',         label: '24 hour',              example: '13:30:10' },
  { value: '12h',         label: '12 hour AM/PM',        example: '1:30:10 PM' },
  { value: '12h_no_ampm', label: '12 hour (no AM/PM)',   example: '1:30:10' },
]

export function RundownSettingsDialog({
  open,
  onOpenChange,
  initialTab = 'mentions',
}: RundownSettingsDialogProps) {
  const { rundownId, mentions, variables, setMentions, setVariables, rundownSettings, onSaveSettings } =
    useRundownData()
  const [tab, setTab] = useState<'mentions' | 'variables' | 'display' | 'numbering'>(initialTab)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  // mention form
  const [mName, setMName] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [savingM, setSavingM] = useState(false)

  // variable form
  const [vKey, setVKey] = useState('')
  const [vValue, setVValue] = useState('')
  const [savingV, setSavingV] = useState(false)

  // display settings (local draft)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>(rundownSettings.time_display)
  const [savingDisplay, setSavingDisplay] = useState(false)

  // numbering settings (local draft)
  const [numPrefix, setNumPrefix] = useState(rundownSettings.cue_number_prefix)
  const [numStart, setNumStart] = useState(String(rundownSettings.cue_number_start))
  const [numDigits, setNumDigits] = useState(String(rundownSettings.cue_number_digits))
  const [savingNum, setSavingNum] = useState(false)

  // reset drafts when dialog opens so they reflect saved values
  useEffect(() => {
    if (open) {
      setTimeDisplay(rundownSettings.time_display)
      setNumPrefix(rundownSettings.cue_number_prefix)
      setNumStart(String(rundownSettings.cue_number_start))
      setNumDigits(String(rundownSettings.cue_number_digits))
    }
  }, [open, rundownSettings])

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

  async function handleSaveDisplay() {
    setSavingDisplay(true)
    const res = await updateRundownSettings(rundownId, { time_display: timeDisplay })
    setSavingDisplay(false)
    if (res.error) return toast.error(res.error)
    onSaveSettings({ time_display: timeDisplay })
    toast.success('Display settings saved')
  }

  async function handleSaveNumbering() {
    const start = parseInt(numStart, 10)
    const digits = parseInt(numDigits, 10)
    if (isNaN(start)) return toast.error('Start must be a number')
    if (isNaN(digits) || digits < 1 || digits > 6) return toast.error('Digits must be 1–6')
    setSavingNum(true)
    const res = await updateRundownSettings(rundownId, {
      cue_number_prefix: numPrefix,
      cue_number_start: start,
      cue_number_digits: digits,
    })
    setSavingNum(false)
    if (res.error) return toast.error(res.error)
    onSaveSettings({ cue_number_prefix: numPrefix, cue_number_start: start, cue_number_digits: digits })
    toast.success('Numbering settings saved')
  }

  const keyPreview = normalizeKey(vKey)

  // Live numbering preview
  const previewStart = parseInt(numStart, 10) || 1
  const previewDigits = Math.max(1, Math.min(6, parseInt(numDigits, 10) || 1))
  const previewNumbers = ['1', '2', '2.1', '3'].map((raw) =>
    formatCueNumber(raw, numPrefix, previewStart, previewDigits)
  )

  const tabs: { id: typeof tab; label: string; icon: React.ReactNode }[] = [
    { id: 'mentions', label: 'Mentions', icon: <AtSign className="w-3.5 h-3.5" /> },
    { id: 'variables', label: 'Variables', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'display', label: 'Display', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'numbering', label: 'Numbering', icon: <Hash className="w-3.5 h-3.5" /> },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rundown settings</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800 -mx-1 px-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
                tab === t.id
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t.icon}
              {t.label}
              {t.id === 'mentions' && (
                <span className="text-xs text-zinc-600">({mentions.length})</span>
              )}
              {t.id === 'variables' && (
                <span className="text-xs text-zinc-600">({variables.length})</span>
              )}
            </button>
          ))}
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

        {tab === 'display' && (
          <div className="space-y-4 mt-1">
            <p className="text-xs text-zinc-500">
              Choose how start times are displayed in the rundown.
            </p>

            <div className="space-y-2">
              {TIME_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 rounded-md bg-zinc-800/50 px-3 py-2.5 cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  <input
                    type="radio"
                    name="time_display"
                    value={opt.value}
                    checked={timeDisplay === opt.value}
                    onChange={() => setTimeDisplay(opt.value)}
                    className="accent-white"
                    data-testid={`time-display-${opt.value}`}
                  />
                  <span className="flex-1 text-sm text-white">{opt.label}</span>
                  <span className="text-xs font-mono text-zinc-400">{opt.example}</span>
                </label>
              ))}
            </div>

            <Button
              data-testid="save-display-btn"
              onClick={handleSaveDisplay}
              disabled={savingDisplay}
              className="bg-white text-zinc-900 hover:bg-zinc-100"
            >
              {savingDisplay ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}

        {tab === 'numbering' && (
          <div className="space-y-4 mt-1">
            <p className="text-xs text-zinc-500">
              Customise how cue numbers appear in the rundown.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Prefix</label>
                <Input
                  data-testid="cue-number-prefix"
                  value={numPrefix}
                  onChange={(e) => setNumPrefix(e.target.value)}
                  placeholder="e.g. A-"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Start from</label>
                <Input
                  data-testid="cue-number-start"
                  type="number"
                  min={0}
                  value={numStart}
                  onChange={(e) => setNumStart(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Digits</label>
                <Input
                  data-testid="cue-number-digits"
                  type="number"
                  min={1}
                  max={6}
                  value={numDigits}
                  onChange={(e) => setNumDigits(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
            </div>

            <div className="rounded-md bg-zinc-800/50 px-3 py-2.5 space-y-1">
              <p className="text-xs text-zinc-500">Preview</p>
              <p className="text-sm font-mono text-white" data-testid="numbering-preview">
                {previewNumbers.join(', ')}
              </p>
            </div>

            <Button
              data-testid="save-numbering-btn"
              onClick={handleSaveNumbering}
              disabled={savingNum}
              className="bg-white text-zinc-900 hover:bg-zinc-100"
            >
              {savingNum ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
