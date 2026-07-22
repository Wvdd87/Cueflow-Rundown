import { CF } from '@/components/rundown/layout'

// Generic placeholder column widths — real columns aren't known until data loads.
const SKELETON_COL_WIDTHS = [130, 160, 110]
const SKELETON_ROWS = 9

function Block({ width, height = 20 }: { width: number | string; height?: number }) {
  return <div className="cf-skeleton shrink-0" style={{ width, height }} />
}

export default function RundownLoading() {
  const rowWidth =
    CF.rowPad * 2 +
    CF.c1 +
    CF.num +
    CF.start +
    CF.dur +
    260 +
    SKELETON_COL_WIDTHS.reduce((a, b) => a + b, 0) +
    CF.pn +
    CF.gap * (4 + SKELETON_COL_WIDTHS.length)

  return (
    <div className="flex flex-col h-full bg-[#09090d] overflow-hidden" data-testid="rundown-skeleton">
      {/* Header bar */}
      <header className="flex items-center gap-3 px-5 h-14 border-b border-[#1d1d24] bg-[#07070a] shrink-0">
        <div className="w-[30px] h-[30px] cf-skeleton shrink-0" />
        <Block width={180} height={18} />
        <Block width={72} height={22} />
        <div className="flex-1" />
        <Block width={220} height={32} />
        <Block width={80} height={36} />
        <Block width={110} height={36} />
      </header>

      {/* Column header bar */}
      <div
        className="flex items-stretch shrink-0 border-b border-[#1d1d24]"
        style={{ gap: CF.gap, padding: `0 ${CF.rowPad}px`, height: CF.headerH, width: rowWidth, maxWidth: '100%' }}
      >
        <div style={{ width: CF.c1 }} />
        <Block width={CF.num} height={CF.headerH - 10} />
        <Block width={CF.start} height={CF.headerH - 10} />
        <Block width={CF.dur} height={CF.headerH - 10} />
        <Block width={260} height={CF.headerH - 10} />
        {SKELETON_COL_WIDTHS.map((w, i) => (
          <Block key={i} width={w} height={CF.headerH - 10} />
        ))}
        <Block width={CF.pn} height={CF.headerH - 10} />
      </div>

      {/* Cue rows */}
      <div className="flex-1 overflow-hidden px-0 py-2">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div
            key={i}
            className="flex items-center"
            style={{
              gap: CF.gap,
              padding: `0 ${CF.rowPad}px`,
              width: rowWidth,
              maxWidth: '100%',
              height: CF.minRowH,
              marginBottom: CF.gap,
              opacity: 1 - i * 0.07,
            }}
          >
            <div style={{ width: CF.c1 }} />
            <Block width={CF.num} height={CF.minRowH - 20} />
            <Block width={CF.start} height={CF.minRowH - 20} />
            <Block width={CF.dur} height={CF.minRowH - 20} />
            <Block width={260} height={CF.minRowH - 20} />
            {SKELETON_COL_WIDTHS.map((w, j) => (
              <Block key={j} width={w} height={CF.minRowH - 20} />
            ))}
            <Block width={CF.pn} height={CF.minRowH - 20} />
          </div>
        ))}
      </div>
    </div>
  )
}
