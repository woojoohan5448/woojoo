import { describe, expect, it } from 'vitest'
import { eok, pct, roundForStatus } from '../lib/format'
import { BUNDLED, resolveMetric } from '../lib/data'
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
    expect(resolveMetric(a, { year: 2031, metric: 'REV' }, 'base', 'base').rec).toBe(a.m.target.TARGET)
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
    expect(main.data[3].label.formatter()).toBe('INTERNAL INPUT REQUIRED')  // missing CR shows its reason class, never 0
  })
  it('category and bridge options build for estimated accounts and return null bridge for unknown', () => {
    expect((categoryOption(a, 2026, 'base', 'base', { year: 2026, metric: 'TS' }, P) as any).series.length).toBe(3)
    expect(bridgeOption(a, 'base', { year: 2031, metric: 'TS' }, P)).not.toBeNull()
    const u = BUNDLED.accounts.find(x => x.m['2026'].TS.value === null && x.m['2026'].RAW.value === null)!
    expect(bridgeOption(u, 'base', { year: 2031, metric: 'TS' }, P)).toBeNull()
  })
})
