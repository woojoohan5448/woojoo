import { describe, expect, it } from 'vitest'
import { eok, pct, roundForStatus } from '../lib/format'
import { BUNDLED, resolveMetric, setScenarioTargetVisible } from '../lib/data'
import { FRAMEWORK, GLOSSARY, termLabel } from '../lib/glossary'
import { interpolate, trajectory } from '../lib/trajectory'
import { trajectoryOption } from '../components/trajectoryChart'
import type { AddrCase, Scenario } from '../types'
import { opportunityOption, categoryOption, bridgeOption, type Palette } from '../components/charts'

const P: Palette = { ts: '#2a78d6', raw: '#1baf7a', fpr: '#c4006f', rev: '#eb6834', ink1: '#111', ink2: '#444', ink3: '#777', line: '#ddd', surface: '#fff', sunk: '#eee' }

describe('format', () => {
  it('rounds estimates to 2 significant digits, verified to 1억', () => {
    expect(roundForStatus(5580.75, 'ESTIMATED')).toBe(5600)
    expect(roundForStatus(5580.75, 'VERIFIED')).toBe(5581)
    expect(eok(27525.75, 'ESTIMATED')).toBe('≈2.8조원')
    expect(eok(null)).toBe('N/A')
    expect(pct(0.1234)).toBe('12.3%')
  })
})

describe('dataset', () => {
  it('has 53 accounts and is not test data', () => {
    expect(BUNDLED.accounts.length).toBe(53)
    expect(BUNDLED.meta.is_test_data).toBe(false)
  })
  it('resolves chart selections to the same records shown in the inspector', () => {
    const a = BUNDLED.accounts.find(x => x.account_id === 'KA03')!
    expect(resolveMetric(a, { year: 2026, metric: 'TS' }, 'base', 'base').rec).toBe(a.m['2026'].TS)
    expect(resolveMetric(a, { year: 2031, metric: 'FPR' }, 'high', 'expansion').rec).toBe(a.m['2031'].high.FPR_expansion)
    // D1: without an approved target the scenario target is masked (INTERNAL INPUT REQUIRED) unless explicitly toggled
    expect(resolveMetric(a, { year: 2031, metric: 'REV' }, 'base', 'base').rec?.value).toBeNull()
    setScenarioTargetVisible(true)
    expect(resolveMetric(a, { year: 2031, metric: 'REV' }, 'base', 'base').rec).toBe(a.m.target.TARGET)
    setScenarioTargetVisible(false)
    expect(resolveMetric(a, { year: 2026, metric: 'REV' }, 'base', 'base').rec?.value).toBeNull()
  })
})

describe('chart options', () => {
  const a = BUNDLED.accounts.find(x => x.account_id === 'KA03')!
  it('uses identical grid widths for 2026 and 2031 (comparable axis) and a shared max', () => {
    const o: any = opportunityOption(a, 'base', 'base', { year: 2026, metric: 'TS' }, P, false)
    expect(o.grid[0].width).toBe(o.grid[1].width)
    expect(o.xAxis[0].max).toBe(o.xAxis[1].max)
  })
  it('highlights the selected bar and labels missing CR with its N/A reason class (not zero)', () => {
    const o: any = opportunityOption(a, 'base', 'base', { year: 2026, metric: 'RAW' }, P, false)
    const main = o.series.filter((s: any) => s.type === 'bar' && s.name === '2026')[0]
    expect(main.data[1].itemStyle.borderWidth).toBe(2.5)
    expect(main.data[3].label.formatter()).toBe('사내 매출 미입력')  // missing CR shows its reason class, never 0
  })
  it('category and bridge options build for estimated accounts and return null bridge for unknown', () => {
    expect((categoryOption(a, 2026, 'base', 'base', { year: 2026, metric: 'TS' }, P) as any).series.length).toBe(3)
    expect(bridgeOption(a, 'base', { year: 2031, metric: 'TS' }, P)).not.toBeNull()
    const u = BUNDLED.accounts.find(x => x.m['2026'].TS.value === null && x.m['2026'].RAW.value === null)!
    expect(bridgeOption(u, 'base', { year: 2031, metric: 'TS' }, P)).toBeNull()
  })
})

describe('vNext glossary & D1', () => {
  it('preserves the ①~⑧ framework terms verbatim (incl. "Realistical") with Korean meanings', () => {
    expect(FRAMEWORK.map(t => t.no)).toEqual(['①', '②', '③', '④', '⑤-1', '⑤-2', '⑥', '⑦', '⑧', '⑧'])
    expect(GLOSSARY.RAW.en).toBe('Realistical Addressable Wallet')
    expect(termLabel('RAW', 'full')).toBe('② Realistical Addressable Wallet (RAW) (LGU+ 공략 가능 시장)')
    expect(termLabel('RAW', 'kpi')).toBe('RAW (LGU+ 공략 가능 시장)')
    expect(termLabel('RAW', 'short')).toBe('RAW')
    for (const t of FRAMEWORK) { expect(t.ko.length).toBeGreaterThan(0); expect(t.definition.length).toBeGreaterThan(0) }
  })
  it('official 2031 Target aggregate excludes scenario targets', () => {
    const a31 = BUNDLED.portfolio.aggregate['2031_base']
    expect(a31.n_target_approved).toBe(0)
    expect(a31.TARGET).toBeNull()
    expect(a31.TARGET_scenario).toBeGreaterThan(0)
  })
  it('evidence status is separate from strategy score for every business area', () => {
    for (const s of BUNDLED.strategy) {
      expect(s.evidence).toBeDefined()
      expect(['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT']).toContain(s.evidence!.evidence_level)
      expect(s.evidence!.n_accounts_signal).toBeLessThanOrEqual(s.evidence!.n_accounts_model)
    }
  })
})

describe('vNext correction — 2026–2031 Opportunity Growth Trajectory', () => {
  const SC: Scenario[] = ['low', 'base', 'high']
  const AD: AddrCase[] = ['base', 'expansion']
  it('chart endpoints equal engine values exactly for all 53 accounts × 3 scenarios × 2 cases (no 0-fill)', () => {
    let checked = 0
    for (const a of BUNDLED.accounts) for (const s of SC) for (const d of AD) {
      const t = trajectory(a, s, d)
      for (const x of t.series) {
        const r31 = x.metric === 'TS' ? a.m['2031'][s].TS : x.metric === 'RAW' ? (d === 'base' ? a.m['2031'][s].RAW_base : a.m['2031'][s].RAW_expansion) : (d === 'base' ? a.m['2031'][s].FPR_base : a.m['2031'][s].FPR_expansion)
        expect(x.values[0]).toBe(a.m['2026'][x.metric].value)
        expect(x.values[5]).toBe(r31.value)
        x.values.forEach(v => { if (v !== null) expect(v).toBeGreaterThan(0) })
        checked++
      }
    }
    expect(checked).toBe(53 * 3 * 2 * 3)
  })
  it('interpolates 2027–2030 with the CAGR formula and refuses invalid endpoints', () => {
    const v = interpolate(100, 200)!
    for (let i = 1; i < 5; i++) expect(v[i]).toBeCloseTo(100 * Math.pow(2, i / 5), 10)
    expect(interpolate(null, 200)).toBeNull(); expect(interpolate(0, 200)).toBeNull(); expect(interpolate(100, -1)).toBeNull()
  })
  it('keeps TS ≥ RAW ≥ FPR on every interpolated year for all accounts', () => {
    for (const a of BUNDLED.accounts) expect(trajectory(a, 'base', 'base').violations).toEqual([])
  })
  it('shows no CR point and no Target marker without internal data; scenario target only when toggled', () => {
    const a = BUNDLED.accounts.find(x => x.account_id === 'KA03')!
    let t = trajectory(a, 'base', 'base')
    expect(t.cr).toBeNull(); expect(t.target).toBeNull(); expect(t.crMissing && t.targetMissing).toBe(true)
    setScenarioTargetVisible(true)
    t = trajectory(a, 'base', 'base')
    expect(t.target?.approved).toBe(false)
    setScenarioTargetVisible(false)
    const o: any = trajectoryOption(trajectory(a, 'base', 'base'), P, { band: true, log: false })
    expect(o.yAxis.type).toBe('value')                       // single linear axis, no dual axis
    expect(Array.isArray(o.yAxis)).toBe(false)
    expect(o.series.filter((x: any) => x.id?.startsWith('line-')).map((x: any) => x.id)).toEqual(['line-TS', 'line-RAW', 'line-FPR'])
    expect(o.series.some((x: any) => x.id?.startsWith('line-') && x.stack)).toBe(false)  // lines are never stacked
    expect(o.series.some((x: any) => x.id === 'target' || x.id === 'cr')).toBe(false)
  })
})
