import { STATUS_CONFIG, normalizeStatus } from '@/lib/rundownStatus'
import { cn } from '@/lib/utils'

/** Small CueFlow status badge (dot + label) — shared by the dashboard and
 *  anywhere a rundown's status is shown at a glance. */
export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  const meta = STATUS_CONFIG[normalizeStatus(status)]
  const cf = meta.cf
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 font-cond text-[9px] font-bold uppercase tracking-[0.12em] whitespace-nowrap',
        className
      )}
      style={{ background: cf.bg, border: `1px solid ${cf.bd}`, color: cf.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cf.dot }} />
      {meta.label}
    </span>
  )
}
