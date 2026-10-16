import bundled from '../data/dashboard.json'
import type { Account, Block2031, Dashboard, MetricRec, Scenario, Selection, AddrCase } from '../types'

export const BUNDLED = bundled as unknown as Dashboard

/** API mode: when served next to the FastAPI backend, fetch the live dataset (incl. management inputs). */
export async function loadDashboard(): Promise<{ data: Dashboard; mode: 'api' | 'static' }> {
  try {
    const r = await fetch('/api/dashboard', { headers: { Accept: 'application/json' } })
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return { data: (await r.json()) as Dashboard, mode: 'api' }
  } catch { /* static build — no backend */ }
  return { data: BUNDLED, mode: 'static' }
}

export function block2031(a: Account, s: Scenario): Block2031 { return a.m['2031'][s] }

/* vNext D1 — Target display. Only MANAGEMENT_APPROVED targets are shown by default. A scenario target
   (FPR×attainment) is revealed only when the user explicitly toggles it on; it is never an official KPI/sum. */
let SHOW_SCENARIO_TARGET = false
export function setScenarioTargetVisible(v: boolean) { SHOW_SCENARIO_TARGET = v }
export function scenarioTargetVisible() { return SHOW_SCENARIO_TARGET }
export function isApprovedTarget(r: MetricRec | null | undefined) { return !!r && r.target_source === 'MANAGEMENT_APPROVED' }
const MASKED = new WeakMap<MetricRec, MetricRec>()
/** Returns the record as-is when approved (or when the scenario toggle is on); otherwise a masked copy with value null. */
export function targetView(r: MetricRec): MetricRec {
  if (r.value === null || isApprovedTarget(r) || SHOW_SCENARIO_TARGET) return r
  let m = MASKED.get(r)
  if (!m) {
    m = { ...r, value: null, low: null, high: null, status: 'UNKNOWN', masked: true,
      notes: ['경영진 승인 Target 없음 — INTERNAL INPUT REQUIRED. 시나리오 목표(FPR×달성률)는 "시나리오 목표 보기"를 켤 때만 참고용으로 표시됩니다.', ...r.notes] }
    MASKED.set(r, m)
  }
  return m
}

/** Resolve a chart selection to the underlying metric record (the single source for tooltip + inspector). */
export function resolveMetric(a: Account, sel: Selection, scen: Scenario, addr: AddrCase): { rec: MetricRec | null; label: string } {
  const b = a.m['2031'][scen]
  if (sel.year === 2026) {
    switch (sel.metric) {
      case 'TS': return { rec: a.m['2026'].TS, label: 'TS 2026' }
      case 'RAW': return { rec: a.m['2026'].RAW, label: 'RAW 2026' }
      case 'FPR': return { rec: a.m['2026'].FPR, label: 'FPR 2026' }
      case 'REV': return { rec: a.m['2026'].CR, label: 'Current Revenue 2026' }
      case 'CSOW': return { rec: a.m['2026'].CSOW, label: 'C-SOW 2026' }
      case 'PCR': return { rec: a.m['2026'].PCR, label: 'Potential Capture Rate 2026' }
      case 'UPSIDE': return { rec: a.m['2026'].UPSIDE, label: 'Upside 2026' }
    }
  } else {
    switch (sel.metric) {
      case 'TS': return { rec: b.TS, label: `TS 2031 (${scen})` }
      case 'RAW': return { rec: addr === 'base' ? b.RAW_base : b.RAW_expansion, label: `RAW 2031 (${scen}, ${addr === 'base' ? 'Base Case' : 'Strategic Expansion'})` }
      case 'FPR': return { rec: addr === 'base' ? b.FPR_base : b.FPR_expansion, label: `FPR 2031 (${scen}, ${addr === 'base' ? 'Base Case' : 'Strategic Expansion'})` }
      case 'REV': return { rec: targetView(a.m.target.TARGET), label: isApprovedTarget(a.m.target.TARGET) ? '2031 Target Revenue' : '2031 Target Revenue (시나리오 참고값)' }
      case 'TARGET_SOW': return { rec: targetView(a.m.target.TARGET_SOW), label: 'Target SOW 2031' }
      case 'TS_CAGR': return { rec: b.TS_CAGR, label: `TS CAGR 2026–31 (${scen})` }
      case 'RAW_CAGR': return { rec: b.RAW_CAGR, label: `RAW CAGR 2026–31 (${scen})` }
      case 'FPR_CAGR': return { rec: b.FPR_CAGR, label: `FPR CAGR 2026–31 (${scen})` }
      case 'UPSIDE': return { rec: a.m.target.UPSIDE_2031, label: 'Estimated Upside 2031' }
    }
  }
  return { rec: null, label: '' }
}

export function evidenceCount(a: Account, rec: MetricRec | null): number {
  if (!rec) return 0
  const ids = new Set(rec.evidence_ids)
  rec.inputs?.forEach(i => i.evidence_ids?.forEach(e => ids.add(e)))
  return [...ids].filter(id => a.evidence.some(e => e.evidence_id === id)).length
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}
