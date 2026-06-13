import { STATUS_CONFIG, normalizeStatus } from '@/lib/rundownStatus'
import { cn } from '@/lib/utils'

/** Small status pill (icon + label + colour) — shared by the dashboard and
 *  anywhere a rundown's status is shown at a glance. */
export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  const meta = STATUS_CONFIG[normalizeStatus(status)]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
        meta.badge,
        className
      )}
    >
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  )
}
