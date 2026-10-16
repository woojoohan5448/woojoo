import { useMemo, useState } from 'react'
import type { AddrCase, Dashboard, Scenario } from '../types'
import EChart from './EChart'
import Seg from './Seg'
import { Pill } from './badges'
import type { Palette } from './charts'
import { trajectoryOption } from './trajectoryChart'
import { ILLUSTRATIVE_NOTE, type TrajMetric } from '../lib/trajectory'
import { portfolioTrajectory } from '../lib/portfolioTrajectory'
import { eok, pct } from '../lib/format'

interface Props { data: Dashboard; palette: Palette; themeKey: string; scen: Scenario; setScen: (s: Scenario) => void; addr: AddrCase; setAddr: (a: AddrCase) => void; onSelect: (id: string) => void }

/** ② 전사 기회 분석 — 2026–2031 통합 성장 궤적 (동일 고객 집합 부분합) + FPR 확대 보조 차트 + 구성 추적. */
export default function PortfolioTrajectory({ data, palette, themeKey, scen, setScen, addr, setAddr, onSelect }: Props) {
  const [band, setBand] = useState(true)
  const [exOverlap, setExOverlap] = useState(false)
  const [focus, setFocus] = useState<TrajMetric>('FPR')
  const pt = useMemo(() => portfolioTrajectory(data, scen, addr, exOverlap), [data, scen, addr, exOverlap])
  const opt = useMemo(() => trajectoryOption(pt.traj, palette, { band, log: false }), [pt, palette, band])
  const fprOnly = useMemo(() => ({ ...pt.traj, series: pt.traj.series.filter(s => s.metric === 'FPR') }), [pt])
  const auxOpt = useMemo(() => trajectoryOption(fprOnly, palette, { band, log: false }), [fprOnly, palette, band])
  const name = (id: string) => data.accounts.find(a => a.account_id === id)?.original_name ?? id
  const g = pt.aggs.find(x => x.metric === focus)!
  const N = pt.n_total
  return (
    <section className="card p-4" aria-labelledby="ptraj-title" data-testid="portfolio-trajectory">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="ptraj-title" className="text-[16px] font-bold">2026–2031 통합 성장 궤적 <span className="text-[13px] font-semibold text-ink3">(53 KA Opportunity Growth Trajectory)</span></h3>
          <p className="text-[12px] text-ink2">지표별 <b>동일 고객 집합</b>(2026·2031 값이 모두 있는 고객, 정의 상이 제외)의 부분합입니다. 결측 고객은 0으로 채우지 않고 제외하며, 성장률도 같은 집합으로만 계산합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg label="시나리오" value={scen} onChange={setScen} options={[{ v: 'low', l: 'Low' }, { v: 'base', l: 'Base' }, { v: 'high', l: 'High' }]} />
          <Seg label="케이스" value={addr} onChange={setAddr} options={[{ v: 'base', l: 'Base Case' }, { v: 'expansion', l: 'Strategic Expansion' }]} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]" data-testid="ptraj-chips">
        {pt.aggs.map(x => <Pill key={x.metric} tone={x.included.length < N ? 'warn' : 'ok'}><span data-metric={x.metric}>{x.metric} 유효 {x.included.length}/{N}</span></Pill>)}
        {pt.aggs[0].mismatch.ids.length > 0 && <Pill>정의 상이 {pt.aggs[0].mismatch.ids.length}개사 별도</Pill>}
        <Pill tone={exOverlap ? 'neutral' : 'warn'}>중복·그룹사 위험(HIGH/MEDIUM) {g.overlap.ids.length}개사 {exOverlap ? '제외' : `포함(${focus} 2031의 ${g.overlap.share31 == null ? '—' : pct(g.overlap.share31, 0)})`}</Pill>
        <span className="text-ink3">선택: {pt.caseLabel}</span>
        <label className="ml-auto inline-flex items-center gap-1"><input type="checkbox" checked={band} onChange={e => setBand(e.target.checked)} /> Low~High 범위</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={exOverlap} onChange={e => setExOverlap(e.target.checked)} data-testid="ex-overlap" /> 중복 위험 고객 제외</label>
      </div>
      <div className="mt-1 text-[11.5px] text-ink3 inline-flex items-center gap-1"><svg width="34" height="10" aria-hidden><circle cx="5" cy="5" r="4.5" fill="var(--ink-2)" /><line x1="11" y1="5" x2="34" y2="5" stroke="var(--ink-2)" strokeWidth="2" strokeDasharray="5 4" /></svg>● 원천 기반 끝점 합계(2026·2031) · ┄ 추정 경로(2027~2030)</div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
        <div data-testid="ptraj-main"><EChart option={opt} height={340} ariaLabel="53개 고객 TS·RAW·FPR 통합 성장 궤적" themeKey={themeKey} onClick={(pp) => pp.data?.metric && setFocus(pp.data.metric)} /></div>
        <div data-testid="ptraj-fpr-aux">
          <div className="text-[12.5px] font-semibold">FPR 확대 보조 차트 <span className="font-normal text-ink3">(별도 축 · 이중축 아님)</span></div>
          <EChart option={auxOpt} height={300} ariaLabel="FPR 통합 궤적 확대" themeKey={themeKey} onClick={() => setFocus('FPR')} />
        </div>
      </div>
      <p className="text-[11px] text-ink3">{ILLUSTRATIVE_NOTE} 통합 경로는 합계 끝점에 같은 CAGR 보간을 적용한 예시입니다.</p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[980px] text-[12px] num" data-testid="ptraj-table">
          <thead><tr className="text-left text-ink3 [&_th]:whitespace-nowrap [&_th]:pr-2"><th className="py-1">지표</th><th className="text-right">유효 고객</th><th className="text-right">2026 부분합</th><th className="text-right">2031 부분합</th><th className="text-right">CAGR(동일 집합)</th><th className="text-right">연도별 합계 2026 (n)</th><th className="text-right">연도별 합계 2031 (n)</th><th className="text-right">정의 상이 별도(2031)</th><th>결측(0 대체 안 함)</th></tr></thead>
          <tbody>{pt.aggs.map(x => (
            <tr key={x.metric} className={`border-t border-line cursor-pointer [&_td]:pr-2 ${focus === x.metric ? 'bg-sunk' : ''}`} onClick={() => setFocus(x.metric)} data-row={x.metric}>
              <td className="py-1 font-semibold">{x.metric}</td>
              <td className="text-right">{x.included.length}/{N}</td>
              <td className="text-right">{eok(x.v26, 'ESTIMATED')}</td><td className="text-right">{eok(x.v31, 'ESTIMATED')}</td>
              <td className="text-right">{x.cagr == null ? '—' : pct(x.cagr)}</td>
              <td className="text-right">{eok(x.yearly.y2026.sum, 'ESTIMATED')} ({x.yearly.y2026.n})</td>
              <td className="text-right">{eok(x.yearly.y2031.sum, 'ESTIMATED')} ({x.yearly.y2031.n})</td>
              <td className="text-right text-ink3">{x.mismatch.ids.length ? `${eok(x.mismatch.v31, 'ESTIMATED')} (${x.mismatch.ids.length})` : '—'}</td>
              <td className="text-[11px] text-ink3">{[x.missing.only2026.length && `2031 없음 ${x.missing.only2026.length}`, x.missing.only2031.length && `2026 없음 ${x.missing.only2031.length}`, x.missing.none.length && `둘 다 없음 ${x.missing.none.length}`].filter(Boolean).join(' · ') || '없음'}</td>
            </tr>))}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-ink3">부분합 = 차트 선(동일 고객 집합). 연도별 합계 = 각 연도에 값이 있는 고객 전체(집합이 연도마다 다를 수 있어 성장률 계산에 쓰지 않음). 53개사 전체 합계는 결측 고객이 있어 산출하지 않습니다.</p>
      </div>

      <div className="mt-3 rounded-md border border-line p-3" data-testid="ptraj-composition">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-[13px] font-bold">{focus} 구성 추적 <span className="font-normal text-ink3">({pt.caseLabel} · 고객 클릭 → ① 고객 화면의 수치 산출 근거)</span></h4>
          <div className="flex gap-1">{(['TS', 'RAW', 'FPR'] as TrajMetric[]).map(m => <button key={m} onClick={() => setFocus(m)} className={`rounded border border-line px-2 py-0.5 text-[11.5px] ${focus === m ? 'bg-ink text-surface' : ''}`}>{m}</button>)}</div></div>
        <ol className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[12px] md:grid-cols-2">
          {g.contributions.slice(0, 10).map((c, i) => (
            <li key={c.account_id}><button onClick={() => onSelect(c.account_id)} className="flex w-full justify-between gap-2 rounded px-1 hover:bg-sunk text-left">
              <span className="truncate"><span className="num text-ink3 mr-1">{i + 1}.</span>{name(c.account_id)}{pt.risk.has(c.account_id) && <span className="ml-1 text-[10.5px]" style={{ color: 'var(--warn)' }}>중복 위험 {pt.risk.get(c.account_id)}</span>}</span>
              <span className="num text-ink2 shrink-0">{eok(c.v26, 'ESTIMATED')} → {eok(c.v31, 'ESTIMATED')} <span className="text-ink3">({g.v31 > 0 ? pct(c.v31 / g.v31, 0) : '—'})</span></span></button></li>))}
        </ol>
        <div className="mt-1 text-[11.5px] text-ink3">
          포함 {g.included.length}개사{g.contributions.length > 10 ? ` (상위 10 표시)` : ''} · 제외: 정의 상이 {g.mismatch.ids.map(name).join(', ') || '없음'}
          {g.missing.none.length + g.missing.only2026.length + g.missing.only2031.length > 0 && ` · 결측 ${[...g.missing.none, ...g.missing.only2026, ...g.missing.only2031].map(name).join(', ')}`}
          {exOverlap && g.overlap.ids.length > 0 && ` · 중복 위험 제외 ${g.overlap.ids.map(name).join(', ')}`}
        </div>
      </div>
    </section>
  )
}
