import type { Trajectory, TrajMetric } from '../lib/trajectory'
import { KIND_LABEL, YEARS, pointKind } from '../lib/trajectory'
import { eok } from '../lib/format'
import type { Palette } from './charts'

/** ECharts option for the 2026–2031 Opportunity Growth Trajectory (판서형 성장 궤적).
 *  One linear Y axis (억원, no dual axis), TS/RAW/FPR as independent (non-stacked) lines,
 *  2027–2030 shaded as Illustrative Projection, CR (2026 point) and Target (2031 marker) never connected. */
export function trajectoryOption(t: Trajectory, p: Palette, opts: { band: boolean; log: boolean; selected?: { year: number; metric: string } | null }) {
  const color: Record<TrajMetric, string> = { TS: p.ts, RAW: p.raw, FPR: p.fpr }
  const cats = YEARS.map(String)
  const series: any[] = []
  const fmtAxis = (v: number) => (v >= 10000 ? `${(v / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}조` : `${Math.round(v).toLocaleString('ko-KR')}억`)

  // Low~High scenario bands (stack trick: transparent lower bound + filled width). Not available on log axis.
  if (opts.band && !opts.log) {
    t.series.forEach(s => {
      if (!s.low || !s.high) return
      const lo = s.low.map((v, i) => Math.min(v, s.high![i]))
      const width = s.high.map((v, i) => Math.max(0, Math.max(v, s.low![i]) - lo[i]))
      series.push({ id: `band-lo-${s.metric}`, type: 'line', stack: `band-${s.metric}`, data: lo, symbol: 'none', lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, z: 1 })
      series.push({ id: `band-w-${s.metric}`, type: 'line', stack: `band-${s.metric}`, data: width, symbol: 'none', lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false },
        areaStyle: { color: color[s.metric], opacity: 0.09 }, z: 1 })
    })
  }

  t.series.forEach(s => {
    const c = color[s.metric]
    series.push({
      id: `line-${s.metric}`, name: s.metric, type: 'line', z: 3, connectNulls: false, smooth: false,
      // The whole 2026→2031 path is an estimate between two engine endpoints → dashed; only the endpoints are source-based (solid markers)
      lineStyle: { color: c, width: 2.2, type: [7, 5] }, itemStyle: { color: c },
      emphasis: { focus: 'none', scale: 1.15 },  // no series blur — a click must not leave other metrics faded
      data: s.values.map((v, i) => {
        const end = i === 0 || i === 5
        const sel = opts.selected && opts.selected.metric === s.metric && opts.selected.year === YEARS[i]
        return {
          value: v, metric: s.metric, year: YEARS[i], kind: pointKind(i),
          symbol: 'circle', symbolSize: end ? (sel ? 14 : 12) : 5,
          itemStyle: end ? { color: c, borderColor: p.surface, borderWidth: sel ? 3 : 2 } : { color: p.surface, borderColor: c, borderWidth: 1.2, opacity: 0.85 },
          // 2026 labels sit above-right of the point (clear of the Y-axis tick labels); 2031 labels to the right
          label: end && v != null ? { show: true, position: i === 0 ? 'top' : 'right', align: i === 0 ? 'left' : undefined, offset: i === 0 ? [-4, -2] : undefined, distance: 8, fontSize: 11.5, fontWeight: 600, color: p.ink1,
            formatter: () => `${s.metric} ${eok(v, 'ESTIMATED')}` } : { show: false },
        }
      }),
    })
  })

  // CR: 2026 point only (internal actual). Target: separate 2031 marker. Never connected.
  if (t.cr && t.cr.value != null) {
    series.push({ id: 'cr', name: 'CR', type: 'scatter', z: 4, symbol: 'circle', symbolSize: 11,
      itemStyle: { color: p.rev, borderColor: p.surface, borderWidth: 2 },
      data: [{ value: ['2026', t.cr.value], metric: 'REV', year: 2026 }],
      label: { show: true, position: 'bottom', align: 'left', distance: 6, fontSize: 11.5, fontWeight: 600, color: p.ink1, formatter: () => `CR ${eok(t.cr!.value, 'VERIFIED')}` } })
  }
  if (t.target && t.target.rec.value != null) {
    const approved = t.target.approved
    series.push({ id: 'target', name: 'Target', type: 'scatter', z: 4, symbol: 'diamond', symbolSize: 15,
      itemStyle: approved ? { color: p.rev, borderColor: p.surface, borderWidth: 2 } : { color: p.surface, borderColor: p.rev, borderWidth: 2, borderType: 'dashed' },
      data: [{ value: ['2031', t.target.rec.value], metric: 'REV', year: 2031 }],
      label: { show: true, position: 'right', distance: 8, fontSize: 11.5, fontWeight: 600, color: p.ink1,
        formatter: () => `${approved ? 'Target' : 'Target(시나리오 참고)'} ${eok(t.target!.rec.value, approved ? 'VERIFIED' : 'SCENARIO')}` } })
  }

  // Shade 2027–2030 as Illustrative Projection (attached to the first drawn line so it renders on the category axis)
  const firstLine = series.find(x => x.id?.startsWith('line-'))?.id
  const ILLUS = { silent: true, itemStyle: { color: p.sunk, opacity: 0.35 },
    label: { show: true, position: 'insideTop', color: p.ink3, fontSize: 10.5, formatter: 'Illustrative Projection' },
    data: [[{ xAxis: '2027' }, { xAxis: '2030' }]] }
  return {
    animation: false,
    grid: { left: 64, right: 150, top: 40, bottom: 36 },
    tooltip: {
      trigger: 'axis', confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1, fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: p.ink3, type: 'dashed' } },
      formatter: (ps: any[]) => {
        const rows = ps.filter(x => x.seriesId?.startsWith('line-') || x.seriesId === 'cr' || x.seriesId === 'target')
        if (!rows.length) return ''
        const i = YEARS.indexOf(Number(ps[0].axisValue) as any)
        const head = `<b>${ps[0].axisValue}</b> · ${KIND_LABEL[pointKind(i)]}`
        const body = rows.map(x => {
          const v = Array.isArray(x.value) ? x.value[1] : x.value
          const st = x.seriesId === 'cr' ? 'VERIFIED' : x.seriesId === 'target' ? (t.target?.approved ? 'VERIFIED' : 'SCENARIO') : 'ESTIMATED'
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${x.color};margin-right:6px"></span>${x.seriesName} <b>${v == null ? 'N/A' : eok(v, st as any)}</b>`
        }).join('<br/>')
        return `${head}<br/>${body}${i > 0 && i < 5 ? '<br/><span style="color:#888">예시 경로(CAGR 보간) — 확정 계획 아님</span>' : ''}`
      },
    },
    xAxis: { type: 'category', data: cats, boundaryGap: false, axisTick: { show: false },
      axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.ink2, fontSize: 12, fontWeight: 600 }, name: 'Year', nameLocation: 'end', nameTextStyle: { color: p.ink3, fontSize: 11 } },
    yAxis: { type: opts.log ? 'log' : 'value', min: opts.log ? undefined : 0, axisLabel: { color: p.ink3, fontSize: 11, formatter: fmtAxis },
      splitLine: { lineStyle: { color: p.line, type: 'dashed' } }, name: 'IT Spending / Revenue (억원)', nameTextStyle: { color: p.ink3, fontSize: 11, align: 'left' } },
    labelLayout: { moveOverlap: 'shiftY', hideOverlap: false },
    series: series.map(x => x.id === firstLine ? { ...x, markArea: ILLUS } : x),
  }
}
