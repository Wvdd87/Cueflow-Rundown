'use client'

import { useState, useEffect } from 'react'
import { Clock, Hash } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRundownData } from './RundownDataContext'
import { updateRundownSettings } from '@/app/actions/rundowns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCueNumber } from './cueTree'
import type { TimeDisplay } from '@/lib/timing'

interface RundownSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: 'display' | 'numbering'
}

const TIME_OPTIONS: { value: TimeDisplay; label: string; example: string }[] = [
  { value: 'auto',        label: 'Auto (24 hour)',       example: '13:30:10' },
  { value: '24h',         label: '24 hour',              example: '13:30:10' },
  { value: '12h',         label: '12 hour AM/PM',        example: '1:30:10 PM' },
  { value: '12h_no_ampm', label: '12 hour (no AM/PM)',   example: '1:30:10' },
]

export function RundownSettingsDialog({
  open,
  onOpenChange,
  initialTab = 'display',
}: RundownSettingsDialogProps) {
  const { rundownId, rundownSettings, onSaveSettings } = useRundownData()
  const [tab, setTab] = useState<'display' | 'numbering'>(initialTab)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>(rundownSettings.time_display)
  const [savingDisplay, setSavingDisplay] = useState(false)

  const [numPrefix, setNumPrefix] = useState(rundownSettings.cue_number_prefix)
  const [numStart, setNumStart] = useState(String(rundownSettings.cue_number_start))
  const [numDigits, setNumDigits] = useState(String(rundownSettings.cue_number_digits))
  const [savingNum, setSavingNum] = useState(false)

  useEffect(() => {
    if (open) {
      setTimeDisplay(rundownSettings.time_display)
      setNumPrefix(rundownSettings.cue_number_prefix)
      setNumStart(String(rundownSettings.cue_number_start))
      setNumDigits(String(rundownSettings.cue_number_digits))
    }
  }, [open, rundownSettings])

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

  const previewStart = parseInt(numStart, 10) || 1
  const previewDigits = Math.max(1, Math.min(6, parseInt(numDigits, 10) || 1))
  const previewNumbers = ['1', '2', '2.1', '3'].map((raw) =>
    formatCueNumber(raw, numPrefix, previewStart, previewDigits)
  )

  const tabs: { id: typeof tab; label: string; icon: React.ReactNode }[] = [
    { id: 'display', label: 'Display', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'numbering', label: 'Numbering', icon: <Hash className="w-3.5 h-3.5" /> },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rundown settings</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-zinc-800 -mx-1 px-1">
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
            </button>
          ))}
        </div>

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
