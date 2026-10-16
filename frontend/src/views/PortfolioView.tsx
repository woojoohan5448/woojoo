import { useMemo, useState } from 'react'
import type { Account, Dashboard } from '../types'
import EChart from '../components/EChart'
import type { Palette } from '../components/charts'
import { BRIDGE_LABEL } from '../components/charts'
import { Pill } from '../components/badges'
import { SEGMENT_LABEL, eok, pct } from '../lib/format'

function Coverage({ n, total, note }: { n: number; total: number; note?: string }) {
  return <span className="text-[11px] text-ink3">Coverage {n}/{total}개사{note ? ` · ${note}` : ''}</span>
}

function AccountList({ title, rows, fmt, onSelect, note }: { title: string; rows: Account[]; fmt: (a: Account) => string; onSelect: (id: string) => void; note: string }) {
  return (
    <section className="card p-3">
      <h4 className="text-[13.5px] font-bold">{title}</h4>
      <p className="text-[11px] text-ink3 mb-1">{note}</p>
      <ol className="space-y-0.5 text-[12.5px]">
        {rows.map((a, i) => (
          <li key={a.account_id}><button onClick={() => onSelect(a.account_id)} className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-sunk text-left">
            <span className="truncate"><span className="num text-ink3 mr-1">{i + 1}.</span>{a.original_name}</span><span className="num shrink-0 text-ink2">{fmt(a)}</span></button></li>
        ))}
        {rows.length === 0 && <li className="text-ink3">해당 없음</li>}
      </ol>
    </section>
  )
}

export default function PortfolioView({ data, palette: p, onSelect, themeKey }: { data: Dashboard; palette: Palette; onSelect: (id: string) => void; themeKey: string }) {
  const [dim, setDim] = useState<'segment' | 'family'>('segment')
  const accs = data.accounts
  const est = accs.filter(a => a.m['2026'].TS.value !== null && a.aggregate_class !== 'DEFINITION_MISMATCH')
  const rows = Object.entries(dim === 'segment' ? data.portfolio.by_segment : data.portfolio.by_family).filter(([, r]) => r.n_est > 0).sort((a, b) => b[1].FPR_2031 - a[1].FPR_2031)
  const lab = (k: string) => (dim === 'segment' ? SEGMENT_LABEL[k] ?? k : k)

  const segOpt = useMemo(() => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1, fontSize: 12 }, valueFormatter: (v: number) => eok(v, 'ESTIMATED') },
    legend: { top: 0, textStyle: { color: p.ink2, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
    yAxis: { type: 'category', inverse: true, data: rows.map(([k, r]) => `${lab(k)} (${r.n_est}/${r.n})`), axisLabel: { color: p.ink2, fontSize: 11 }, axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } } },
    xAxis: { type: 'value', axisLabel: { color: p.ink3, fontSize: 10, formatter: (v: number) => v >= 10000 ? `${v / 10000}조` : `${v}억` }, splitLine: { lineStyle: { color: p.line, type: 'dashed' } } },
    series: [
      { name: 'RAW 2026', type: 'bar', barMaxWidth: 9, itemStyle: { color: p.raw, opacity: 0.55, borderRadius: [0, 3, 3, 0] }, data: rows.map(([, r]) => r.RAW_2026) },
      { name: 'RAW 2031', type: 'bar', barMaxWidth: 9, itemStyle: { color: p.raw, borderRadius: [0, 3, 3, 0] }, data: rows.map(([, r]) => r.RAW_2031) },
      { name: 'FPR 2026', type: 'bar', barMaxWidth: 9, itemStyle: { color: p.fpr, opacity: 0.55, borderRadius: [0, 3, 3, 0] }, data: rows.map(([, r]) => r.FPR_2026) },
      { name: 'FPR 2031', type: 'bar', barMaxWidth: 9, itemStyle: { color: p.fpr, borderRadius: [0, 3, 3, 0] }, data: rows.map(([, r]) => r.FPR_2031),
        label: { show: true, position: 'right', fontSize: 10, color: p.ink2, formatter: (pp: any) => eok(pp.value, 'ESTIMATED') } },
    ],
  }), [rows, p, dim])

  const pts = est.filter(a => a.m['2026'].FPR.value)
  const scatterOpt = useMemo(() => ({
    tooltip: { trigger: 'item', confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1, fontSize: 12 },
      formatter: (pp: any) => { const a = pts[pp.dataIndex]; return `<b>${a.original_name}</b><br/>FPR 2026 ${eok(a.m['2026'].FPR.value, 'ESTIMATED')}<br/>FPR CAGR ${pct(a.m['2031'].base.FPR_CAGR.value)}<br/>TS 2026 ${eok(a.m['2026'].TS.value, 'ESTIMATED')}<br/>신뢰도 ${a.m['2026'].TS.confidence}<br/><span style="opacity:.7">클릭 → 고객 화면</span>` } },
    grid: { left: 8, right: 24, top: 16, bottom: 30, containLabel: true },
    xAxis: { type: 'log', name: 'FPR 2026 (억원, 로그)', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: p.ink3, fontSize: 11 }, axisLabel: { color: p.ink3, fontSize: 10 }, splitLine: { lineStyle: { color: p.line, type: 'dashed' } } },
    yAxis: { type: 'value', name: 'FPR CAGR', nameTextStyle: { color: p.ink3, fontSize: 11 }, axisLabel: { color: p.ink3, fontSize: 10, formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: p.line, type: 'dashed' } } },
    series: [{ type: 'scatter', cursor: 'pointer',
      symbolSize: (_: any, pp: any) => Math.max(8, Math.sqrt(pts[pp.dataIndex].m['2026'].TS.value ?? 0) / 4),
      data: pts.map(a => ({ value: [a.m['2026'].FPR.value, a.m['2031'].base.FPR_CAGR.value ?? 0], id: a.account_id,
        itemStyle: { color: p.fpr, opacity: 0.25 + 0.7 * (a.m['2026'].TS.confidence / 100), borderColor: p.surface, borderWidth: 2 } })),
      label: { show: true, position: 'right', fontSize: 10, color: p.ink2, formatter: (pp: any) => (pts[pp.dataIndex].m['2026'].FPR.value ?? 0) > 240 ? pts[pp.dataIndex].original_name.replace(/\(주\)|㈜/g, '').slice(0, 8) : '' } }],
  }), [pts, p])

  const drv = useMemo(() => {
    const sum: Record<string, number> = {}
    est.forEach(a => Object.entries(a.m['2031'].base.bridge?.components ?? {}).forEach(([k, v]) => { sum[k] = (sum[k] ?? 0) + v }))
    return Object.entries(sum).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  }, [est])

  const by = (f: (a: Account) => number | null) => [...est].filter(a => f(a) !== null).sort((a, b) => (f(b) ?? 0) - (f(a) ?? 0))
  const top = by(a => a.m['2031'].base.FPR_base.value).slice(0, 10)
  const growth = by(a => a.m['2031'].base.FPR_CAGR.value).slice(0, 10)
  const conf = by(a => a.m['2026'].TS.confidence).slice(0, 10)
  const gaps = accs.filter(a => a.m['2026'].TS.value === null || a.m['2026'].TS.confidence < 35)
  const agg = data.portfolio.aggregate['2026_base']

  return (
    <div className="space-y-4 p-4">
      <section className="card p-4">
        <h2 className="text-[18px] font-bold">Executive Portfolio View</h2>
        <p className="text-[12.5px] text-ink2">53개 Key Account 통합. 모든 합계는 <b>근거가 있는 고객의 부분합</b>입니다(2026 TS 산출 {agg.n_ts}개사, 정의 상이 {agg.n_mismatch}개사 별도). 계열사·공급자-구매자 중복 위험은 하단 표 참조.</p>
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <div className="flex items-center justify-between"><h3 className="text-[15px] font-bold">산업별 RAW·FPR (2026 vs 2031 Base)</h3>
            <select value={dim} onChange={e => setDim(e.target.value as any)} className="rounded border border-line bg-panel px-1.5 py-0.5 text-[12px]" aria-label="분류 기준"><option value="segment">세부 산업</option><option value="family">산업군</option></select></div>
          <Coverage n={est.length} total={accs.length} note="괄호 = 추정 고객/전체 고객" />
          <EChart option={segOpt} height={Math.max(300, rows.length * 30)} ariaLabel="산업별 RAW·FPR 막대" themeKey={themeKey} />
        </section>
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">기회 규모 × 성장률 (고객별)</h3>
          <p className="text-[11px] text-ink3">x = FPR 2026(로그), y = FPR CAGR 2026–31, 크기 = TS, 진하기 = 신뢰도 · 점 클릭 → 고객 화면</p>
          <EChart option={scatterOpt} height={360} ariaLabel="고객별 FPR 규모와 성장률 산점도" themeKey={themeKey} onClick={(pp) => pp.data?.id && onSelect(pp.data.id)} />
        </section>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AccountList title="Top Opportunity (FPR 2031)" rows={top} fmt={a => eok(a.m['2031'].base.FPR_base.value, 'ESTIMATED')} onSelect={onSelect} note="Base 시나리오 · 정의 상이 제외" />
        <AccountList title="High Growth (FPR CAGR)" rows={growth} fmt={a => pct(a.m['2031'].base.FPR_CAGR.value)} onSelect={onSelect} note="2026–2031 Base" />
        <AccountList title="High Confidence" rows={conf} fmt={a => `${a.m['2026'].TS.confidence}`} onSelect={onSelect} note="TS 2026 신뢰도 점수" />
        <AccountList title="Low Coverage / Research Gap" rows={gaps} fmt={a => a.m['2026'].TS.value === null ? 'UNKNOWN' : `${a.m['2026'].TS.confidence}`} onSelect={onSelect} note={`${gaps.length}개사 — TS 미확인 또는 신뢰도 35 미만`} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">주요 성장 동인 비교 (TS 브리지 합계, Base)</h3>
          <Coverage n={est.length} total={accs.length} />
          <table className="mt-2 w-full text-[12.5px] num"><tbody>
            {drv.map(([k, v]) => (<tr key={k} className="border-t border-line"><td className="py-1">{BRIDGE_LABEL[k] ?? k}</td><td className="text-right">{v >= 0 ? '+' : '−'}{eok(Math.abs(v), 'ESTIMATED', { approx: false })}</td>
              <td className="w-1/2 pl-3"><div className="h-2 rounded" style={{ width: `${Math.min(100, Math.abs(v) / Math.abs(drv[0][1]) * 100)}%`, background: v >= 0 ? 'var(--c-raw)' : 'var(--c-rev)' }} /></td></tr>))}
          </tbody></table>
        </section>
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">계열사·공급자-구매자 중복 위험</h3>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-[12px]">
            <thead><tr className="text-left text-ink3"><th className="py-1">그룹</th><th>유형</th><th>위험</th><th>구성 고객</th></tr></thead>
            <tbody>{data.portfolio.overlap_groups.map(g => (
              <tr key={g.group_id} className="border-t border-line align-top"><td className="py-1 font-semibold">{g.name}<div className="font-normal text-ink3">{g.note}</div></td><td>{g.type}</td>
                <td><Pill tone={g.risk === 'HIGH' ? 'err' : g.risk === 'MEDIUM' ? 'warn' : 'neutral'}>{g.risk}</Pill></td>
                <td>{g.members.map(m => accs.find(a => a.account_id === m)?.original_name ?? m).join(', ')}</td></tr>))}</tbody>
          </table></div>
          <p className="mt-2 text-[11.5px] text-ink3">TS는 법인 별도(KISA 공시 단위) 기준이라 연결 중복은 원칙적으로 배제됩니다. 하이퍼스케일러 TS(국내 투자 기준)는 정의가 달라 합계에서 제외합니다.</p>
        </section>
      </div>
    </div>
  )
}
