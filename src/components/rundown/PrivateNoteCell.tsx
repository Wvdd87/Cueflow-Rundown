'use client'

import { useCallback } from 'react'
import { upsertPrivateNote } from '@/app/actions/privateNotes'
import { RichNoteCell } from './RichNoteCell'

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
  const handleSave = useCallback(
    (html: string) => {
      onChange(cueId, html)
      upsertPrivateNote(cueId, rundownId, html)
    },
    [cueId, rundownId, onChange]
  )

  return (
    <RichNoteCell
      value={value}
      onSave={handleSave}
      textColor="#c8c9d0"
      testId="private-note-cell"
    />
  )
}
