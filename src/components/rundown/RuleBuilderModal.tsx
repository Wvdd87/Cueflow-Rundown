'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { FIELD, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY } from './dialogStyles'
import { CUE_COLORS } from './layout'
import {
  operatorsFor,
  targetKey,
  targetFromKey,
  CUE_TYPE_VALUES,
  RULE_TEXT_COLORS,
} from '@/lib/rules'
import { cn } from '@/lib/utils'
import type { Column, RuleCondition, RundownRule } from '@/lib/supabase/types'

interface RuleFormProps {
  onClose: () => void
  onSave: (rule: RundownRule) => void
  columns: Column[]
  groups: { id: string; title: string }[]
  initialRule: RundownRule | null
}

function newCondition(columns: Column[]): RuleCondition {
  const target = columns[0] ? { kind: 'column' as const, columnId: columns[0].id } : { kind: 'built-in' as const, field: 'not_final' as const }
  const op = operatorsFor(target, columns)[0]
  return { id: crypto.randomUUID(), target, operator: op?.value ?? 'is_not_empty', value: '' }
}

const TOGGLE = (on: boolean) =>
  cn(
    'flex items-center justify-between w-full gap-2 px-3 py-2 border text-left transition-colors cursor-pointer',
    on
      ? 'border-[#f0a838]/50 bg-[rgba(240,168,56,0.10)] text-[#eef0f3]'
      : 'border-[#2e2e38] bg-[#16161c] text-[#9ba0ab] hover:border-[#3a3a48]'
  )

/** The rule create/edit form — no Dialog wrapper of its own. Rendered inside
 *  RulesPanel's single Dialog so the list/builder views never involve two
 *  independently-mounted Dialog instances (that raced Base UI's inert-marker
 *  cleanup and left the page unclickable — see RulesPanel.tsx). */
export function RuleForm({ onClose, onSave, columns, groups, initialRule }: RuleFormProps) {
  const [label, setLabel] = useState(initialRule?.label ?? '')
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(initialRule?.conditionLogic ?? 'AND')
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initialRule?.conditions?.length ? initialRule.conditions : [newCondition(columns)]
  )
  const bgAction = initialRule?.actions.find((a) => a.type === 'set_background_color')
  const textAction = initialRule?.actions.find((a) => a.type === 'set_text_color')
  const notFinalAction = initialRule?.actions.find((a) => a.type === 'set_not_final')
  const [bgEnabled, setBgEnabled] = useState(!!bgAction)
  const [bgColor, setBgColor] = useState(bgAction?.color ?? CUE_COLORS[1] ?? '#4a1d96')
  const [overrideManual, setOverrideManual] = useState(bgAction?.overrideManualColor ?? false)
  const [textEnabled, setTextEnabled] = useState(!!textAction)
  const [textColor, setTextColor] = useState(textAction?.color ?? RULE_TEXT_COLORS[1])
  const [notFinalEnabled, setNotFinalEnabled] = useState(!!notFinalAction)

  function updateCondition(id: string, patch: Partial<RuleCondition>) {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }
  function addCondition() {
    setConditions((prev) => [...prev, newCondition(columns)])
  }

  function handleSave() {
    const name = label.trim()
    if (!name || conditions.length === 0) return
    const actions: RundownRule['actions'] = []
    if (bgEnabled) actions.push({ id: bgAction?.id ?? crypto.randomUUID(), type: 'set_background_color', color: bgColor, overrideManualColor: overrideManual })
    if (textEnabled) actions.push({ id: textAction?.id ?? crypto.randomUUID(), type: 'set_text_color', color: textColor })
    if (notFinalEnabled) actions.push({ id: notFinalAction?.id ?? crypto.randomUUID(), type: 'set_not_final' })
    if (actions.length === 0) return

    onSave({
      id: initialRule?.id ?? crypto.randomUUID(),
      label: name,
      active: initialRule?.active ?? true,
      conditionLogic,
      conditions,
      actions,
      createdAt: initialRule?.createdAt ?? new Date().toISOString(),
    })
  }

  const canSave = label.trim() !== '' && conditions.length > 0 && (bgEnabled || textEnabled || notFinalEnabled)

  return (
    <>
        <div className="p-5 space-y-5">
          <div>
            <p className={FIELD_LABEL}>Rule name</p>
            <input
              data-testid="rule-name-input"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Flag empty screens"
              className={FIELD}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className={FIELD_LABEL + ' mb-0'}>Conditions</p>
              {conditions.length > 1 && (
                <div className="flex items-center gap-1 font-cond text-[10px] font-bold uppercase tracking-[0.1em]">
                  {(['AND', 'OR'] as const).map((v) => (
                    <button
                      key={v}
                      data-testid={`rule-logic-${v.toLowerCase()}`}
                      onClick={() => setConditionLogic(v)}
                      className={cn(
                        'px-2 py-1 border transition-colors',
                        conditionLogic === v ? 'border-[#f0a838] text-[#f0a838]' : 'border-[#2e2e38] text-[#7c7e8a] hover:text-[#c8c9d0]'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {conditions.map((cond) => (
                <ConditionRow
                  key={cond.id}
                  condition={cond}
                  columns={columns}
                  groups={groups}
                  onChange={(patch) => updateCondition(cond.id, patch)}
                  onRemove={() => removeCondition(cond.id)}
                  removable={conditions.length > 1}
                />
              ))}
            </div>
            <button
              data-testid="add-condition-btn"
              onClick={addCondition}
              className="flex items-center gap-1.5 text-xs text-[#7c7e8a] hover:text-[#c8c9d0] transition-colors pt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add condition
            </button>
          </div>

          <div>
            <p className={FIELD_LABEL}>Actions</p>
            <div className="space-y-1.5">
              <button data-testid="rule-action-bg-toggle" onClick={() => setBgEnabled((v) => !v)} className={TOGGLE(bgEnabled)}>
                <span className="text-[12.5px]">Set row background color</span>
                <span className="font-cond text-[9px] font-bold uppercase tracking-[0.1em]">{bgEnabled ? 'On' : 'Off'}</span>
              </button>
              {bgEnabled && (
                <div className="pl-3 space-y-2 pt-1">
                  <div className="grid grid-cols-6 gap-1.5">
                    {CUE_COLORS.filter((c): c is string => !!c).map((c) => (
                      <button
                        key={c}
                        data-testid={`rule-bg-swatch-${c}`}
                        onClick={() => setBgColor(c)}
                        style={{ background: c, border: `1.5px solid ${bgColor === c ? '#eef0f3' : 'transparent'}` }}
                        className="w-6 h-6 rounded-sm"
                        title={c}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[#9ba0ab] cursor-pointer">
                    <input
                      data-testid="rule-override-manual"
                      type="checkbox"
                      checked={overrideManual}
                      onChange={(e) => setOverrideManual(e.target.checked)}
                    />
                    Let this rule override a manually set row color
                  </label>
                </div>
              )}

              <button data-testid="rule-action-text-toggle" onClick={() => setTextEnabled((v) => !v)} className={TOGGLE(textEnabled)}>
                <span className="text-[12.5px]">Set row text color</span>
                <span className="font-cond text-[9px] font-bold uppercase tracking-[0.1em]">{textEnabled ? 'On' : 'Off'}</span>
              </button>
              {textEnabled && (
                <div className="pl-3 flex gap-1.5 pt-1">
                  {RULE_TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      data-testid={`rule-text-swatch-${c}`}
                      onClick={() => setTextColor(c)}
                      style={{ background: c, border: `1.5px solid ${textColor === c ? '#f0a838' : '#3a3a48'}` }}
                      className="w-6 h-6 rounded-sm"
                      title={c}
                    />
                  ))}
                </div>
              )}

              <button data-testid="rule-action-not-final-toggle" onClick={() => setNotFinalEnabled((v) => !v)} className={TOGGLE(notFinalEnabled)}>
                <span className="text-[12.5px]">Mark cue as not final</span>
                <span className="font-cond text-[9px] font-bold uppercase tracking-[0.1em]">{notFinalEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
            <button data-testid="save-rule-btn" onClick={handleSave} disabled={!canSave} className={BTN_PRIMARY}>
              Save rule
            </button>
          </div>
        </div>
    </>
  )
}

function ConditionRow({
  condition,
  columns,
  groups,
  onChange,
  onRemove,
  removable,
}: {
  condition: RuleCondition
  columns: Column[]
  groups: { id: string; title: string }[]
  onChange: (patch: Partial<RuleCondition>) => void
  onRemove: () => void
  removable: boolean
}) {
  const target = condition.target
  const ops = operatorsFor(target, columns)
  const targetColumn = target.kind === 'column' ? columns.find((c) => c.id === target.columnId) : null

  function handleTargetChange(key: string) {
    const target = targetFromKey(key)
    const nextOps = operatorsFor(target, columns)
    onChange({ target, operator: nextOps[0]?.value ?? 'is_not_empty', value: '', valueMax: undefined })
  }

  const needsValue = !['is_empty', 'is_not_empty', 'in_any_group'].includes(condition.operator)
  const needsMax = condition.operator === 'between'

  return (
    <div data-testid="rule-condition-row" className="bg-[#16161c] border border-[#2e2e38] p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <select
          data-testid="condition-target-select"
          value={targetKey(condition.target)}
          onChange={(e) => handleTargetChange(e.target.value)}
          className={FIELD + ' flex-1'}
        >
          <optgroup label="Columns">
            {columns.map((c) => (
              <option key={c.id} value={`col:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Cue properties">
            <option value="built-in:title">Title</option>
            <option value="built-in:private_note">Private note</option>
            <option value="built-in:row_color">Row color</option>
            <option value="built-in:not_final">Not final</option>
            <option value="built-in:cue_type">Cue type</option>
            <option value="built-in:has_no_script">Has no script</option>
            <option value="built-in:group">Group</option>
            <option value="built-in:duration">Duration</option>
            <option value="built-in:start_time">Start time</option>
          </optgroup>
        </select>
        {removable && (
          <button data-testid="remove-condition-btn" onClick={onRemove} className="shrink-0 text-[#5a5c66] hover:text-[#ff5a73] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <select
          data-testid="condition-operator-select"
          value={condition.operator}
          onChange={(e) => onChange({ operator: e.target.value as RuleCondition['operator'], value: '', valueMax: undefined })}
          className={FIELD + ' flex-1'}
        >
          {ops.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {needsValue && condition.target.kind === 'built-in' && condition.target.field === 'cue_type' && (
          <select data-testid="condition-value-select" value={condition.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={FIELD + ' flex-1'}>
            {CUE_TYPE_VALUES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        )}

        {needsValue && condition.target.kind === 'built-in' && condition.target.field === 'group' && condition.operator === 'in_group' && (
          <select data-testid="condition-value-select" value={condition.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={FIELD + ' flex-1'}>
            <option value="">Select a group…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.title || 'Untitled group'}</option>)}
          </select>
        )}

        {needsValue && condition.target.kind === 'built-in' && (condition.target.field === 'title' || condition.target.field === 'private_note') && (
          <input data-testid="condition-value-input" value={condition.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="Value" className={FIELD + ' flex-1'} />
        )}

        {needsValue && condition.target.kind === 'built-in' && condition.target.field === 'row_color' && (
          <div data-testid="condition-value-swatches" className="flex flex-wrap gap-1 flex-1">
            {CUE_COLORS.filter((c): c is string => !!c).map((c) => (
              <button
                key={c}
                data-testid={`condition-color-swatch-${c}`}
                onClick={() => onChange({ value: c })}
                style={{ background: c, border: `1.5px solid ${condition.value === c ? '#eef0f3' : 'transparent'}` }}
                className="w-5 h-5 rounded-sm"
                title={c}
              />
            ))}
          </div>
        )}

        {needsValue && condition.target.kind === 'column' && targetColumn?.col_type === 'dropdown' && (
          <select data-testid="condition-value-select" value={condition.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={FIELD + ' flex-1'}>
            <option value="">Select an option…</option>
            {(targetColumn.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}

        {needsValue && condition.target.kind === 'column' && targetColumn?.col_type !== 'dropdown' && (
          <input data-testid="condition-value-input" value={condition.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="Value" className={FIELD + ' flex-1'} />
        )}

        {needsValue && condition.target.kind === 'built-in' && condition.target.field === 'duration' && (
          <div className="flex items-center gap-1 flex-1">
            <input
              data-testid="condition-value-input"
              type="number"
              min={0}
              value={condition.value ? Number(condition.value) / 1000 : ''}
              onChange={(e) => onChange({ value: e.target.value ? String(Number(e.target.value) * 1000) : '' })}
              placeholder="Seconds"
              className={FIELD}
            />
            {needsMax && (
              <input
                data-testid="condition-value-max-input"
                type="number"
                min={0}
                value={condition.valueMax ? Number(condition.valueMax) / 1000 : ''}
                onChange={(e) => onChange({ valueMax: e.target.value ? String(Number(e.target.value) * 1000) : '' })}
                placeholder="Seconds"
                className={FIELD}
              />
            )}
          </div>
        )}

        {needsValue && condition.target.kind === 'built-in' && condition.target.field === 'start_time' && (
          <div className="flex items-center gap-1 flex-1">
            <input data-testid="condition-value-input" value={condition.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="HH:MM:SS" className={FIELD} />
            {needsMax && (
              <input data-testid="condition-value-max-input" value={condition.valueMax ?? ''} onChange={(e) => onChange({ valueMax: e.target.value })} placeholder="HH:MM:SS" className={FIELD} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
