import type { Status } from '../types'
import { STATUS_LABEL } from '../lib/format'

const STATUS_STYLE: Record<Status, { fg: string; icon: string }> = {
  VERIFIED: { fg: 'var(--ok)', icon: '●' },
  DERIVED: { fg: 'var(--ok)', icon: '◐' },
  ESTIMATED: { fg: 'var(--warn)', icon: '◒' },
  SCENARIO: { fg: 'var(--c-ts)', icon: '◇' },
  UNKNOWN: { fg: 'var(--ink-3)', icon: '○' },
}

export function StatusBadge({ status, compact }: { status: Status; compact?: boolean }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.UNKNOWN
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold border border-line bg-sunk text-ink2 whitespace-nowrap"
      title={`${status}: ${STATUS_LABEL[status]}`}>
      <span style={{ color: s.fg }} aria-hidden>{s.icon}</span>{compact ? STATUS_LABEL[status] : `${status} · ${STATUS_LABEL[status]}`}
    </span>
  )
}

export function ConfidenceMeter({ value, width = 64 }: { value: number; width?: number }) {
  const v = Math.max(0, Math.min(100, value || 0))
  const tone = v >= 60 ? 'var(--ok)' : v >= 35 ? 'var(--warn)' : 'var(--err)'
  return (
    <span className="inline-flex items-center gap-1.5" title={`신뢰도 ${v}/100 (분석 품질 점수, 확률 아님)`}>
      <span className="relative inline-block h-1.5 rounded-full bg-sunk" style={{ width }}>
        <span className="absolute left-0 top-0 h-1.5 rounded-full" style={{ width: `${v}%`, background: tone }} />
      </span>
      <span className="num text-[11px] text-ink2">{v}</span>
    </span>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warn' | 'err' | 'ok' | 'brand' }) {
  const color = { neutral: 'var(--ink-2)', warn: 'var(--warn)', err: 'var(--err)', ok: 'var(--ok)', brand: 'var(--brand)' }[tone]
  return <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-medium" style={{ color }}>{children}</span>
}

export function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: color }} aria-hidden />
}
