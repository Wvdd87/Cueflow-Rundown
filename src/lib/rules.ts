import type { Column, RuleAction, RuleBuiltInField, RuleCondition, RuleConditionTarget, RuleOperator, RundownRule } from './supabase/types'
import type { CueTimingOutput } from './timing'
import { parseTimeToMs } from './timing'
import { parseDropdownCellValues } from './dropdownValues'
import { stripHtml } from './utils'

// ── Operator vocabulary, shared between the rule builder UI and evaluation ──

export const TEXT_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'is_exactly', label: 'Is exactly' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
]
export const DROPDOWN_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'is', label: 'Is' },
  { value: 'is_not', label: 'Is not' },
  { value: 'contains_any', label: 'Contains any of' },
  { value: 'contains_none', label: 'Contains none of' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
]
export const DURATION_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'longer_than', label: 'Is longer than' },
  { value: 'shorter_than', label: 'Is shorter than' },
  { value: 'between', label: 'Is between' },
  { value: 'is_empty', label: 'Is empty' },
]
export const START_TIME_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'before', label: 'Is before' },
  { value: 'after', label: 'Is after' },
  { value: 'between', label: 'Is between' },
]
export const BOOLEAN_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'is_true', label: 'Is true' },
  { value: 'is_false', label: 'Is false' },
]
export const CUE_TYPE_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'cue_type_is', label: 'Is' },
]
export const CUE_TYPE_VALUES: { value: string; label: string }[] = [
  { value: 'cue', label: 'Regular cue' },
  { value: 'heading', label: 'Heading' },
  { value: 'grouped_sub_cue', label: 'Grouped sub-cue' },
]
export const GROUP_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'in_any_group', label: 'Is in any group' },
  { value: 'in_group', label: 'Is in a specific group' },
]
export const ROW_COLOR_OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'is', label: 'Is' },
  { value: 'is_not', label: 'Is not' },
  { value: 'is_empty', label: 'Has no color' },
  { value: 'is_not_empty', label: 'Has any color' },
]

export const RULE_TEXT_COLORS = ['#eef0f3', '#f0a838', '#ff5a73', '#18d986', '#5aa0e6', '#a855f7']

export function operatorsFor(target: RuleConditionTarget, columns: Column[]): { value: RuleOperator; label: string }[] {
  if (target.kind === 'column') {
    const col = columns.find((c) => c.id === target.columnId)
    return col?.col_type === 'dropdown' ? DROPDOWN_OPERATORS : TEXT_OPERATORS
  }
  switch (target.field) {
    case 'not_final':
    case 'has_no_script': return BOOLEAN_OPERATORS
    case 'cue_type': return CUE_TYPE_OPERATORS
    case 'group': return GROUP_OPERATORS
    case 'duration': return DURATION_OPERATORS
    case 'start_time': return START_TIME_OPERATORS
    case 'title':
    case 'private_note': return TEXT_OPERATORS
    case 'row_color': return ROW_COLOR_OPERATORS
    default: return []
  }
}

export function targetKey(t: RuleConditionTarget): string {
  return t.kind === 'column' ? `col:${t.columnId}` : `built-in:${t.field}`
}
export function targetFromKey(key: string): RuleConditionTarget {
  if (key.startsWith('col:')) return { kind: 'column', columnId: key.slice(4) }
  return { kind: 'built-in', field: key.slice('built-in:'.length) as RuleBuiltInField }
}

export interface RuleRowResult {
  backgroundColor: string | null
  textColor: string | null
  /** A rule flagged this row as not-final (visual only, never persisted). */
  notFinal: boolean
}

const emptyResult = (): RuleRowResult => ({ backgroundColor: null, textColor: null, notFinal: false })

function textValue(raw: string): string {
  return stripHtml(raw ?? '').trim()
}

function matchText(text: string, operator: RuleOperator, value: string): boolean {
  const needle = value.toLowerCase()
  switch (operator) {
    case 'contains': return text.toLowerCase().includes(needle)
    case 'not_contains': return !text.toLowerCase().includes(needle)
    case 'starts_with': return text.toLowerCase().startsWith(needle)
    case 'ends_with': return text.toLowerCase().endsWith(needle)
    case 'is_empty': return text === ''
    case 'is_not_empty': return text !== ''
    case 'is_exactly': return text === value
    default: return false
  }
}

function evaluateCondition(
  cond: RuleCondition,
  cue: CueTimingOutput,
  columns: Column[],
  cells: Record<string, string>,
  privateNotes: Record<string, string>
): boolean {
  const { target, operator, value = '', valueMax = '' } = cond

  if (target.kind === 'column') {
    const column = columns.find((c) => c.id === target.columnId)
    if (!column) return false
    const raw = cells[`${cue.id}:${column.id}`] ?? ''

    if (column.col_type === 'dropdown') {
      const values = parseDropdownCellValues(raw)
      switch (operator) {
        case 'is': return values.length === 1 && values[0] === value
        case 'is_not': return !(values.length === 1 && values[0] === value)
        case 'contains_any': return values.includes(value)
        case 'contains_none': return !values.includes(value)
        case 'is_empty': return values.length === 0
        case 'is_not_empty': return values.length > 0
        default: return false
      }
    }

    return matchText(textValue(raw), operator, value)
  }

  // Built-in cue-level properties
  switch (target.field) {
    case 'title':
      return matchText(textValue(cue.title ?? ''), operator, value)
    case 'private_note':
      return matchText(textValue(privateNotes[cue.id] ?? ''), operator, value)
    case 'row_color': {
      const color = cue.background_color
      switch (operator) {
        case 'is': return color === value
        case 'is_not': return color !== value
        case 'is_empty': return !color
        case 'is_not_empty': return !!color
        default: return false
      }
    }
    case 'not_final':
      return operator === 'is_true' ? cue.not_final === true : operator === 'is_false' ? cue.not_final === false : false
    case 'has_no_script': {
      const hasNone = (cue.scripts?.length ?? 0) === 0
      return operator === 'is_true' ? hasNone : operator === 'is_false' ? !hasNone : false
    }
    case 'cue_type': {
      if (operator !== 'cue_type_is') return false
      if (value === 'heading') return cue.cue_type === 'heading'
      if (value === 'grouped_sub_cue') return cue.cue_type === 'cue' && !!cue.group_id
      return cue.cue_type === 'cue' && !cue.group_id
    }
    case 'group':
      if (operator === 'in_any_group') return cue.cue_type === 'cue' && !!cue.group_id
      if (operator === 'in_group') return cue.cue_type === 'cue' && cue.group_id === value
      return false
    case 'duration': {
      const ms = cue.duration_ms
      switch (operator) {
        case 'is_empty': return ms === 0
        case 'longer_than': return ms > Number(value)
        case 'shorter_than': return ms < Number(value)
        case 'between': return ms >= Number(value) && ms <= Number(valueMax)
        default: return false
      }
    }
    case 'start_time': {
      const ms = cue.calculated_start_ms
      switch (operator) {
        case 'before': return ms < parseTimeToMs(value)
        case 'after': return ms > parseTimeToMs(value)
        case 'between': return ms >= parseTimeToMs(value) && ms <= parseTimeToMs(valueMax)
        default: return false
      }
    }
    default:
      return false
  }
}

function matchesRule(rule: RundownRule, cue: CueTimingOutput, columns: Column[], cells: Record<string, string>, privateNotes: Record<string, string>): boolean {
  if (rule.conditions.length === 0) return false
  const results = rule.conditions.map((c) => evaluateCondition(c, cue, columns, cells, privateNotes))
  return rule.conditionLogic === 'OR' ? results.some(Boolean) : results.every(Boolean)
}

function applyAction(action: RuleAction, cue: CueTimingOutput, res: RuleRowResult, decided: { bg: boolean; text: boolean }) {
  if (action.type === 'set_background_color' && !decided.bg) {
    decided.bg = true
    const manual = cue.background_color
    if (!manual || action.overrideManualColor) res.backgroundColor = action.color ?? null
  } else if (action.type === 'set_text_color' && !decided.text) {
    decided.text = true
    res.textColor = action.color ?? null
  } else if (action.type === 'set_not_final') {
    res.notFinal = true
  }
}

/** Evaluate every active rule (in priority order) against every cue/heading —
 *  pure and client-only, no server round-trip. First matching rule wins the
 *  background/text-color "slot" per row (manual colors win unless a rule
 *  explicitly opts to override); badge actions from every matching rule stack. */
export function evaluateRules(
  rules: RundownRule[],
  cues: CueTimingOutput[],
  columns: Column[],
  cells: Record<string, string>,
  privateNotes: Record<string, string> = {}
): Map<string, RuleRowResult> {
  const result = new Map<string, RuleRowResult>()
  const activeRules = rules.filter((r) => r.active)
  if (activeRules.length === 0) return result

  for (const cue of cues) {
    const res = emptyResult()
    const decided = { bg: false, text: false }
    for (const rule of activeRules) {
      if (!matchesRule(rule, cue, columns, cells, privateNotes)) continue
      for (const action of rule.actions) applyAction(action, cue, res, decided)
    }
    if (res.backgroundColor || res.textColor || res.notFinal) result.set(cue.id, res)
  }
  return result
}
