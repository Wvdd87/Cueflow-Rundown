'use client'

import { useCallback, useRef, useState } from 'react'
import type { SaveStatus } from './RundownDataContext'

const SAVED_FLASH_MS = 2000

/** Tracks how many autosave writes are in flight and derives a single
 *  idle → saving → saved → idle status for the toolbar indicator. */
export function useSaveStatus() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const pendingRef = useRef(0)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trackSave = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current)
      savedTimeoutRef.current = null
    }
    pendingRef.current += 1
    setSaveStatus('saving')
    return promise
      .then((result) => {
        pendingRef.current -= 1
        if (pendingRef.current === 0) {
          setSaveStatus('saved')
          savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_FLASH_MS)
        }
        return result
      })
      .catch((err) => {
        pendingRef.current -= 1
        setSaveStatus('error')
        savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_FLASH_MS)
        throw err
      })
  }, [])

  return { saveStatus, trackSave }
}
