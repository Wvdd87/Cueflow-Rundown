'use client'

import { useState, useRef, useEffect } from 'react'
import { upsertPrivateNote } from '@/app/actions/privateNotes'

interface PrivateNoteCellProps {
  cueId: string
  rundownId: string
  value: string
  onChange: (cueId: string, content: string) => void
}

export function PrivateNoteCell({
  cueId,
  rundownId,
  value,
  onChange,
}: PrivateNoteCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.focus()
    }
  }, [editing])

  async function save() {
    setEditing(false)
    if (draft === value) return
    onChange(cueId, draft)
    await upsertPrivateNote(cueId, rundownId, draft)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const el = e.target
          el.style.height = 'auto'
          el.style.height = el.scrollHeight + 'px'
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
        }}
        rows={1}
        className="w-full min-h-[28px] resize-none bg-amber-950/30 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-100 outline-none focus:ring-1 focus:ring-amber-600/50"
      />
    )
  }

  return (
    <div
      data-testid="private-note-cell"
      onClick={() => setEditing(true)}
      className="w-full min-h-[28px] px-2 py-1 text-sm text-amber-200/80 cursor-text hover:bg-amber-950/20 rounded whitespace-pre-wrap break-words"
    >
      {value || <span className="text-zinc-700 italic">—</span>}
    </div>
  )
}
