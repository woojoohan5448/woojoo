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
      case 'REV': return { rec: a.m.target.TARGET, label: '2031 Target Revenue' }
      case 'TARGET_SOW': return { rec: a.m.target.TARGET_SOW, label: 'Target SOW 2031' }
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
