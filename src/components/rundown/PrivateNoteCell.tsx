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
        className="w-full min-h-[28px] resize-none bg-[#0a0a0d] border border-[#f0a838] px-2 py-1 text-[13px] text-[#eef0f3] outline-none"
      />
    )
  }

  return (
    <div
      data-testid="private-note-cell"
      onClick={() => setEditing(true)}
      className="w-full min-h-[28px] px-2 py-1 text-[13px] cursor-text whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-[1.4]"
      style={{ color: value ? '#c8c9d0' : '#5a5c66', fontStyle: value ? 'normal' : 'italic' }}
    >
      {value || 'Private note…'}
    </div>
  )
}
