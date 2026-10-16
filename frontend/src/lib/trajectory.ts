import type { Account, AddrCase, MetricRec, Scenario } from '../types'
import { isApprovedTarget, scenarioTargetVisible } from './data'

/** 2026–2031 Opportunity Growth Trajectory — derived purely from existing engine values (no source data changed). */
export const YEARS = [2026, 2027, 2028, 2029, 2030, 2031] as const
export type Year = typeof YEARS[number]
export type TrajMetric = 'TS' | 'RAW' | 'FPR'
export type PointKind = 'BASE_2026' | 'ILLUSTRATIVE' | 'FORECAST_2031'

/**
 * Geometric (CAGR) interpolation between two engine endpoints:
 *   Value_y = Value_2026 × (Value_2031 / Value_2026)^((y − 2026) / 5)
 * Only when both endpoints are valid positive numbers; endpoints are returned unchanged (exact engine values).
 */
export function interpolate(v26: number | null | undefined, v31: number | null | undefined): number[] | null {
  if (v26 == null || v31 == null || !(v26 > 0) || !(v31 > 0) || !isFinite(v26) || !isFinite(v31)) return null
  return YEARS.map((y, i) => (i === 0 ? v26 : i === 5 ? v31 : v26 * Math.pow(v31 / v26, (y - 2026) / 5)))
}

export interface TrajSeries {
  metric: TrajMetric
  rec26: MetricRec; rec31: MetricRec
  values: (number | null)[]          // 6 points; null where not computable (never 0-filled)
  low: number[] | null                // Low scenario path (2026 base → 2031 Low)
  high: number[] | null               // High scenario path (2026 base → 2031 High)
  interpolated: boolean              // false when only endpoints exist (no illustrative path)
}
export interface Trajectory {
  series: TrajSeries[]
  cr: MetricRec | null               // 2026 point only when an internal CR exists
  target: { rec: MetricRec; approved: boolean } | null  // 2031 marker: approved, or scenario only when toggled on
  crMissing: boolean; targetMissing: boolean
  violations: { year: Year; detail: string }[]   // hierarchy TS ≥ RAW ≥ FPR checks
  definitionMismatch: boolean
}

function rec31(a: Account, s: Scenario, m: TrajMetric, addr: AddrCase): MetricRec {
  const b = a.m['2031'][s]
  return m === 'TS' ? b.TS : m === 'RAW' ? (addr === 'base' ? b.RAW_base : b.RAW_expansion) : (addr === 'base' ? b.FPR_base : b.FPR_expansion)
}

export function trajectory(a: Account, scen: Scenario, addr: AddrCase): Trajectory {
  const series: TrajSeries[] = (['TS', 'RAW', 'FPR'] as TrajMetric[]).map(m => {
    const r26 = a.m['2026'][m], r31 = rec31(a, scen, m, addr)
    const path = interpolate(r26.value, r31.value)
    const values: (number | null)[] = path ?? YEARS.map((_, i) => (i === 0 ? r26.value : i === 5 ? r31.value : null))
    const lo = interpolate(r26.value, rec31(a, 'low', m, addr).value)
    const hi = interpolate(r26.value, rec31(a, 'high', m, addr).value)
    return { metric: m, rec26: r26, rec31: r31, values, low: lo, high: hi, interpolated: !!path }
  })
  const violations: { year: Year; detail: string }[] = []
  YEARS.forEach((y, i) => {
    const [ts, raw, fpr] = series.map(s => s.values[i])
    if (ts != null && raw != null && raw > ts * (1 + 1e-9)) violations.push({ year: y, detail: `RAW > TS (${y})` })
    if (raw != null && fpr != null && fpr > raw * (1 + 1e-9)) violations.push({ year: y, detail: `FPR > RAW (${y})` })
  })
  const crRec = a.m['2026'].CR
  const t = a.m.target.TARGET
  const approved = isApprovedTarget(t)
  const showTarget = t.value != null && (approved || scenarioTargetVisible())
  return {
    series,
    cr: crRec.value != null ? crRec : null,
    target: showTarget ? { rec: t, approved } : null,
    crMissing: crRec.value == null,
    targetMissing: !approved,
    violations,
    definitionMismatch: a.aggregate_class === 'DEFINITION_MISMATCH',
  }
}

export const pointKind = (i: number): PointKind => (i === 0 ? 'BASE_2026' : i === 5 ? 'FORECAST_2031' : 'ILLUSTRATIVE')
export const KIND_LABEL: Record<PointKind, string> = { BASE_2026: '2026 기준값', ILLUSTRATIVE: 'Illustrative Projection (예시 경로)', FORECAST_2031: '2031 전망' }
export const ILLUSTRATIVE_NOTE = '2027~2030년은 2026년 기준값과 2031년 전망을 연결한 예시 성장 경로이며, 확정 사업계획이 아닙니다.'
