'use client'

import { useCallback } from 'react'
import { useRundownData } from './RundownDataContext'
import { RichNoteCell } from './RichNoteCell'

interface PrivateNoteCellProps {
  cueId: string
  value: string
  onChange: (cueId: string, content: string) => void
}

export function PrivateNoteCell({ cueId, value, onChange }: PrivateNoteCellProps) {
  const { actions } = useRundownData()
  const handleSave = useCallback(
    (html: string) => {
      onChange(cueId, html)
      actions.upsertPrivateNote(cueId, html)
    },
    [cueId, onChange, actions]
  )

  return <RichNoteCell value={value} onSave={handleSave} textColor="#c8c9d0" testId="private-note-cell" />
}
