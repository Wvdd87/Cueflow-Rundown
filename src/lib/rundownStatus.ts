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

export interface StatusMeta {
  label: string
  icon: LucideIcon
  /** pill background + text colour */
  badge: string
  /** small status dot colour (for menu rows) */
  dot: string
}

/** Single source of truth for status styling — used by the header selector
 *  dropdown and the dashboard badge so they always match. */
export const STATUS_CONFIG: Record<RundownStatus, StatusMeta> = {
  draft: {
    label: 'Draft',
    icon: Pencil,
    badge: 'bg-zinc-700 text-zinc-200',
    dot: 'bg-zinc-400',
  },
  awaiting_data: {
    label: 'Awaiting data',
    icon: Clock,
    badge: 'bg-amber-600/90 text-white',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    badge: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-500',
  },
  finalized: {
    label: 'Finalized',
    icon: Lock,
    badge: 'bg-blue-600 text-white',
    dot: 'bg-blue-500',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    badge: 'bg-red-600 text-white',
    dot: 'bg-red-500',
  },
}

export const RUNDOWN_STATUSES = Object.keys(STATUS_CONFIG) as RundownStatus[]

/** Coerce any stored/legacy value to a valid status (defaults to draft). */
export function normalizeStatus(value: string | null | undefined): RundownStatus {
  return value && value in STATUS_CONFIG ? (value as RundownStatus) : 'draft'
}
