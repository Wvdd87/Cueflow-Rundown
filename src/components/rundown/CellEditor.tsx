'use client'

import { useState, useRef, useEffect } from 'react'
import { upsertCell } from '@/app/actions/cues'

interface CellEditorProps {
  cueId: string
  columnId: string
  rundownId: string
  initialContent: string
  onContentChange: (cueId: string, columnId: string, content: string) => void
}

export function CellEditor({
  cueId,
  columnId,
  rundownId,
  initialContent,
  onContentChange,
}: CellEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(initialContent)
  }, [initialContent])

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.focus()
    }
  }, [editing])

  async function save() {
    setEditing(false)
    if (value === initialContent) return
    onContentChange(cueId, columnId, value)
    await upsertCell(cueId, columnId, value, rundownId)
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          const el = e.target
          el.style.height = 'auto'
          el.style.height = el.scrollHeight + 'px'
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setEditing(false); setValue(initialContent) }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
        }}
        className="w-full min-h-[28px] resize-none bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-zinc-500"
        rows={1}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="w-full min-h-[28px] px-2 py-1 text-sm text-zinc-300 cursor-text hover:bg-zinc-800/50 rounded whitespace-pre-wrap break-words"
    >
      {value || <span className="text-zinc-700 italic">—</span>}
    </div>
  )
}
