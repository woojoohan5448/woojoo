import type { Account, AddrCase, Dashboard, MetricRec, Scenario } from '../types'
import { YEARS, interpolate, type TrajMetric, type TrajSeries, type Trajectory } from './trajectory'

/**
 * ② 전사 기회 분석 — 2026–2031 integrated growth trajectory (53 KA), per metric.
 * Rules (no source value changed, nothing 0-filled):
 *  - Same-customer set per metric: accounts with BOTH 2026 and 2031 values, excluding DEFINITION_MISMATCH
 *    (and overlap-risk accounts when `excludeOverlap`). Endpoints = exact sums of engine values over that set.
 *  - Growth (CAGR) is computed on that same set only.
 *  - Yearly totals (each year's own computable set) are reported separately and are NOT the chart line.
 *  - 2027–2030: CAGR interpolation of the summed endpoints (Illustrative, same formula as the account chart).
 */
export interface MetricAgg {
  metric: TrajMetric
  included: string[]                      // same-customer set
  v26: number; v31: number                 // exact endpoint sums over `included`
  low31: number | null; high31: number | null
  cagr: number | null                      // same-set CAGR
  yearly: { y2026: { sum: number; n: number }; y2031: { sum: number; n: number } }   // each year's own set (≠ same set)
  mismatch: { ids: string[]; v26: number; v31: number }   // definition mismatch — reported separately
  missing: { only2026: string[]; only2031: string[]; none: string[] }
  overlap: { ids: string[]; share31: number | null; excluded: boolean }
  contributions: { account_id: string; v26: number; v31: number }[]
}
export interface PortfolioTraj { aggs: MetricAgg[]; traj: Trajectory; n_total: number; caseLabel: string; risk: Map<string, string> }

function val31(a: Account, s: Scenario, m: TrajMetric, addr: AddrCase): number | null {
  const b = a.m['2031'][s]
  const r = m === 'TS' ? b.TS : m === 'RAW' ? (addr === 'base' ? b.RAW_base : b.RAW_expansion) : (addr === 'base' ? b.FPR_base : b.FPR_expansion)
  return r.value
}
/** Accounts in an overlap group of HIGH/MEDIUM risk (consolidation or supplier–buyer double count).
 *  LOW-risk affiliate groups are summable on a standalone (KISA) basis and are not flagged. */
export function overlapRisk(d: Pick<Dashboard, 'portfolio'>): Map<string, string> {
  const m = new Map<string, string>()
  for (const g of d.portfolio.overlap_groups) {
    if (g.risk !== 'HIGH' && g.risk !== 'MEDIUM') continue
    for (const id of g.members) if (m.get(id) !== 'HIGH') m.set(id, g.risk)
  }
  return m
}

export function metricAgg(accounts: Account[], m: TrajMetric, scen: Scenario, addr: AddrCase, excludeOverlap: boolean, risk: Map<string, string> = new Map()): MetricAgg {
  const out: MetricAgg = { metric: m, included: [], v26: 0, v31: 0, low31: 0, high31: 0, cagr: null,
    yearly: { y2026: { sum: 0, n: 0 }, y2031: { sum: 0, n: 0 } }, mismatch: { ids: [], v26: 0, v31: 0 },
    missing: { only2026: [], only2031: [], none: [] }, overlap: { ids: [], share31: null, excluded: excludeOverlap }, contributions: [] }
  let ov31 = 0
  for (const a of accounts) {
    const v26 = a.m['2026'][m].value, v31 = val31(a, scen, m, addr)
    if (a.aggregate_class === 'DEFINITION_MISMATCH') {
      if (v26 != null || v31 != null) { out.mismatch.ids.push(a.account_id); out.mismatch.v26 += v26 ?? 0; out.mismatch.v31 += v31 ?? 0 }
      continue
    }
    if (v26 != null) { out.yearly.y2026.sum += v26; out.yearly.y2026.n++ }
    if (v31 != null) { out.yearly.y2031.sum += v31; out.yearly.y2031.n++ }
    if (v26 == null || v31 == null) {
      (v26 == null && v31 == null ? out.missing.none : v26 == null ? out.missing.only2031 : out.missing.only2026).push(a.account_id)
      continue
    }
    if (risk.has(a.account_id)) {
      out.overlap.ids.push(a.account_id)
      if (excludeOverlap) continue
      ov31 += v31
    }
    const lo = val31(a, 'low', m, addr), hi = val31(a, 'high', m, addr)
    out.included.push(a.account_id)
    out.v26 += v26; out.v31 += v31
    out.low31 = lo == null || out.low31 == null ? null : out.low31 + lo
    out.high31 = hi == null || out.high31 == null ? null : out.high31 + hi
    out.contributions.push({ account_id: a.account_id, v26, v31 })
  }
  out.contributions.sort((x, y) => y.v31 - x.v31)
  out.cagr = out.v26 > 0 && out.v31 > 0 ? Math.pow(out.v31 / out.v26, 1 / 5) - 1 : null
  out.overlap.share31 = !excludeOverlap && out.v31 > 0 ? ov31 / out.v31 : null
  return out
}

export function portfolioTrajectory(d: Dashboard, scen: Scenario, addr: AddrCase, excludeOverlap = false): PortfolioTraj {
  const risk = overlapRisk(d)
  const aggs = (['TS', 'RAW', 'FPR'] as TrajMetric[]).map(m => metricAgg(d.accounts, m, scen, addr, excludeOverlap, risk))
  const rec = (v: number | null): MetricRec => ({ value: v, low: null, high: null, status: 'ESTIMATED', confidence: 0, formula: '', inputs: [], evidence_ids: [], assumption_ids: [], notes: [], unit: '억원' } as unknown as MetricRec)
  const series: TrajSeries[] = aggs.filter(g => g.included.length > 0).map(g => {
    const path = interpolate(g.v26, g.v31)
    return { metric: g.metric, rec26: rec(g.v26), rec31: rec(g.v31), values: path ?? YEARS.map((_, i) => (i === 0 ? g.v26 : i === 5 ? g.v31 : null)),
      low: g.low31 != null ? interpolate(g.v26, g.low31) : null, high: g.high31 != null ? interpolate(g.v26, g.high31) : null, interpolated: !!path }
  })
  const violations: Trajectory['violations'] = []
  return { aggs, risk, n_total: d.accounts.length, caseLabel: `${scen.toUpperCase()} · ${addr === 'base' ? 'Base Case' : 'Strategic Expansion'}`,
    traj: { series, cr: null, target: null, crMissing: false, targetMissing: false, violations, definitionMismatch: false } }
}
