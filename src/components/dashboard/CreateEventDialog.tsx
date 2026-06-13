'use client'

import { useState, useRef } from 'react'
import { FolderPlus } from 'lucide-react'
import { createEvent } from '@/app/actions/events'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateEventDialogProps {
  trigger?: React.ReactNode
}

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
    <Button size="sm" variant="outline" className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
      <FolderPlus className="w-4 h-4" />
      New event
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
            <DialogTitle>Create event</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-name" className="text-zinc-300 text-sm">Event name</Label>
              <Input
                id="event-name"
                name="name"
                required
                autoFocus
                placeholder="Summer Conference 2026"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600"
              />
            </div>

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
                {loading ? 'Creating…' : 'Create event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
