'use client'

import { useState, useRef } from 'react'
import { FolderPlus } from 'lucide-react'
import { createEvent } from '@/app/actions/events'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CreateEventDialogProps {
  trigger?: React.ReactNode
}

const FIELD =
  'w-full bg-[#16161c] border border-[#2e2e38] px-2.5 py-2 text-sm text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]'
const FIELD_LABEL = 'block font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ba0ab] mb-1.5'

export function CreateEventDialog({ trigger }: CreateEventDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createEvent(formData)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setOpen(false)
      formRef.current?.reset()
    }
  }

  const defaultTrigger = (
    <button className="inline-flex items-center gap-2 h-9 px-4 font-cond text-[11px] font-bold uppercase tracking-[0.14em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] cursor-pointer transition-colors">
      <FolderPlus className="w-4 h-4" />
      New event
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
            <DialogTitle className="text-base font-semibold text-[#eef0f3]">Create event</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="p-5 space-y-4">
            <div>
              <label htmlFor="event-name" className={FIELD_LABEL}>Event name</label>
              <input id="event-name" name="name" required autoFocus placeholder="Summer Conference 2026" className={FIELD} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-date" className={FIELD_LABEL}>
                  Date <span className="text-[#5a5c66] normal-case tracking-normal">(optional)</span>
                </label>
                <input id="event-date" name="event_date" type="date" className={`${FIELD} [color-scheme:dark]`} />
              </div>
              <div>
                <label htmlFor="event-location" className={FIELD_LABEL}>
                  Location <span className="text-[#5a5c66] normal-case tracking-normal">(optional)</span>
                </label>
                <input id="event-location" name="location" placeholder="Amsterdam" className={FIELD} />
              </div>
            </div>

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
                {loading ? 'Creating…' : 'Create event'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
