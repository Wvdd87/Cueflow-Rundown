'use client'

import { useState } from 'react'
import { GripVertical, Pencil, Plus, Trash2, Sparkles } from 'lucide-react'
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DIALOG_CONTENT, DIALOG_HEADER, BTN_PRIMARY, ROW_TILE } from './dialogStyles'
import { RuleForm } from './RuleBuilderModal'
import { cn } from '@/lib/utils'
import type { Column, RundownRule } from '@/lib/supabase/types'

interface RulesPanelProps {
  open: boolean
  onClose: () => void
  rules: RundownRule[]
  onChange: (rules: RundownRule[]) => void
  columns: Column[]
  groups: { id: string; title: string }[]
}

function conditionSummary(rule: RundownRule): string {
  const n = rule.conditions.length
  if (n === 0) return 'No conditions'
  return `${n} condition${n > 1 ? 's' : ''}${n > 1 ? ` (${rule.conditionLogic})` : ''}`
}

function actionSummary(rule: RundownRule): string {
  const parts: string[] = []
  if (rule.actions.some((a) => a.type === 'set_background_color')) parts.push('Background color')
  if (rule.actions.some((a) => a.type === 'set_text_color')) parts.push('Text color')
  if (rule.actions.some((a) => a.type === 'set_not_final')) parts.push('Mark not final')
  return parts.join(' · ') || 'No actions'
}

export function RulesPanel({ open, onClose, rules, onChange, columns, groups }: RulesPanelProps) {
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RundownRule | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = rules.findIndex((r) => r.id === active.id)
    const newIdx = rules.findIndex((r) => r.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    onChange(arrayMove(rules, oldIdx, newIdx))
  }

  function toggleActive(id: string) {
    onChange(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }
  function deleteRule(id: string) {
    onChange(rules.filter((r) => r.id !== id))
  }
  function openCreate() {
    setEditingRule(null)
    setBuilderOpen(true)
  }
  function openEdit(rule: RundownRule) {
    setEditingRule(rule)
    setBuilderOpen(true)
  }
  function handleSaveRule(rule: RundownRule) {
    const exists = rules.some((r) => r.id === rule.id)
    onChange(exists ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule])
    setBuilderOpen(false)
  }

  return (
    // A single Dialog whose content swaps between the list and the rule
    // form — two independently-mounted Dialogs (list + builder) toggling in
    // the same tick raced Base UI's inert-marker cleanup and left the page
    // permanently unclickable, so the builder is inlined as plain content
    // instead of owning its own Dialog.
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(DIALOG_CONTENT, 'sm:max-w-lg max-h-[85vh] overflow-y-auto')}>
        <DialogHeader className={DIALOG_HEADER}>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[#eef0f3]">
            <Sparkles className="w-4 h-4 text-[#f0a838]" />
            {builderOpen ? (editingRule ? 'Edit rule' : 'Add rule') : 'Rules'}
          </DialogTitle>
        </DialogHeader>

        {builderOpen ? (
          <RuleForm
            key={editingRule?.id ?? 'new'}
            onClose={() => setBuilderOpen(false)}
            onSave={handleSaveRule}
            columns={columns}
            groups={groups}
            initialRule={editingRule}
          />
        ) : (
          <div className="p-5 space-y-3">
            {rules.length === 0 ? (
              <p className="text-sm text-[#7c7e8a]">
                No rules yet. Rules automatically color or flag cue rows based on their column values.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5" data-testid="rules-list">
                    {rules.map((rule) => (
                      <SortableRuleRow
                        key={rule.id}
                        rule={rule}
                        onToggleActive={() => toggleActive(rule.id)}
                        onEdit={() => openEdit(rule)}
                        onDelete={() => deleteRule(rule.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <button data-testid="add-rule-btn" onClick={openCreate} className={BTN_PRIMARY}>
              <Plus className="w-3.5 h-3.5" /> Add rule
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SortableRuleRow({
  rule,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  rule: RundownRule
  onToggleActive: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <div ref={setNodeRef} style={style} data-testid="rule-row" className={cn(ROW_TILE, 'flex items-center gap-2.5')}>
      <button {...attributes} {...listeners} title="Drag to reorder" className="shrink-0 text-[#5a5c66] hover:text-[#9ba0ab] cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#eef0f3] truncate">{rule.label}</p>
        <p className="text-[11px] text-[#7c7e8a] truncate">{conditionSummary(rule)} → {actionSummary(rule)}</p>
      </div>

      <button
        data-testid="rule-active-toggle"
        onClick={onToggleActive}
        title={rule.active ? 'Active — click to disable' : 'Disabled — click to enable'}
        className={cn(
          'shrink-0 px-2 py-1 border font-cond text-[9px] font-bold uppercase tracking-[0.12em] transition-colors',
          rule.active
            ? 'border-[#f0a838]/60 text-[#f0a838] bg-[rgba(240,168,56,0.1)]'
            : 'border-[#2e2e38] text-[#7c7e8a] hover:text-[#c8c9d0] hover:border-[#3a3a48]'
        )}
      >
        {rule.active ? 'On' : 'Off'}
      </button>

      <button data-testid="edit-rule-btn" onClick={onEdit} className="shrink-0 text-[#7c7e8a] hover:text-[#eef0f3] transition-colors">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button data-testid="delete-rule-btn" onClick={onDelete} className="shrink-0 text-[#7c7e8a] hover:text-[#ff5a73] transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
