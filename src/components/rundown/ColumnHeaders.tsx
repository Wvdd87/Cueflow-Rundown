'use client'

import { useState, useRef } from 'react'
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  Check,
  X,
  ListChecks,
  Type,
  GripVertical,
  EyeOff,
  Eye,
  Lock,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addColumn,
  renameColumn,
  deleteColumn,
  updateColumnOptions,
  updateColumnWidth,
  reorderColumns,
} from '@/app/actions/columns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PRIVATE_NOTES_WIDTH, TITLE_COL_WIDTH, PRIVATE_NOTES_ID } from './layout'
import {
  OptionsEditor,
  rowsToOptions,
  optionsToRows,
  type OptionRow,
} from './OptionsEditor'
import { toast } from 'sonner'
import type { Column } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const FIXED_COL_WIDTHS = {
  number: 48,
  startTime: 84,
  duration: 76,
  title: 240,
}
const MIN_COL_WIDTH = 90

interface ColumnHeadersProps {
  columns: Column[]
  visibleColumns: Column[]
  hiddenCount: number
  rundownId: string
  onColumnsChange: (cols: Column[]) => void
  onToggleHide: (id: string) => void
  onUnhideAll: () => void
  privateNotesIndex: number
  onPrivateNotesIndexChange: (idx: number) => void
  titleWidth: number
  onTitleWidthChange: (w: number) => void
}

function buildMergedIds(cols: Column[], pnIdx: number): string[] {
  const ids = cols.map((c) => c.id)
  const insertAt = Math.min(Math.max(0, pnIdx), ids.length)
  ids.splice(insertAt, 0, PRIVATE_NOTES_ID)
  return ids
}

export function ColumnHeaders({
  columns,
  visibleColumns,
  hiddenCount,
  rundownId,
  onColumnsChange,
  onToggleHide,
  onUnhideAll,
  privateNotesIndex,
  onPrivateNotesIndexChange,
  titleWidth,
  onTitleWidthChange,
}: ColumnHeadersProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Add-column dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState<'richtext' | 'dropdown'>('richtext')
  const [addRows, setAddRows] = useState<OptionRow[]>([{ value: '', color: null }])
  const [saving, setSaving] = useState(false)

  // Edit-options dialog
  const [editCol, setEditCol] = useState<Column | null>(null)
  const [editRows, setEditRows] = useState<OptionRow[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  async function handleAddColumn() {
    const name = addName.trim()
    if (!name) return
    setSaving(true)
    const maxPos = columns.reduce((m, c) => Math.max(m, c.position), -1)
    const { options, optionColors } =
      addType === 'dropdown'
        ? rowsToOptions(addRows)
        : { options: null, optionColors: null }
    const result = await addColumn(
      rundownId,
      name,
      maxPos,
      addType,
      options,
      optionColors
    )
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else if (result.column) {
      onColumnsChange([...columns, result.column])
      setAddOpen(false)
      setAddName('')
      setAddType('richtext')
      setAddRows([{ value: '', color: null }])
    }
  }

  async function handleRename(id: string) {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    const result = await renameColumn(id, name, rundownId)
    if (result.error) toast.error(result.error)
    else onColumnsChange(columns.map((c) => c.id === id ? { ...c, name } : c))
    setRenamingId(null)
  }

  async function handleDelete(id: string) {
    const result = await deleteColumn(id, rundownId)
    if (result.error) toast.error(result.error)
    else onColumnsChange(columns.filter((c) => c.id !== id))
  }

  async function handleSaveOptions() {
    if (!editCol) return
    const { options, optionColors } = rowsToOptions(editRows)
    setSaving(true)
    const result = await updateColumnOptions(
      editCol.id,
      options,
      rundownId,
      optionColors
    )
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      onColumnsChange(
        columns.map((c) =>
          c.id === editCol.id
            ? { ...c, options, option_colors: optionColors }
            : c
        )
      )
      setEditCol(null)
    }
  }

  // --- Resize dynamic columns ---
  const resizeRef = useRef<{ id: string; width: number } | null>(null)
  function startResize(e: React.MouseEvent, col: Column) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = col.width
    function onMove(ev: MouseEvent) {
      const width = Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX))
      resizeRef.current = { id: col.id, width }
      onColumnsChange(columns.map((c) => (c.id === col.id ? { ...c, width } : c)))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const r = resizeRef.current
      if (r) updateColumnWidth(r.id, r.width, rundownId)
      resizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Resize title column ---
  function startTitleResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = titleWidth
    function onMove(ev: MouseEvent) {
      onTitleWidthChange(Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX)))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Reorder (drag column headers, including private notes) ---
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const mergedIds = buildMergedIds(visibleColumns, privateNotesIndex)
    const oldIdx = mergedIds.indexOf(active.id as string)
    const newIdx = mergedIds.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return

    const newMergedIds = arrayMove(mergedIds, oldIdx, newIdx)

    // Update private notes position if it moved
    const pnNewIdx = newMergedIds.indexOf(PRIVATE_NOTES_ID)
    if (pnNewIdx !== privateNotesIndex) {
      onPrivateNotesIndexChange(pnNewIdx)
    }

    // Update dynamic column order if it changed
    const newColIds = newMergedIds.filter((id) => id !== PRIVATE_NOTES_ID)
    const oldColIds = visibleColumns.map((c) => c.id)
    if (JSON.stringify(newColIds) !== JSON.stringify(oldColIds)) {
      const hidden = columns.filter((c) => !visibleColumns.some((v) => v.id === c.id))
      const reorderedVisible = newColIds
        .map((id) => visibleColumns.find((c) => c.id === id))
        .filter((c): c is Column => !!c)
      const fullOrder = [...reorderedVisible, ...hidden].map((c, i) => ({ ...c, position: i }))
      onColumnsChange(fullOrder)
      const result = await reorderColumns(rundownId, fullOrder.map((c) => c.id))
      if (result.error) toast.error(result.error)
    }
  }

  return (
    <div className="flex items-stretch border-b border-zinc-800 bg-zinc-900/60 shrink-0 select-none">
      {/* Column 1 (drag / settings / select) placeholder */}
      <div style={{ width: 40 }} className="shrink-0" />

      {/* Cue # */}
      <div
        style={{ width: FIXED_COL_WIDTHS.number }}
        className="shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center"
      >
        #
      </div>

      {/* Start time */}
      <div
        style={{ width: FIXED_COL_WIDTHS.startTime }}
        className="shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center"
      >
        Start
      </div>

      {/* Duration */}
      <div
        style={{ width: FIXED_COL_WIDTHS.duration }}
        className="shrink-0 px-2 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center"
      >
        Dur.
      </div>

      {/* Title — resizable */}
      <div
        style={{ width: titleWidth }}
        className="relative shrink-0 px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider flex items-center"
      >
        Title
        <div
          onMouseDown={startTitleResize}
          title="Drag to resize"
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/60 transition-colors"
        />
      </div>

      {/* Dynamic columns + Private Notes (all sortable together) */}
      <DndContext id="column-headers-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={buildMergedIds(visibleColumns, privateNotesIndex)}
          strategy={horizontalListSortingStrategy}
        >
          {buildMergedIds(visibleColumns, privateNotesIndex).map((id) => {
            if (id === PRIVATE_NOTES_ID) {
              return <SortablePrivateNotesHeader key={PRIVATE_NOTES_ID} />
            }
            const col = visibleColumns.find((c) => c.id === id)
            if (!col) return null
            return (
              <SortableColumnHeader
                key={col.id}
                col={col}
                isRenaming={renamingId === col.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => handleRename(col.id)}
                onRenameCancel={() => setRenamingId(null)}
                onStartRename={() => { setRenamingId(col.id); setRenameValue(col.name) }}
                onEditOptions={() => {
                  setEditCol(col)
                  setEditRows(optionsToRows(col.options, col.option_colors))
                }}
                onHide={() => onToggleHide(col.id)}
                onDelete={() => handleDelete(col.id)}
                onResizeStart={(e) => startResize(e, col)}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      {/* Restore hidden columns */}
      {hiddenCount > 0 && (
        <div className="shrink-0 flex items-center border-l border-zinc-800 px-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onUnhideAll}
            title={`Show ${hiddenCount} hidden column${hiddenCount > 1 ? 's' : ''}`}
            className="text-zinc-500 hover:text-zinc-200"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Add column */}
      <div className="shrink-0 flex items-center border-l border-zinc-800 px-1">
        <span onClick={() => setAddOpen(true)} className="contents">
          <Button
            data-testid="add-column-btn"
            variant="ghost"
            size="icon-sm"
            className="text-zinc-600 hover:text-zinc-300"
            title="Add column"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </span>
      </div>

      {/* Add-column dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Name</Label>
              <Input
                data-testid="column-name"
                autoFocus
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addType === 'richtext') handleAddColumn()
                }}
                placeholder="e.g. Camera, Notes, Status"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="coltype-richtext"
                  onClick={() => setAddType('richtext')}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                    addType === 'richtext'
                      ? 'border-white bg-zinc-800 text-white'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  )}
                >
                  <Type className="w-4 h-4" /> Rich text
                </button>
                <button
                  type="button"
                  data-testid="coltype-dropdown"
                  onClick={() => setAddType('dropdown')}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                    addType === 'dropdown'
                      ? 'border-white bg-zinc-800 text-white'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  )}
                >
                  <ListChecks className="w-4 h-4" /> Dropdown
                </button>
              </div>
            </div>

            {addType === 'dropdown' && (
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm">Options</Label>
                <OptionsEditor rows={addRows} onChange={setAddRows} />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setAddOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                data-testid="add-column-submit"
                onClick={handleAddColumn}
                disabled={saving || !addName.trim()}
                className="bg-white text-zinc-900 hover:bg-zinc-100"
              >
                {saving ? 'Adding…' : 'Add column'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit-options dialog */}
      <Dialog open={!!editCol} onOpenChange={(o) => !o && setEditCol(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit options — {editCol?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Options</Label>
              <OptionsEditor rows={editRows} onChange={setEditRows} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setEditCol(null)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveOptions}
                disabled={saving}
                className="bg-white text-zinc-900 hover:bg-zinc-100"
              >
                {saving ? 'Saving…' : 'Save options'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SortableColumnHeaderProps {
  col: Column
  isRenaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
  onStartRename: () => void
  onEditOptions: () => void
  onHide: () => void
  onDelete: () => void
  onResizeStart: (e: React.MouseEvent) => void
}

function SortableColumnHeader({
  col,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onStartRename,
  onEditOptions,
  onHide,
  onDelete,
  onResizeStart,
}: SortableColumnHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id })

  const style = {
    width: col.width,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/col relative shrink-0 flex items-center border-l border-zinc-800 px-2"
    >
      {isRenaming ? (
        <div className="flex items-center gap-1 w-full">
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit()
              if (e.key === 'Escape') onRenameCancel()
            }}
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-white outline-none"
          />
          <button onClick={onRenameSubmit} className="text-zinc-400 hover:text-white">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={onRenameCancel} className="text-zinc-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <>
          {/* Reorder grip (hover) */}
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder column"
            className="opacity-0 group-hover/col:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing -ml-1 mr-0.5"
          >
            <GripVertical className="w-3 h-3" />
          </button>

          <span className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider truncate flex items-center gap-1">
            {col.col_type === 'dropdown' && (
              <ListChecks className="w-3 h-3 text-zinc-600 shrink-0" />
            )}
            {col.name}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  data-testid="column-menu-btn"
                  className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 rounded text-zinc-500 hover:text-zinc-300"
                />
              }
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 text-zinc-200 w-40">
              <DropdownMenuItem
                onClick={onStartRename}
                className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
              >
                <Pencil className="w-3 h-3" /> Rename
              </DropdownMenuItem>
              {col.col_type === 'dropdown' && (
                <DropdownMenuItem
                  onClick={onEditOptions}
                  className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
                >
                  <ListChecks className="w-3 h-3" /> Edit options
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onHide}
                className="gap-2 text-xs focus:bg-zinc-800 cursor-pointer"
              >
                <EyeOff className="w-3 h-3" /> Hide for me
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-xs text-red-400 focus:bg-zinc-800 focus:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {/* Resize handle on the right edge */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/60 transition-colors"
      />
    </div>
  )
}

function SortablePrivateNotesHeader() {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: PRIVATE_NOTES_ID })

  const style = {
    width: PRIVATE_NOTES_WIDTH,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="shrink-0 flex items-center gap-1.5 border-l border-amber-900/30 bg-amber-950/10 px-2 py-2 text-xs font-medium text-amber-600/70 uppercase tracking-wider"
      title="Private notes — visible only to you. Drag to reorder."
    >
      <button
        {...attributes}
        {...listeners}
        data-testid="pn-header-grip"
        title="Drag to reorder"
        className="text-amber-800/60 hover:text-amber-500 cursor-grab active:cursor-grabbing -ml-0.5 mr-0.5"
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <Lock className="w-3 h-3" /> Private notes
    </div>
  )
}
