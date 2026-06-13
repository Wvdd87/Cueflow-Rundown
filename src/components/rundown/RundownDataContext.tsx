'use client'

import { createContext, useContext } from 'react'
import type { Mention, Variable } from '@/lib/supabase/types'

interface RundownDataValue {
  rundownId: string
  mentions: Mention[]
  variables: Variable[]
  setMentions: React.Dispatch<React.SetStateAction<Mention[]>>
  setVariables: React.Dispatch<React.SetStateAction<Variable[]>>
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
