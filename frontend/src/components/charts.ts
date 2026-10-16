/** Pure ECharts option builders (unit-testable, no DOM). */
import type { Account, AddrCase, Category, MetricKey, Scenario, Selection } from '../types'
import { CAT_LABEL, STATUS_LABEL, eok, pct } from '../lib/format'
import { evidenceCount, resolveMetric } from '../lib/data'

export interface Palette { ts: string; raw: string; fpr: string; rev: string; ink1: string; ink2: string; ink3: string; line: string; surface: string; sunk: string }

const ROWS: MetricKey[] = ['TS', 'RAW', 'FPR', 'REV']
const PARENT: Partial<Record<MetricKey, MetricKey>> = { RAW: 'TS', FPR: 'RAW', REV: 'FPR' }
export const metricColor = (p: Palette, m: MetricKey) => ({ TS: p.ts, RAW: p.raw, FPR: p.fpr, REV: p.rev }[m])
export const rowLabel = (m: MetricKey, year: 2026 | 2031) =>
  ({ TS: 'TS  Total IT Spending', RAW: 'RAW  Addressable Wallet', FPR: 'FPR  Full Potential', REV: year === 2026 ? 'CR  Current Revenue' : 'Target Revenue' }[m])
const SHORT: Record<MetricKey, string> = { TS: 'TS', RAW: 'RAW', FPR: 'FPR', REV: 'CR│Target' }

function tooltipHtml(a: Account, year: 2026 | 2031, m: MetricKey, scen: Scenario, addr: AddrCase): string {
  const { rec, label } = resolveMetric(a, { year, metric: m }, scen, addr)
  if (!rec) return ''
  const val = rec.value === null ? 'N/A (미확인·미입력)' : eok(rec.value, rec.status)
  const range = rec.low !== null && rec.high !== null && rec.value !== null ? `<div>범위 ${eok(rec.low, 'ESTIMATED', { approx: false })} ~ ${eok(rec.high, 'ESTIMATED', { approx: false })}</div>` : ''
  return `<div style="font-size:12px;line-height:1.5"><b>${label}</b><div style="font-size:14px;font-weight:700">${val}</div>${range}
    <div>상태: ${rec.status} (${STATUS_LABEL[rec.status]}) · 신뢰도 ${rec.confidence}/100</div>
    <div>연결 출처 ${evidenceCount(a, rec)}건 · 가정 ${rec.assumption_ids.length}건</div><div style="opacity:.7">클릭하면 근거 패널에 산출 과정 표시</div></div>`
}

export function opportunityOption(a: Account, scen: Scenario, addr: AddrCase, sel: Selection, p: Palette, log: boolean) {
  const years: (2026 | 2031)[] = [2026, 2031]
  const vals = (y: 2026 | 2031) => ROWS.map(m => resolveMetric(a, { year: y, metric: m }, scen, addr).rec)
  const hiScen = ROWS.map(m => resolveMetric(a, { year: 2031, metric: m }, 'high', addr).rec?.value ?? null)
  const all = [...years.flatMap(y => vals(y).flatMap(r => (r ? [r.value, r.high] : []))), ...hiScen].filter((v): v is number => v !== null && v > 0)
  const max = all.length ? Math.max(...all) * 1.18 : 100
  const min = all.length ? Math.max(0.1, Math.min(...all) / 3) : 1

  // identical grid widths so equal amounts have equal length in both years (comparable axis)
  const grids = years.map((_, i) => ({ left: i === 0 ? '10%' : '56%', width: '39%', top: 34, bottom: 34, containLabel: false }))
  const xAxes = years.map((_, i) => ({
    gridIndex: i, type: log ? 'log' : 'value', max: log ? undefined : max, min: log ? min : 0, logBase: 10,
    axisLabel: { color: p.ink3, fontSize: 11, formatter: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(v % 10000 ? 1 : 0)}조` : `${v.toLocaleString('ko-KR')}억`) },
    splitLine: { lineStyle: { color: p.line, type: 'dashed' } }, axisLine: { show: false },
  }))
  const yAxes = years.map((y, i) => ({
    gridIndex: i, type: 'category', inverse: true, data: ROWS.map(m => SHORT[m] + (y ? '' : '')),
    axisLabel: { show: i === 0, color: p.ink2, fontSize: 12, fontWeight: 700, width: 70, overflow: 'truncate' },
    axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } },
  }))

  const series: any[] = []
  years.forEach((y, gi) => {
    const recs = vals(y)
    // ghost parent bars → visual containment (RAW ⊂ TS ⊂ ...)
    series.push({
      type: 'bar', xAxisIndex: gi, yAxisIndex: gi, barWidth: 26, silent: true, z: 1, barGap: '-100%',
      data: ROWS.map((m) => {
        const par = PARENT[m]; if (!par) return null
        const pr = recs[ROWS.indexOf(par)]
        return pr?.value ? { value: pr.value, itemStyle: { color: metricColor(p, par), opacity: 0.13, borderRadius: [0, 4, 4, 0] } } : null
      }),
    })
    series.push({
      type: 'bar', xAxisIndex: gi, yAxisIndex: gi, barWidth: 26, z: 3, barGap: '-100%', barMinHeight: 3, cursor: 'pointer',
      name: String(y),
      data: ROWS.map((m, ri) => {
        const r = recs[ri]
        const selected = sel.year === y && sel.metric === m && !sel.category && !sel.bridgeComponent
        const v = r?.value ?? null
        const parent = PARENT[m] ? recs[ROWS.indexOf(PARENT[m]!)] : null
        const share = v !== null && parent?.value ? ` · ${pct(v / parent.value, 0)}` : ''
        return {
          value: v === null ? (log ? min : 0) : v, metric: m, year: y,
          itemStyle: {
            color: v === null ? 'transparent' : metricColor(p, m), borderRadius: [0, 4, 4, 0],
            borderColor: selected ? p.ink1 : v === null ? p.ink3 : p.surface, borderWidth: selected ? 2.5 : v === null ? 1 : 2,
            borderType: v === null ? 'dashed' : 'solid',
            decal: r && (r.status === 'SCENARIO') ? { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: Math.PI / 4, color: 'rgba(255,255,255,0.35)' } : undefined,
          },
          label: {
            show: true, position: v === null ? 'insideLeft' : 'right', color: p.ink1, fontSize: 12, fontWeight: 600,
            formatter: () => v === null ? (m === 'REV' && y === 2026 ? 'N/A · 사내 매출 미입력' : 'N/A · 미확인') : `${eok(v, r!.status)}${share}`,
          },
        }
      }),
      tooltip: { formatter: (pp: any) => tooltipHtml(a, y, pp.data.metric, scen, addr) },
    })
    // uncertainty whiskers (low–high) where available
    series.push({
      type: 'custom', xAxisIndex: gi, yAxisIndex: gi, z: 4, silent: true,
      renderItem: (_: any, api: any) => {
        const lo = api.value(0), hi = api.value(1), row = api.value(2)
        if (lo === null || hi === null || lo === '-' || hi === '-') return null
        const a1 = api.coord([lo, row]), a2 = api.coord([hi, row])
        const st = { stroke: p.ink1, lineWidth: 1.2, opacity: 0.55 }
        return { type: 'group', children: [
          { type: 'line', shape: { x1: a1[0], y1: a1[1] - 17, x2: a2[0], y2: a2[1] - 17 }, style: st },
          { type: 'line', shape: { x1: a1[0], y1: a1[1] - 21, x2: a1[0], y2: a1[1] - 13 }, style: st },
          { type: 'line', shape: { x1: a2[0], y1: a2[1] - 21, x2: a2[0], y2: a2[1] - 13 }, style: st },
        ] }
      },
      data: ROWS.map((m, ri) => {
        const r = recs[ri]
        if (y === 2031 && m !== 'REV' && r && r.value !== null) {
          // 2031: whisker = Low ~ High scenario range of the same metric/case
          const lo = resolveMetric(a, { year: 2031, metric: m }, 'low', addr).rec?.value ?? null
          const hi = resolveMetric(a, { year: 2031, metric: m }, 'high', addr).rec?.value ?? null
          return lo !== null && hi !== null ? [Math.max(Math.min(lo, hi), log ? min : 0), Math.max(lo, hi), ri] : ['-', '-', ri]
        }
        return r && r.low !== null && r.high !== null && r.value !== null ? [Math.max(r.low, log ? min : 0), r.high, ri] : ['-', '-', ri]
      }),
    })
  })

  return {
    animationDuration: 350,
    tooltip: { trigger: 'item', confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1 } },
    title: years.map((y, i) => ({ text: y === 2026 ? 'FY2026  (현재)' : `FY2031  (${scen.toUpperCase()} · ${addr === 'base' ? 'Base Case' : 'Strategic Expansion'})`, left: i === 0 ? '10%' : '56%', top: 4, textStyle: { fontSize: 13, color: p.ink1, fontWeight: 700 } })),
    grid: grids, xAxis: xAxes, yAxis: yAxes, series,
  }
}

export function categoryOption(a: Account, year: 2026 | 2031, scen: Scenario, addr: AddrCase, sel: Selection, p: Palette) {
  const b = a.m['2031'][scen]
  const ts = year === 2026 ? a.m['2026'].TS.by_cat : b.TS.by_cat
  const raw = year === 2026 ? a.m['2026'].RAW.by_cat : (addr === 'base' ? b.RAW_base.by_cat : b.RAW_expansion.by_cat)
  const fpr = year === 2026 ? a.m['2026'].FPR.by_cat : (addr === 'base' ? b.FPR_base.by_cat : b.FPR_expansion.by_cat)
  const cats = (Object.keys(CAT_LABEL) as Category[]).filter(c => (ts?.[c] ?? raw?.[c] ?? 0) > 0)
  const mk = (src: Record<string, number> | null | undefined, m: MetricKey, color: string) => ({
    type: 'bar', name: m, barGap: '20%', barMaxWidth: 12, cursor: 'pointer',
    data: cats.map(c => ({ value: src?.[c] ?? 0, category: c, metric: m,
      itemStyle: { color, borderRadius: [0, 4, 4, 0], borderColor: sel.category === c && sel.year === year ? p.ink1 : 'transparent', borderWidth: 2 } })),
    label: { show: m === 'FPR', position: 'right', color: p.ink2, fontSize: 10, formatter: (pp: any) => pp.value > 0 ? eok(pp.value, 'ESTIMATED') : '' },
  })
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1, fontSize: 12 },
      valueFormatter: (v: number) => eok(v, 'ESTIMATED') },
    legend: { top: 0, right: 0, textStyle: { color: p.ink2, fontSize: 11 }, data: ['TS', 'RAW', 'FPR'], itemWidth: 10, itemHeight: 10 },
    grid: { left: 108, right: 70, top: 26, bottom: 8 },
    xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: p.line, type: 'dashed' } } },
    yAxis: { type: 'category', inverse: true, data: cats.map(c => CAT_LABEL[c]), axisLabel: { color: p.ink2, fontSize: 11 }, axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } } },
    series: [mk(ts, 'TS', p.ts), mk(raw, 'RAW', p.raw), mk(fpr, 'FPR', p.fpr)],
  }
}

export const BRIDGE_LABEL: Record<string, string> = {
  organic: '자연 성장', cloud: '클라우드 전환', ai: 'AI 투자', infra: '인프라 증설', regulatory: '규제·보안', efficiency: '효율화', substitution: '기술 대체', other: '기타',
}

export function bridgeOption(a: Account, scen: Scenario, sel: Selection, p: Palette) {
  const b = a.m['2031'][scen]
  const start = a.m['2026'].TS.value
  const end = b.TS.value
  if (start === null || end === null || !b.bridge) return null
  const keys = Object.keys(BRIDGE_LABEL).filter(k => (b.bridge!.components[k] ?? 0) !== 0)
  const cats = ['TS 2026', ...keys.map(k => BRIDGE_LABEL[k]), 'TS 2031']
  let run = start
  const base: (number | string)[] = [0], up: (number | string)[] = [start], down: (number | string)[] = ['-']
  keys.forEach(k => {
    const v = b.bridge!.components[k]
    if (v >= 0) { base.push(run); up.push(v); down.push('-'); run += v } else { run += v; base.push(run); up.push('-'); down.push(-v) }
  })
  base.push(0); up.push(end); down.push('-')
  const keyAt = (i: number) => (i === 0 ? 'start' : i === cats.length - 1 ? 'end' : keys[i - 1])
  const isSel = (i: number) => sel.bridgeComponent === keyAt(i)
  return {
    tooltip: { trigger: 'item', confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1, fontSize: 12 },
      formatter: (pp: any) => { const k = keyAt(pp.dataIndex); const v = k === 'start' ? start : k === 'end' ? end : b.bridge!.components[k]; return `<b>${cats[pp.dataIndex]}</b><br/>${k === 'start' || k === 'end' ? eok(v, 'ESTIMATED') : (v >= 0 ? '+' : '−') + eok(Math.abs(v), 'ESTIMATED', { approx: false })}<br/><span style="opacity:.7">클릭: 가정·산식 보기</span>` } },
    grid: { left: 8, right: 8, top: 18, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: cats, axisLabel: { color: p.ink2, fontSize: 11, interval: 0, rotate: cats.length > 7 ? 20 : 0 }, axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } } },
    yAxis: { type: 'value', axisLabel: { color: p.ink3, fontSize: 10, formatter: (v: number) => v >= 10000 ? `${v / 10000}조` : `${v.toLocaleString('ko-KR')}억` }, splitLine: { lineStyle: { color: p.line, type: 'dashed' } } },
    series: [
      { type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, silent: true, barWidth: 26 },
      { type: 'bar', stack: 'w', cursor: 'pointer', data: up.map((v, i) => v === '-' ? v : { value: v, itemStyle: { color: i === 0 || i === cats.length - 1 ? p.ts : p.raw, borderColor: isSel(i) ? p.ink1 : 'transparent', borderWidth: 2, borderRadius: 3 } }),
        label: { show: true, position: 'top', color: p.ink2, fontSize: 10, formatter: (pp: any) => pp.dataIndex === 0 || pp.dataIndex === cats.length - 1 ? eok(pp.value, 'ESTIMATED') : `+${eok(pp.value, 'ESTIMATED', { approx: false })}` } },
      { type: 'bar', stack: 'w', cursor: 'pointer', data: down.map((v, i) => v === '-' ? v : { value: v, itemStyle: { color: p.rev, borderColor: isSel(i) ? p.ink1 : 'transparent', borderWidth: 2, borderRadius: 3 } }),
        label: { show: true, position: 'bottom', color: p.ink2, fontSize: 10, formatter: (pp: any) => `−${eok(pp.value, 'ESTIMATED', { approx: false })}` } },
    ],
    _keyAt: keyAt,
  }
}
