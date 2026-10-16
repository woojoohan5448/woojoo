import { describe, expect, it } from 'vitest'
import { BUNDLED } from '../lib/data'
import { metricAgg, overlapRisk, portfolioTrajectory } from '../lib/portfolioTrajectory'
import { trajectoryOption } from '../components/trajectoryChart'
import type { AddrCase, Scenario } from '../types'

const D = BUNDLED
const P = { ts: '#1', raw: '#2', fpr: '#3', rev: '#4', ink1: '#5', ink2: '#6', ink3: '#7', line: '#8', surface: '#9', sunk: '#0' }
const S: Scenario[] = ['low', 'base', 'high'], C: AddrCase[] = ['base', 'expansion']
const v31 = (a: any, s: Scenario, m: string, c: AddrCase) => (m === 'TS' ? a.m['2031'][s].TS : a.m['2031'][s][`${m}_${c}`]).value

describe('② portfolio trajectory (same-customer set)', () => {
  it('endpoints are exact sums of engine values over the same set; nothing 0-filled', () => {
    let checks = 0
    for (const s of S) for (const c of C) {
      const pt = portfolioTrajectory(D, s, c)
      for (const g of pt.aggs) {
        const set = D.accounts.filter(a => g.included.includes(a.account_id))
        expect(set.every(a => a.m['2026'][g.metric].value != null && v31(a, s, g.metric, c) != null)).toBe(true)
        expect(g.v26).toBeCloseTo(set.reduce((t, a) => t + a.m['2026'][g.metric].value!, 0), 6)
        expect(g.v31).toBeCloseTo(set.reduce((t, a) => t + v31(a, s, g.metric, c), 0), 6)
        expect(g.cagr!).toBeCloseTo(Math.pow(g.v31 / g.v26, 0.2) - 1, 12)
        // partition: included ∪ mismatch ∪ missing (∪ overlap-excluded) = 53, disjoint
        const all = [...g.included, ...g.mismatch.ids, ...g.missing.none, ...g.missing.only2026, ...g.missing.only2031]
        const mismatchNoValue = D.accounts.filter(a => a.aggregate_class === 'DEFINITION_MISMATCH' && !g.mismatch.ids.includes(a.account_id)).length
        expect(new Set(all).size).toBe(all.length)
        expect(all.length + mismatchNoValue).toBe(53)
        expect(g.included.length).toBeLessThan(53)
        // chart endpoints = sums (label endpoints exact), mismatch never inside
        const line = pt.traj.series.find(x => x.metric === g.metric)!
        expect(line.values[0]).toBe(g.v26); expect(line.values[5]).toBe(g.v31)
        expect(g.included.some(id => g.mismatch.ids.includes(id))).toBe(false)
        checks++
      }
    }
    expect(checks).toBe(18)
  })

  it('yearly totals reproduce the engine portfolio aggregate (Base Case)', () => {
    for (const s of S) {
      const pt = portfolioTrajectory(D, s, 'base')
      const ag31 = D.portfolio.aggregate[`2031_${s}`], ag26 = D.portfolio.aggregate['2026_base']
      const by = Object.fromEntries(pt.aggs.map(g => [g.metric, g]))
      expect(by.TS.yearly.y2026.sum).toBeCloseTo(ag26.TS, 1); expect(by.TS.yearly.y2026.n).toBe(ag26.n_ts)
      expect(by.RAW.yearly.y2026.sum).toBeCloseTo(ag26.RAW, 1); expect(by.FPR.yearly.y2026.n).toBe(ag26.n_fpr)
      expect(by.TS.yearly.y2031.sum).toBeCloseTo(ag31.TS, 1); expect(by.RAW.yearly.y2031.sum).toBeCloseTo(ag31.RAW, 1)
      expect(by.FPR.yearly.y2031.sum).toBeCloseTo(ag31.FPR, 1); expect(by.FPR.yearly.y2031.n).toBe(ag31.n_fpr)
      expect(by.TS.mismatch.ids.length).toBe(ag26.n_mismatch)
    }
  })

  it('overlap risk is flagged (HIGH/MEDIUM only) and exclusion shrinks the set without touching others', () => {
    const risk = overlapRisk(D)
    expect([...risk.values()].every(r => r === 'HIGH' || r === 'MEDIUM')).toBe(true)
    const inc = metricAgg(D.accounts, 'FPR', 'base', 'base', false, risk)
    const exc = metricAgg(D.accounts, 'FPR', 'base', 'base', true, risk)
    expect(exc.included.length).toBe(inc.included.length - inc.overlap.ids.length)
    expect(exc.included.every(id => !risk.has(id))).toBe(true)
    expect(inc.overlap.share31!).toBeGreaterThan(0); expect(inc.overlap.share31!).toBeLessThan(1)
  })

  it('chart: single linear axis, no stacking of metric lines, FPR auxiliary chart shows FPR only', () => {
    const pt = portfolioTrajectory(D, 'base', 'base')
    const o: any = trajectoryOption(pt.traj, P, { band: true, log: false })
    expect(Array.isArray(o.yAxis)).toBe(false)
    expect(o.series.filter((x: any) => x.id?.startsWith('line-')).every((x: any) => !x.stack)).toBe(true)
    const aux: any = trajectoryOption({ ...pt.traj, series: pt.traj.series.filter(x => x.metric === 'FPR') }, P, { band: true, log: false })
    expect(aux.series.filter((x: any) => x.id?.startsWith('line-')).map((x: any) => x.id)).toEqual(['line-FPR'])
  })
})

describe('ledger (recon block in bundled data)', () => {
  it('every account has 21 external entries + CR + Target with provenance; all default to the external model', () => {
    const R = D.recon!
    expect(Object.keys(R.accounts)).toHaveLength(53)
    expect(R.n_switched).toBe(0)
    for (const a of D.accounts) {
      const led = R.accounts[a.account_id].ledger
      expect(led).toHaveLength(23)
      for (const e of led.filter(e => /^(TS|RAW|FPR)\|/.test(e.key))) {
        expect(e.official_source).toBe('EXTERNAL_MODEL')
        expect(['MODEL_DEFAULT', 'RESEARCH_GAP']).toContain(e.approval_status)
        expect(Array.isArray(e.evidence_ids)).toBe(true)
        const [m, y, sc, cs] = e.key.split('|')
        const rec = y === '2026' ? (a.m['2026'] as any)[m] : m === 'TS' ? a.m['2031'][sc.toLowerCase() as Scenario].TS : (a.m['2031'][sc.toLowerCase() as Scenario] as any)[`${m}_${cs === 'BASE_CASE' ? 'base' : 'expansion'}`]
        expect(e.value_eok).toBe(rec.value)
      }
      const t = led.find(e => e.key === 'TARGET|2031|APPROVED')!
      expect(t.value_eok).toBeNull(); expect(t.approval_status).toBe('NOT_PROVIDED')
    }
  })
})
