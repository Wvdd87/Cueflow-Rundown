'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { createRundown } from '@/app/actions/rundowns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Event, Rundown } from '@/lib/supabase/types'

interface CreateRundownDialogProps {
  events: Event[]
  templates?: Rundown[]
  defaultEventId?: string
  isTemplate?: boolean
  trigger?: React.ReactNode
}

const FIELD =
  'w-full bg-[#16161c] border border-[#2e2e38] px-2.5 py-2 text-sm text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]'
const FIELD_LABEL = 'block font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ba0ab] mb-1.5'

export function CreateRundownDialog({
  events,
  templates = [],
  defaultEventId,
  isTemplate = false,
  trigger,
}: CreateRundownDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createRundown(formData)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
      formRef.current?.reset()
    }
  }

  const defaultTrigger = (
    <button className="inline-flex items-center gap-2 h-9 px-4 font-cond text-[11px] font-bold uppercase tracking-[0.14em] bg-[#111116] text-[#c8c9d0] border border-[#22222a] hover:border-[#3a3a48] hover:bg-[#16161c] cursor-pointer transition-colors">
      <Plus className="w-4 h-4" />
      New {isTemplate ? 'template' : 'rundown'}
    </button>
  )

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? defaultTrigger}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-md p-0 gap-0 border-t-2 border-t-[#f0a838]">
          <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
            <DialogTitle className="text-base font-semibold text-[#eef0f3]">
              Create {isTemplate ? 'template' : 'rundown'}
            </DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="p-5 space-y-4">
            <input type="hidden" name="is_template" value={String(isTemplate)} />
            {defaultEventId && <input type="hidden" name="event_id" value={defaultEventId} />}

            <div>
              <label htmlFor="rundown-name" className={FIELD_LABEL}>Name</label>
              <input
                id="rundown-name"
                name="name"
                required
                autoFocus
                placeholder={isTemplate ? 'Weekly Broadcast Template' : 'Morning Show Rundown'}
                className={FIELD}
              />
            </div>

            {!isTemplate && templates.length > 0 && (
              <div>
                <label htmlFor="template-select" className={FIELD_LABEL}>
                  Start from <span className="text-[#5a5c66] normal-case tracking-normal">(optional)</span>
                </label>
                <select id="template-select" name="template_id" className={FIELD}>
                  <option value="">Blank rundown</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!defaultEventId && events.length > 0 && (
              <div>
                <label htmlFor="event-select" className={FIELD_LABEL}>
                  Add to event <span className="text-[#5a5c66] normal-case tracking-normal">(optional)</span>
                </label>
                <select id="event-select" name="event_id" className={FIELD}>
                  <option value="">No event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-[#ff5a73]">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-transparent text-[#9ba0ab] border border-[#2e2e38] hover:text-[#eef0f3] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
