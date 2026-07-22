'use client'

import { createContext, useContext } from 'react'
import type { Mention, Variable } from '@/lib/supabase/types'
import type { TimeDisplay } from '@/lib/timing'

export interface RundownSettings {
  time_display: TimeDisplay
  cue_number_prefix: string
  cue_number_start: number
  cue_number_digits: number
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface RundownDataValue {
  rundownId: string
  mentions: Mention[]
  variables: Variable[]
  setMentions: React.Dispatch<React.SetStateAction<Mention[]>>
  setVariables: React.Dispatch<React.SetStateAction<Variable[]>>
  rundownSettings: RundownSettings
  onSaveSettings: (s: Partial<RundownSettings>) => void
  saveStatus: SaveStatus
  /** Wraps an in-flight save so the toolbar's autosave indicator reflects it. */
  trackSave: <T>(promise: Promise<T>) => Promise<T>
}

const RundownDataContext = createContext<RundownDataValue | null>(null)

export const RundownDataProvider = RundownDataContext.Provider

export function useRundownData(): RundownDataValue {
  const ctx = useContext(RundownDataContext)
  if (!ctx) {
    throw new Error('useRundownData must be used within RundownDataProvider')
  }
  return ctx
}
