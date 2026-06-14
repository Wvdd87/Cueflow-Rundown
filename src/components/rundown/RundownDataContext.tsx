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

interface RundownDataValue {
  rundownId: string
  mentions: Mention[]
  variables: Variable[]
  setMentions: React.Dispatch<React.SetStateAction<Mention[]>>
  setVariables: React.Dispatch<React.SetStateAction<Variable[]>>
  rundownSettings: RundownSettings
  onSaveSettings: (s: Partial<RundownSettings>) => void
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
