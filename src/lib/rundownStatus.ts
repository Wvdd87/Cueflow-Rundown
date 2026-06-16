import {
  Pencil,
  Clock,
  CheckCircle2,
  Lock,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

export type RundownStatus =
  | 'draft'
  | 'awaiting_data'
  | 'approved'
  | 'finalized'
  | 'rejected'

export interface CueFlowBadge {
  /** text colour */
  fg: string
  /** background fill */
  bg: string
  /** border colour */
  bd: string
  /** dot colour */
  dot: string
}

export interface StatusMeta {
  label: string
  icon: LucideIcon
  /** pill background + text colour (legacy tailwind class) */
  badge: string
  /** small status dot colour (for menu rows) */
  dot: string
  /** CueFlow design-language badge colours (exact hex) */
  cf: CueFlowBadge
}

/** Single source of truth for status styling — used by the header selector
 *  dropdown and the dashboard badge so they always match. */
export const STATUS_CONFIG: Record<RundownStatus, StatusMeta> = {
  draft: {
    label: 'Draft',
    icon: Pencil,
    badge: 'bg-zinc-700 text-zinc-200',
    dot: 'bg-zinc-400',
    cf: { fg: '#9ba0ab', bg: '#16161c', bd: '#2e2e38', dot: '#5a5c66' },
  },
  awaiting_data: {
    label: 'Awaiting data',
    icon: Clock,
    badge: 'bg-amber-600/90 text-white',
    dot: 'bg-amber-500',
    cf: { fg: '#c9a256', bg: 'rgba(240,168,56,0.10)', bd: 'rgba(240,168,56,0.32)', dot: '#f0a838' },
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    badge: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-500',
    cf: { fg: '#6fb0ea', bg: 'rgba(75,150,230,0.12)', bd: 'rgba(75,150,230,0.4)', dot: '#5aa0e6' },
  },
  finalized: {
    label: 'Finalized',
    icon: Lock,
    badge: 'bg-blue-600 text-white',
    dot: 'bg-blue-500',
    cf: { fg: '#18d986', bg: 'rgba(24,217,134,0.10)', bd: 'rgba(24,217,134,0.4)', dot: '#18d986' },
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    badge: 'bg-red-600 text-white',
    dot: 'bg-red-500',
    cf: { fg: '#ff5a73', bg: 'rgba(255,40,72,0.10)', bd: 'rgba(255,40,72,0.4)', dot: '#ff2848' },
  },
}

export const RUNDOWN_STATUSES = Object.keys(STATUS_CONFIG) as RundownStatus[]

/** Coerce any stored/legacy value to a valid status (defaults to draft). */
export function normalizeStatus(value: string | null | undefined): RundownStatus {
  return value && value in STATUS_CONFIG ? (value as RundownStatus) : 'draft'
}
