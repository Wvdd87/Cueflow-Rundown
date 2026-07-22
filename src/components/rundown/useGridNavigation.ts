'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PRIVATE_NOTES_ID } from './layout'
import type { Cue, Column } from '@/lib/supabase/types'

export interface FocusedCell {
  cueId: string
  colId: string
}

interface UseGridNavigationArgs {
  cues: Cue[]
  visibleColumns: Column[]
  titleIndex: number
  privateNotesIndex: number
  /** Visible row ids (cues + headings) in on-screen document order. */
  renderableIds: string[]
  collapsedGroups: Set<string>
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>
  /** Adds a cue directly below the given row and returns focus to it. */
  onAddCueBelow: (cueId: string) => void
  /** Adds a cue at the very end of the rundown (used when Shift+Enter falls off the last row). */
  onAddCueAtEnd: () => void
}

const cellSelector = (cueId: string, colId: string) =>
  `[data-row-id="${CSS.escape(cueId)}"][data-col-id="${CSS.escape(colId)}"]`

/** Grid keyboard navigation for the cue table: focus mode (arrow keys move a
 *  cell cursor) and edit mode (Tab/Shift+Enter confirm the open editor and
 *  advance). See todo #61 for the full behavior spec. */
export function useGridNavigation({
  cues,
  visibleColumns,
  titleIndex,
  privateNotesIndex,
  renderableIds,
  collapsedGroups,
  setCollapsedGroups,
  onAddCueBelow,
  onAddCueAtEnd,
}: UseGridNavigationArgs) {
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null)

  const cuesRef = useRef(cues)
  cuesRef.current = cues
  const renderableIdsRef = useRef(renderableIds)
  renderableIdsRef.current = renderableIds
  const columnsRef = useRef({ visibleColumns, titleIndex, privateNotesIndex })
  columnsRef.current = { visibleColumns, titleIndex, privateNotesIndex }

  const getRowColumns = useCallback((cue: Cue): string[] => {
    if (cue.cue_type === 'heading') return ['title']
    const { visibleColumns: cols, titleIndex: ti, privateNotesIndex: pni } = columnsRef.current
    const left = cols.slice(0, ti).map((c) => c.id)
    const rightCols = cols.slice(ti)
    const pnInRight = Math.max(0, pni - ti)
    const insertAt = Math.min(Math.max(0, pnInRight), rightCols.length)
    const rightIds = rightCols.map((c) => c.id)
    rightIds.splice(insertAt, 0, PRIVATE_NOTES_ID)
    return ['start', 'dur', ...left, 'title', ...rightIds]
  }, [])

  const expandIfCollapsedHeading = useCallback((cue: Cue) => {
    if (cue.cue_type === 'heading' && collapsedGroups.has(cue.id)) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev)
        next.delete(cue.id)
        return next
      })
    }
  }, [collapsedGroups, setCollapsedGroups])

  const focusCell = useCallback((cueId: string, colId: string) => {
    setFocusedCell({ cueId, colId })
  }, [])

  const clearFocus = useCallback(() => setFocusedCell(null), [])

  const moveHorizontal = useCallback((delta: 1 | -1) => {
    setFocusedCell((current) => {
      if (!current) return current
      const ids = renderableIdsRef.current
      const rowIdx = ids.indexOf(current.cueId)
      const cue = cuesRef.current.find((c) => c.id === current.cueId)
      if (rowIdx < 0 || !cue) return current
      const cols = getRowColumns(cue)
      const colIdx = cols.indexOf(current.colId) + delta

      if (colIdx < 0) {
        const prevId = ids[rowIdx - 1]
        const prevCue = prevId ? cuesRef.current.find((c) => c.id === prevId) : undefined
        if (!prevCue) return current
        const prevCols = getRowColumns(prevCue)
        return { cueId: prevCue.id, colId: prevCols[prevCols.length - 1] }
      }
      if (colIdx >= cols.length) {
        const nextId = ids[rowIdx + 1]
        const nextCue = nextId ? cuesRef.current.find((c) => c.id === nextId) : undefined
        if (!nextCue) return current
        expandIfCollapsedHeading(nextCue)
        return { cueId: nextCue.id, colId: getRowColumns(nextCue)[0] }
      }
      return { cueId: cue.id, colId: cols[colIdx] }
    })
  }, [getRowColumns, expandIfCollapsedHeading])

  const moveVertical = useCallback((delta: 1 | -1): boolean => {
    let hitEdge = false
    setFocusedCell((current) => {
      if (!current) return current
      const ids = renderableIdsRef.current
      const rowIdx = ids.indexOf(current.cueId)
      if (rowIdx < 0) return current
      const nextRowIdx = rowIdx + delta
      if (nextRowIdx < 0 || nextRowIdx >= ids.length) {
        hitEdge = true
        return current
      }
      const nextCue = cuesRef.current.find((c) => c.id === ids[nextRowIdx])
      if (!nextCue) return current
      expandIfCollapsedHeading(nextCue)
      const cols = getRowColumns(nextCue)
      const colId = cols.includes(current.colId) ? current.colId : 'title'
      return { cueId: nextCue.id, colId }
    })
    return hitEdge
  }, [getRowColumns, expandIfCollapsedHeading])

  /** Clicks the focused cell's edit-trigger element (see data-cell-trigger). */
  const openFocusedCell = useCallback(() => {
    if (!focusedCell) return
    const wrapper = document.querySelector(cellSelector(focusedCell.cueId, focusedCell.colId))
    const trigger = (wrapper?.querySelector('[data-cell-trigger]') ?? wrapper) as HTMLElement | null
    trigger?.click()
  }, [focusedCell])

  /** Confirms whatever cell is currently being edited (blur for native inputs,
   *  a synthetic outside-click for the TipTap-based cells, which all save on
   *  click-away). Safe to call even if nothing is being edited. */
  const confirmEditing = useCallback(() => {
    const active = document.activeElement as HTMLElement | null
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur()
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
  }, [])

  const isEditingFocusedCell = useCallback((): boolean => {
    if (!focusedCell) return false
    const active = document.activeElement as HTMLElement | null
    if (!active) return false
    const editable =
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    if (!editable) return false
    const wrapper = document.querySelector(cellSelector(focusedCell.cueId, focusedCell.colId))
    return !!wrapper && wrapper.contains(active)
  }, [focusedCell])

  // Global keydown handler — bails out whenever a dialog/menu owns the keyboard,
  // or the user isn't interacting with the cue grid at all.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (document.querySelector('[data-slot="dialog-content"]')) return
      if (document.querySelector('[data-slot="dropdown-menu-content"]')) return

      const active = document.activeElement as HTMLElement | null
      const withinGrid = !!active?.closest('[data-cue-scroll]')
      if (!focusedCell && !withinGrid) return
      // A text input elsewhere on the page (rename box, search, dialogs not yet
      // portalled) should never be hijacked by grid shortcuts.
      if (!focusedCell && active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return

      const editing = isEditingFocusedCell()

      if (!editing) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && focusedCell) {
          e.preventDefault()
          onAddCueBelow(focusedCell.cueId)
          return
        }
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault(); moveVertical(-1); return
          case 'ArrowDown':
            e.preventDefault(); moveVertical(1); return
          case 'ArrowLeft':
            e.preventDefault(); moveHorizontal(-1); return
          case 'ArrowRight':
            e.preventDefault(); moveHorizontal(1); return
          case 'Tab':
            if (!focusedCell) return
            e.preventDefault(); moveHorizontal(e.shiftKey ? -1 : 1); return
          case 'Enter':
          case ' ':
            if (!focusedCell) return
            e.preventDefault(); openFocusedCell(); return
          case 'Escape':
            if (!focusedCell) return
            e.preventDefault(); clearFocus(); return
        }
        return
      }

      // Edit mode
      if (e.key === 'Tab') {
        e.preventDefault()
        confirmEditing()
        moveHorizontal(e.shiftKey ? -1 : 1)
        return
      }
      // Plain Enter confirms and advances to the same column, next row (creating
      // a new cue past the last row). Shift+Enter is left alone — it's the
      // multiline fields' own newline shortcut, not a navigation key.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        confirmEditing()
        const atBottom = moveVertical(1)
        if (atBottom) onAddCueAtEnd()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    focusedCell,
    isEditingFocusedCell,
    moveVertical,
    moveHorizontal,
    openFocusedCell,
    clearFocus,
    confirmEditing,
    onAddCueBelow,
    onAddCueAtEnd,
  ])

  // Keep the focused cell scrolled into view.
  useEffect(() => {
    if (!focusedCell) return
    const el = document.querySelector(cellSelector(focusedCell.cueId, focusedCell.colId))
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedCell])

  return { focusedCell, focusCell, clearFocus, getRowColumns }
}
