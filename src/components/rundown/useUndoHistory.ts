import { useRef, useState, useCallback } from 'react'

export interface HistoryEntry {
  label: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

const MAX = 50

export function useUndoHistory() {
  // version bump is used only to force re-render when stacks change
  const [, setV] = useState(0)
  const undoStack = useRef<HistoryEntry[]>([])
  const redoStack = useRef<HistoryEntry[]>([])
  const bump = () => setV((v) => v + 1)

  const push = useCallback((entry: HistoryEntry) => {
    if (undoStack.current.length >= MAX) undoStack.current.shift()
    undoStack.current.push(entry)
    redoStack.current = []
    bump()
  }, [])

  const undo = useCallback(async (): Promise<string | null> => {
    const entry = undoStack.current.pop()
    if (!entry) return null
    await entry.undo()
    redoStack.current.push(entry)
    bump()
    return entry.label
  }, [])

  const redo = useCallback(async (): Promise<string | null> => {
    const entry = redoStack.current.pop()
    if (!entry) return null
    await entry.redo()
    undoStack.current.push(entry)
    bump()
    return entry.label
  }, [])

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    undoLabel: undoStack.current.at(-1)?.label,
    redoLabel: redoStack.current.at(-1)?.label,
  }
}
