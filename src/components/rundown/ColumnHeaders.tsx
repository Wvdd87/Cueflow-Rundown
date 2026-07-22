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
  Info,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  SlidersHorizontal,
  RotateCcw,
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
import { useRundownData } from './RundownDataContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CF,
  PRIVATE_NOTES_WIDTH,
  PRIVATE_NOTES_ID,
  TITLE_COL_ID,
  TITLE_COL_WIDTH,
  totalRowWidth,
} from './layout'
import {
  OptionsEditor,
  rowsToOptions,
  optionsToRows,
  type OptionRow,
} from './OptionsEditor'
import { toast } from 'sonner'
import type { Column } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const LABEL = 'font-cond text-[9px] font-bold uppercase tracking-[0.18em] text-[#7c7e8a]'
const MIN_COL_WIDTH = CF.minColWidth

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
  titleIndex: number
  onTitleIndexChange: (idx: number) => void
  titleWidth: number
  onTitleWidthChange: (w: number) => void
  privateNotesWidth: number
  onPrivateNotesWidthChange: (w: number) => void
  onExpandAllScripts: () => void
  onCollapseAllScripts: () => void
}

// Build a merged list of [col ids, TITLE_COL_ID, PRIVATE_NOTES_ID] for DnD.
// titleIdx and pnIdx are both relative to the number of real column IDs.
function buildMergedIds(cols: Column[], titleIdx: number, pnIdx: number): string[] {
  const ids = cols.map((c) => c.id)
  const titleInsert = Math.min(Math.max(0, titleIdx), ids.length)
  ids.splice(titleInsert, 0, TITLE_COL_ID)
  // pnIdx is relative to cols only; in the merged array (after title insert) add 1 if pnIdx >= titleIdx
  const pnInsert = Math.min(Math.max(0, pnIdx + (pnIdx >= titleIdx ? 1 : 0)), ids.length)
  ids.splice(pnInsert, 0, PRIVATE_NOTES_ID)
  return ids
}

const FIELD =
  'w-full bg-[#16161c] border border-[#2e2e38] px-2.5 py-2 text-sm text-[#eef0f3] placeholder:text-[#5a5c66] outline-none focus:border-[#3a3a48]'
const FIELD_LABEL = 'font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ba0ab] mb-1.5'
const BTN_PRIMARY =
  'inline-flex items-center justify-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-[#f0a838] text-[#06060a] border border-[#f0a838] hover:bg-[#ffba50] cursor-pointer disabled:opacity-50'
const BTN_GHOST =
  'inline-flex items-center justify-center px-4 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.1em] bg-transparent text-[#9ba0ab] border border-[#2e2e38] hover:text-[#eef0f3] cursor-pointer'
const EDIT_ITEM =
  'gap-2.5 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

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
  titleIndex,
  onTitleIndexChange,
  titleWidth,
  onTitleWidthChange,
  privateNotesWidth,
  onPrivateNotesWidthChange,
  onExpandAllScripts,
  onCollapseAllScripts,
}: ColumnHeadersProps) {
  const { trackSave } = useRundownData()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState<'richtext' | 'dropdown'>('richtext')
  const [addRows, setAddRows] = useState<OptionRow[]>([{ value: '', color: null }])
  const [saving, setSaving] = useState(false)

  const [editCol, setEditCol] = useState<Column | null>(null)
  const [editRows, setEditRows] = useState<OptionRow[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const rowWidth = totalRowWidth(titleWidth, visibleColumns.map((c) => c.width), privateNotesWidth)
  const hiddenColumns = columns.filter((c) => !visibleColumns.some((v) => v.id === c.id))

  async function handleAddColumn() {
    const name = addName.trim()
    if (!name) return
    setSaving(true)
    const maxPos = columns.reduce((m, c) => Math.max(m, c.position), -1)
    const { options, optionColors } =
      addType === 'dropdown' ? rowsToOptions(addRows) : { options: null, optionColors: null }
    const result = await addColumn(rundownId, name, maxPos, addType, options, optionColors)
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
    else onColumnsChange(columns.map((c) => (c.id === id ? { ...c, name } : c)))
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
    const result = await updateColumnOptions(editCol.id, options, rundownId, optionColors)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      onColumnsChange(
        columns.map((c) => (c.id === editCol.id ? { ...c, options, option_colors: optionColors } : c))
      )
      setEditCol(null)
    }
  }

  function lockScroll() {
    const el = document.querySelector('[data-cue-scroll]') as HTMLElement | null
    if (el) el.style.overflow = 'hidden'
  }
  function unlockScroll() {
    const el = document.querySelector('[data-cue-scroll]') as HTMLElement | null
    if (el) el.style.overflow = ''
  }

  // --- Resize dynamic columns ---
  const resizeRef = useRef<{ id: string; width: number } | null>(null)
  function startResize(e: React.MouseEvent, col: Column) {
    e.preventDefault()
    e.stopPropagation()
    lockScroll()
    const startX = e.clientX
    const startW = col.width
    function onMove(ev: MouseEvent) {
      const width = Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX))
      resizeRef.current = { id: col.id, width }
      onColumnsChange(columns.map((c) => (c.id === col.id ? { ...c, width } : c)))
    }
    function onUp() {
      unlockScroll()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const r = resizeRef.current
      if (r) updateColumnWidth(r.id, r.width, rundownId)
      resizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function startTitleResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    lockScroll()
    const startX = e.clientX
    const startW = titleWidth
    function onMove(ev: MouseEvent) {
      onTitleWidthChange(Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX)))
    }
    function onUp() {
      unlockScroll()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function startPrivateNotesResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    lockScroll()
    const startX = e.clientX
    const startW = privateNotesWidth
    function onMove(ev: MouseEvent) {
      onPrivateNotesWidthChange(Math.max(MIN_COL_WIDTH, startW + (ev.clientX - startX)))
    }
    function onUp() {
      unlockScroll()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const mergedIds = buildMergedIds(visibleColumns, titleIndex, privateNotesIndex)
    const oldIdx = mergedIds.indexOf(active.id as string)
    const newIdx = mergedIds.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    const newMergedIds = arrayMove(mergedIds, oldIdx, newIdx)

    // Extract new titleIndex (count of real col IDs before TITLE_COL_ID)
    const titlePos = newMergedIds.indexOf(TITLE_COL_ID)
    const newTitleIdx = newMergedIds.slice(0, titlePos).filter((id) => id !== PRIVATE_NOTES_ID).length
    if (newTitleIdx !== titleIndex) onTitleIndexChange(newTitleIdx)

    // Extract new privateNotesIndex (count of real col IDs before PRIVATE_NOTES_ID)
    const pnPos = newMergedIds.indexOf(PRIVATE_NOTES_ID)
    const newPnIdx = newMergedIds.slice(0, pnPos).filter((id) => id !== TITLE_COL_ID).length
    if (newPnIdx !== privateNotesIndex) onPrivateNotesIndexChange(newPnIdx)

    const newColIds = newMergedIds.filter((id) => id !== PRIVATE_NOTES_ID && id !== TITLE_COL_ID)
    const oldColIds = visibleColumns.map((c) => c.id)
    if (JSON.stringify(newColIds) !== JSON.stringify(oldColIds)) {
      const hidden = columns.filter((c) => !visibleColumns.some((v) => v.id === c.id))
      const reorderedVisible = newColIds
        .map((id) => visibleColumns.find((c) => c.id === id))
        .filter((c): c is Column => !!c)
      const fullOrder = [...reorderedVisible, ...hidden].map((c, i) => ({ ...c, position: i }))
      onColumnsChange(fullOrder)
      const result = await trackSave(reorderColumns(rundownId, fullOrder.map((c) => c.id)))
      if (result.error) toast.error(result.error)
    }
  }

  return (
    <div className="flex items-stretch" style={{ gap: CF.gap, padding: `0 ${CF.rowPad}px`, width: rowWidth, height: CF.headerH }}>
      {/* gutter */}
      <div className="shrink-0" style={{ width: CF.c1 }} />

      {/* # */}
      <div className={cn('shrink-0 flex items-center justify-center', LABEL)} style={{ width: CF.num }}>#</div>

      {/* Start */}
      <div className={cn('shrink-0 flex items-center px-3.5', LABEL)} style={{ width: CF.start }}>Start</div>

      {/* Duration */}
      <div className={cn('shrink-0 flex items-center px-3.5', LABEL)} style={{ width: CF.dur }}>Dur.</div>

      {/* Dynamic columns + Title + Private notes (all sortable together) */}
      <DndContext id="column-headers-dnd" sensors={sensors} collisionDetection={closestCenter} onDragStart={lockScroll} onDragEnd={(e) => { unlockScroll(); handleDragEnd(e) }} onDragCancel={unlockScroll}>
        <SortableContext items={buildMergedIds(visibleColumns, titleIndex, privateNotesIndex)} strategy={horizontalListSortingStrategy}>
          {buildMergedIds(visibleColumns, titleIndex, privateNotesIndex).map((id) => {
            if (id === TITLE_COL_ID) {
              return (
                <SortableTitleHeader
                  key={TITLE_COL_ID}
                  width={titleWidth}
                  onResizeStart={startTitleResize}
                />
              )
            }
            if (id === PRIVATE_NOTES_ID) {
              return <SortablePrivateNotesHeader key={PRIVATE_NOTES_ID} width={privateNotesWidth} onResizeStart={startPrivateNotesResize} />
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
                onEditOptions={() => { setEditCol(col); setEditRows(optionsToRows(col.options, col.option_colors)) }}
                onHide={() => onToggleHide(col.id)}
                onDelete={() => handleDelete(col.id)}
                onResizeStart={(e) => startResize(e, col)}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      {/* Edit columns dropdown */}
      <div className="shrink-0 flex items-center px-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                data-testid="edit-columns-btn"
                className="inline-flex items-center gap-1.5 px-2.5 font-cond text-[9px] font-bold uppercase tracking-[0.14em] text-[#888b96] hover:text-[#f0a838] whitespace-nowrap transition-colors"
              />
            }
          >
            <SlidersHorizontal className="w-3 h-3" />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-48 p-0">
            <DropdownMenuItem
              data-testid="add-column-btn"
              onClick={() => setAddOpen(true)}
              className={EDIT_ITEM}
            >
              <Plus className="w-3.5 h-3.5 text-[#9ba0ab]" /> Add column
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={cn(EDIT_ITEM, 'data-[state=open]:bg-[#16161c]')}>
                <EyeOff className="w-3.5 h-3.5 text-[#9ba0ab]" />
                Hidden columns
                {hiddenCount > 0 && (
                  <span className="ml-auto font-mono text-[10px] text-[#7c7e8a]">{hiddenCount}</span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-44 p-0">
                {hiddenColumns.length === 0 ? (
                  <div className="px-3.5 py-2.5 text-[11px] text-[#5a5c66] italic">No hidden columns</div>
                ) : (
                  hiddenColumns.map((col) => (
                    <DropdownMenuItem key={col.id} onClick={() => onToggleHide(col.id)} className={EDIT_ITEM}>
                      <Eye className="w-3.5 h-3.5 text-[#9ba0ab]" /> {col.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="bg-[#1d1d24]" />

            <DropdownMenuItem
              onClick={() => { onUnhideAll(); onTitleWidthChange(TITLE_COL_WIDTH); onTitleIndexChange(0) }}
              className={EDIT_ITEM}
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#9ba0ab]" /> Reset column layout
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#1d1d24]" />
            <div className="px-3.5 pt-2 pb-1">
              <p className="font-cond text-[9px] font-bold uppercase tracking-[0.16em] text-[#5a5c66]">Script text</p>
            </div>
            <DropdownMenuItem onClick={onExpandAllScripts} className={EDIT_ITEM}>
              <ChevronsDown className="w-3.5 h-3.5 text-[#9ba0ab]" /> Expand all script blocks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCollapseAllScripts} className={EDIT_ITEM}>
              <ChevronsUp className="w-3.5 h-3.5 text-[#9ba0ab]" /> Collapse all script blocks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add-column dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-md p-0 gap-0 border-t-2 border-t-[#f0a838]">
          <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
            <DialogTitle className="text-base font-semibold text-[#eef0f3]">Add column</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <p className={FIELD_LABEL}>Name</p>
              <input
                data-testid="column-name"
                autoFocus
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && addType === 'richtext') handleAddColumn() }}
                placeholder="e.g. Camera, Notes, Status"
                className={FIELD}
              />
            </div>

            <div>
              <p className={FIELD_LABEL}>Type</p>
              <div className="grid grid-cols-2 gap-2">
                {([['richtext', 'Rich text', Type], ['dropdown', 'Dropdown', ListChecks]] as const).map(([k, lbl, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`coltype-${k}`}
                    onClick={() => setAddType(k)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm transition-colors border',
                      addType === k ? 'border-[#eef0f3] bg-[#16161c] text-[#eef0f3]' : 'border-[#2e2e38] text-[#9ba0ab] hover:border-[#3a3a48]'
                    )}
                  >
                    <Icon className="w-4 h-4" /> {lbl}
                  </button>
                ))}
              </div>
            </div>

            {addType === 'dropdown' && (
              <div>
                <p className={FIELD_LABEL}>Options</p>
                <OptionsEditor rows={addRows} onChange={setAddRows} />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setAddOpen(false)} className={BTN_GHOST}>Cancel</button>
              <button data-testid="add-column-submit" onClick={handleAddColumn} disabled={saving || !addName.trim()} className={BTN_PRIMARY}>
                {saving ? 'Adding…' : 'Add column'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit-options dialog */}
      <Dialog open={!!editCol} onOpenChange={(o) => !o && setEditCol(null)}>
        <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-md p-0 gap-0 border-t-2 border-t-[#f0a838]">
          <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
            <DialogTitle className="text-base font-semibold text-[#eef0f3]">Edit options — {editCol?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <p className={FIELD_LABEL}>Options</p>
              <OptionsEditor rows={editRows} onChange={setEditRows} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditCol(null)} className={BTN_GHOST}>Cancel</button>
              <button onClick={handleSaveOptions} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : 'Save options'}
              </button>
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

const COL_MENU_ITEM = 'gap-2 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

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
    <div ref={setNodeRef} style={style} className="group/col relative shrink-0 flex items-center gap-1.5 px-3.5">
      {isRenaming ? (
        <div className="flex items-center gap-1 w-full">
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel() }}
            className="flex-1 min-w-0 bg-[#16161c] border border-[#3a3a48] px-1.5 py-0.5 text-xs text-[#eef0f3] outline-none"
          />
          <button onClick={onRenameSubmit} className="text-[#9ba0ab] hover:text-[#eef0f3]"><Check className="w-3 h-3" /></button>
          <button onClick={onRenameCancel} className="text-[#9ba0ab] hover:text-[#eef0f3]"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <>
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder column"
            className="opacity-0 group-hover/col:opacity-100 transition-opacity text-[#5a5c66] hover:text-[#9ba0ab] cursor-grab active:cursor-grabbing -ml-1"
          >
            <GripVertical className="w-3 h-3" />
          </button>
          {col.col_type === 'dropdown' && <ChevronDown className="w-2.5 h-2.5 text-[#5a5c66] shrink-0" />}
          <span className={cn('flex-1 truncate', LABEL)}>{col.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  data-testid="column-menu-btn"
                  className="opacity-0 group-hover/col:opacity-100 transition-opacity text-[#9ba0ab] hover:text-[#eef0f3]"
                />
              }
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#111116] border-[#2e2e38] text-[#c8c9d0] w-40 p-0">
              <DropdownMenuItem onClick={onStartRename} className={COL_MENU_ITEM}>
                <Pencil className="w-3 h-3 text-[#9ba0ab]" /> Rename
              </DropdownMenuItem>
              {col.col_type === 'dropdown' && (
                <DropdownMenuItem onClick={onEditOptions} className={COL_MENU_ITEM}>
                  <ListChecks className="w-3 h-3 text-[#9ba0ab]" /> Edit options
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onHide} className={COL_MENU_ITEM}>
                <EyeOff className="w-3 h-3 text-[#9ba0ab]" /> Hide for me
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1d1d24]" />
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 px-3.5 py-2.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-[#ff5a73] focus:bg-[rgba(255,40,72,0.08)] focus:text-[#ff5a73] cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute -right-[3px] top-0 bottom-0 w-2 cursor-col-resize z-[5] flex items-center justify-center group/rh hover:bg-[#f0a838]/15 transition-colors"
      >
        <div className="w-px h-[55%] bg-[#2e2e38] group-hover/rh:bg-[#f0a838]/80 transition-colors pointer-events-none" />
      </div>
    </div>
  )
}

function SortableTitleHeader({ width, onResizeStart }: { width: number; onResizeStart: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: TITLE_COL_ID })

  const style = {
    width,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/col relative shrink-0 flex items-center gap-1.5 px-3.5"
    >
      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder column"
        className="opacity-0 group-hover/col:opacity-100 transition-opacity text-[#5a5c66] hover:text-[#9ba0ab] cursor-grab active:cursor-grabbing -ml-1"
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <span className={cn('flex-1 truncate', LABEL)}>Title</span>
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute -right-[3px] top-0 bottom-0 w-2 cursor-col-resize z-[5] flex items-center justify-center group/rh hover:bg-[#f0a838]/15 transition-colors"
      >
        <div className="w-px h-[55%] bg-[#2e2e38] group-hover/rh:bg-[#f0a838]/80 transition-colors pointer-events-none" />
      </div>
    </div>
  )
}

function SortablePrivateNotesHeader({ width, onResizeStart }: { width: number; onResizeStart: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: PRIVATE_NOTES_ID })

  const style = {
    width,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/col relative shrink-0 flex items-center gap-1.5 px-3.5"
      title="Private notes — visible only to you. Drag to reorder."
    >
      <button
        {...attributes}
        {...listeners}
        data-testid="pn-header-grip"
        title="Drag to reorder"
        className="opacity-0 group-hover/col:opacity-100 transition-opacity text-[#5a5c66] hover:text-[#9ba0ab] cursor-grab active:cursor-grabbing -ml-1"
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <span className={LABEL}>Private notes</span>
      <Info className="w-[11px] h-[11px] text-[#5a5c66] shrink-0" />
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        className="absolute -right-[3px] top-0 bottom-0 w-2 cursor-col-resize z-[5] flex items-center justify-center group/rh hover:bg-[#f0a838]/15 transition-colors"
      >
        <div className="w-px h-[55%] bg-[#2e2e38] group-hover/rh:bg-[#f0a838]/80 transition-colors pointer-events-none" />
      </div>
    </div>
  )
}
