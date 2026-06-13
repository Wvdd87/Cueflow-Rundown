'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { createRundown } from '@/app/actions/rundowns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Event, Rundown } from '@/lib/supabase/types'

interface CreateRundownDialogProps {
  events: Event[]
  templates?: Rundown[]
  defaultEventId?: string
  isTemplate?: boolean
  trigger?: React.ReactNode
}

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
    <Button size="sm" className="gap-1.5 bg-white text-zinc-900 hover:bg-zinc-100">
      <Plus className="w-4 h-4" />
      New {isTemplate ? 'template' : 'rundown'}
    </Button>
  )

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? defaultTrigger}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create {isTemplate ? 'template' : 'rundown'}</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4 mt-2">
            <input type="hidden" name="is_template" value={String(isTemplate)} />
            {defaultEventId && (
              <input type="hidden" name="event_id" value={defaultEventId} />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rundown-name" className="text-zinc-300 text-sm">Name</Label>
              <Input
                id="rundown-name"
                name="name"
                required
                autoFocus
                placeholder={isTemplate ? 'Weekly Broadcast Template' : 'Morning Show Rundown'}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600"
              />
            </div>

            {!isTemplate && templates.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="template-select" className="text-zinc-300 text-sm">
                  Start from <span className="text-zinc-500">(optional)</span>
                </Label>
                <select
                  id="template-select"
                  name="template_id"
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                >
                  <option value="">Blank rundown</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!defaultEventId && events.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="event-select" className="text-zinc-300 text-sm">
                  Add to event <span className="text-zinc-500">(optional)</span>
                </Label>
                <select
                  id="event-select"
                  name="event_id"
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                >
                  <option value="">No event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-white text-zinc-900 hover:bg-zinc-100"
              >
                {loading ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
