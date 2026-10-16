import { Fragment, useMemo, useState } from 'react'
import type { Account, AddrCase, Dashboard, MetricKey, Scenario, Selection } from '../types'
import EChart from '../components/EChart'
import Inspector from '../components/Inspector'
import { bridgeOption, categoryOption, opportunityOption, rowLabel, type Palette } from '../components/charts'
import { ConfidenceMeter, GradeBadge, Pill, StatusBadge, Swatch } from '../components/badges'
import { EVIDENCE_BASIS_LABEL, NA_KO, RESEARCH_STATUS_LABEL, SOURCE_LEVEL_LABEL, SEGMENT_LABEL, TIER_LABEL, eok, fmtRec, missingText, naInfo, pct, signedEok } from '../lib/format'
import { ILLUSTRATIVE_NOTE, trajectory } from '../lib/trajectory'
import { trajectoryOption } from '../components/trajectoryChart'
import { TermTip } from '../components/Term'
import { GLOSSARY, termLabel } from '../lib/glossary'
import { isApprovedTarget, resolveMetric, targetView } from '../lib/data'
import ProductRevenueDrilldown from '../extensions/ProductRevenueDrilldown'
import ReconPanel from '../components/ReconPanel'
import Seg from '../components/Seg'

interface Props {
  data: Dashboard; account: Account; scen: Scenario; setScen: (s: Scenario) => void; addr: AddrCase; setAddr: (a: AddrCase) => void
  sel: Selection; setSel: (s: Selection) => void; palette: Palette; themeKey: string; onSelectAccount: (id: string) => void; showTgt?: boolean
}


export default function AccountView({ data, account: a, scen, setScen, addr, setAddr, sel, setSel, palette, themeKey, onSelectAccount, showTgt = false }: Props) {
  const [log, setLog] = useState(false)
  const [catYear, setCatYear] = useState<2026 | 2031>(2026)
  const [showBand, setShowBand] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [showDeep, setShowDeep] = useState(false)
  const [inspOpen, setInspOpen] = useState(false)  // evidence panel opens on selection (chart/summary click) to give the trajectory full width
  const [illus, setIllus] = useState('')
  const traj = useMemo(() => trajectory(a, scen, addr), [a, scen, addr, showTgt])
  const trajOpt = useMemo(() => trajectoryOption(traj, palette, { band: showBand, log, selected: sel.year && ['TS', 'RAW', 'FPR'].includes(sel.metric) ? { year: sel.year, metric: sel.metric } : null }), [traj, palette, showBand, log, sel])
  const fprAux = useMemo(() => ({ ...traj, series: traj.series.filter(x => x.metric === 'FPR') }), [traj])
  const fprAuxOpt = useMemo(() => trajectoryOption(fprAux, palette, { band: showBand, log: false, selected: sel.year && sel.metric === 'FPR' ? { year: sel.year, metric: 'FPR' } : null }), [fprAux, palette, showBand, sel])
  const opt = useMemo(() => opportunityOption(a, scen, addr, sel, palette, log), [a, scen, addr, sel, palette, log, showTgt])
  const catOpt = useMemo(() => categoryOption(a, catYear, scen, addr, sel, palette), [a, catYear, scen, addr, sel, palette])
  const brOpt = useMemo(() => bridgeOption(a, scen, sel, palette), [a, scen, sel, palette])
  const m26 = a.m['2026'], b = a.m['2031'][scen]
  const raw31 = addr === 'base' ? b.RAW_base : b.RAW_expansion
  const fpr31 = addr === 'base' ? b.FPR_base : b.FPR_expansion
  const hasModel = m26.TS.value !== null || m26.RAW.value !== null

  const delta = (x: number | null, y: number | null) => (x === null || y === null ? null : y - x)

  return (
    <div className={`grid grid-cols-1 gap-4 p-4 ${inspOpen ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
      <div className="min-w-0 space-y-4">
        {/* A. Account selection & analysis conditions */}
        <section className="card p-4" aria-label="A. 고객 선택 및 분석 조건">
          <div className="md:hidden mb-2">
            <select aria-label="고객 선택" value={a.account_id} onChange={e => onSelectAccount(e.target.value)} className="w-full rounded border border-line bg-surface px-2 py-1.5 text-[13px]">
              {data.accounts.map(x => <option key={x.account_id} value={x.account_id}>{x.account_id} {x.original_name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="kicker">{a.account_id} · {SEGMENT_LABEL[a.segment] ?? a.segment}{a.pilot ? ' · 파일럿' : ''}</div>
              <h2 className="text-[22px] font-bold leading-tight">{a.original_name}</h2>
              <div className="mt-0.5 text-[12.5px] text-ink2">{a.entity.legal_name_ko ?? '법인명 미확인'}{a.entity.legal_name_en ? ` · ${a.entity.legal_name_en}` : ''}{a.entity.corp_code ? ` · DART ${a.entity.corp_code}` : ''}{a.entity.parent_group ? ` · ${a.entity.parent_group}` : ''}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Pill tone={a.research_status === 'NEEDS_REVIEW' ? 'err' : a.research_status === 'MODEL_ESTIMATED' ? 'warn' : 'neutral'}>{RESEARCH_STATUS_LABEL[a.research_status]}</Pill>
                <Pill tone={a.entity.entity_status === 'CONFIRMED' ? 'ok' : 'warn'}>법인 매핑 {a.entity.entity_status ?? '미확인'}</Pill>
                <Pill>TS 앵커: {a.anchor.method}{a.anchor.fiscal_year ? ` (FY${a.anchor.fiscal_year})` : ''}</Pill>
                {a.evidence_basis && <Pill tone={a.evidence_basis.basis === 'DIRECT_IT_DISCLOSURE' ? 'ok' : 'warn'}>근거 유형: {EVIDENCE_BASIS_LABEL[a.evidence_basis.basis] ?? a.evidence_basis.basis}{SOURCE_LEVEL_LABEL[a.evidence_basis.source_level] ? ` · ${SOURCE_LEVEL_LABEL[a.evidence_basis.source_level]}` : ''}</Pill>}
                {a.aggregate_class !== 'COMPARABLE' && <Pill tone="warn">{a.aggregate_class === 'OVERLAP_RISK' ? `중복 위험: ${a.overlap_groups.join(', ')}` : a.aggregate_class === 'DEFINITION_MISMATCH' ? '정의 상이 — 합계 제외' : '합계 제외(미확인)'}</Pill>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!inspOpen && <button onClick={() => setInspOpen(true)} className="rounded-md border border-line px-2.5 py-1 text-[12px] font-semibold hover:border-ink" aria-label="수치 산출 근거 패널 열기">수치 산출 근거 ▸</button>}
              <Seg label="시나리오" value={scen} onChange={setScen} options={[{ v: 'low', l: 'Low' }, { v: 'base', l: 'Base' }, { v: 'high', l: 'High' }]} />
              <Seg label="2031 접근성 케이스" value={addr} onChange={setAddr} options={[{ v: 'base', l: 'Base Case' }, { v: 'expansion', l: 'Strategic Expansion' }]} />
            </div>
          </div>
        </section>

        {/* B. Opportunity summary */}
        <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="B. 고객 사업기회 요약" data-testid="account-summary">
          {(['TS', 'RAW', 'FPR'] as const).map(m => {
            const r26 = m26[m], r31 = m === 'TS' ? b.TS : m === 'RAW' ? raw31 : fpr31
            return (
              <button key={m} onClick={() => { setSel({ year: 2031, metric: m }); setInspOpen(true) }} className="card p-3 text-left hover:border-ink">
                <div className="flex items-center gap-1 text-[12px] font-semibold text-ink2 whitespace-nowrap"><Swatch color={`var(--c-${m.toLowerCase()})`} /><TermTip code={m}>{termLabel(m, 'short')}</TermTip><span className="truncate font-normal text-ink3">{GLOSSARY[m].ko}</span></div>
                <div className="num mt-1 text-[17px] font-bold leading-tight whitespace-nowrap">{r31.value === null ? <span className="text-[13px]">{missingText(a, { year: 2031, metric: m })}</span> : fmtRec(r31)}<span className="ml-1 text-[11px] font-normal text-ink3">2031</span></div>
                <div className="num text-[11.5px] text-ink3">2026 {r26.value === null ? missingText(a, { year: 2026, metric: m }) : fmtRec(r26)}</div>
                {r31.grade && <div className="mt-1"><GradeBadge grade={r31.grade} /></div>}
              </button>)
          })}
          <div className="card p-3">
            <div className="flex items-center gap-1 text-[12px] font-semibold text-ink2 whitespace-nowrap"><Swatch color="var(--c-rev)" /><TermTip code="CR">CR</TermTip><span className="font-normal text-ink3">현재 매출</span></div>
            <div className="num mt-1 text-[16px] font-bold">{m26.CR.value === null ? <span className="text-[13px] text-ink2">사내 매출 미입력</span> : fmtRec(m26.CR)}</div>
            <div className="text-[11.5px] text-ink3">2026 기준 · 사내 실적만 사용</div>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1 text-[12px] font-semibold text-ink2 whitespace-nowrap"><Swatch color="var(--c-rev)" /><TermTip code="TARGET">2031 Target</TermTip><span className="font-normal text-ink3">목표</span></div>
            <div className="num mt-1 text-[16px] font-bold">{isApprovedTarget(a.m.target.TARGET) ? fmtRec(a.m.target.TARGET) : <span className="text-[13px] text-ink2">사내 목표 미입력</span>}</div>
            <div className="text-[11.5px] text-ink3">{isApprovedTarget(a.m.target.TARGET) ? '경영진 승인 목표' : showTgt && a.m.target.TARGET.value != null ? `시나리오 참고 ${eok(a.m.target.TARGET.value, 'SCENARIO')}` : '승인 목표 없음'}</div>
          </div>
          <div className="card p-3">
            <div className="text-[12px] font-semibold text-ink2">기준·전망 연도</div>
            <div className="num mt-1 text-[16px] font-bold">2026 → 2031</div>
            <div className="text-[11.5px] text-ink3">{scen === 'low' ? 'Low' : scen === 'high' ? 'High' : 'Base'} 시나리오 · {addr === 'base' ? 'Base Case' : 'Strategic Expansion'}</div>
          </div>
        </section>

        {/* C. 2026–2031 Opportunity Growth Trajectory */}
        <section className="card p-4" aria-labelledby="traj-title">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 id="traj-title" className="text-[16px] font-bold">2026–2031 Opportunity Growth Trajectory <span className="text-[13px] font-semibold text-ink3">(2026~2031 고객 사업기회 성장 궤적)</span></h3>
              <p className="text-[12px] text-ink2" data-testid="traj-scenario">선택: <b>{scen === 'low' ? 'Low' : scen === 'high' ? 'High' : 'Base'} 시나리오 · {addr === 'base' ? 'Base Case' : 'Strategic Expansion'}</b>{showBand ? ' · 연한 띠 = Low~High 시나리오 범위' : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink2">
              {(['TS', 'RAW', 'FPR'] as const).map(m => <span key={m} className="inline-flex items-center gap-1"><Swatch color={`var(--c-${m.toLowerCase()})`} /><TermTip code={m}>{m}</TermTip></span>)}
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--c-rev)' }} /><TermTip code="CR">CR</TermTip></span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rotate-45" style={{ background: 'var(--c-rev)' }} /><TermTip code="TARGET">Target</TermTip></span>
              <span className="inline-flex items-center gap-1" data-testid="traj-encoding"><svg width="34" height="10" aria-hidden><circle cx="5" cy="5" r="4.5" fill="var(--ink-2)" /><line x1="11" y1="5" x2="34" y2="5" stroke="var(--ink-2)" strokeWidth="2" strokeDasharray="5 4" /></svg>● 원천 기반 끝점(2026·2031) · ┄ 추정 경로(2027~2030)</span>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showBand} onChange={e => setShowBand(e.target.checked)} />Low~High 범위</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={log} onChange={e => setLog(e.target.checked)} />로그 축</label>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]" data-testid="traj-status">
            {traj.crMissing && <Pill>CR: 사내 매출 미입력</Pill>}
            {!traj.target && <Pill>Target: 사내 목표 미입력</Pill>}
            {traj.target && !traj.target.approved && <Pill tone="warn">Target: 시나리오 참고값(공식 목표 아님)</Pill>}
            {traj.definitionMismatch && <Pill tone="warn">정의 상이 — {a.anchor.definition_note ? '국내 인프라 지출·환산값 기준, 합계 제외' : '합계 제외'}</Pill>}
            {traj.violations.length > 0 && <Pill tone="err">포함 관계 경고: {traj.violations.map(v => v.detail).join(', ')}</Pill>}
            {traj.series.some(x => x.values[0] == null && x.values[5] == null) && <Pill>{traj.series.filter(x => x.values[0] == null && x.values[5] == null).map(x => x.metric).join('·')} N/A — {missingText(a, { year: 2026, metric: 'TS' })}</Pill>}
          </div>
          {hasModel ? (
            <EChart option={trajOpt} height={430} ariaLabel={`${a.original_name} 2026~2031 TS·RAW·FPR 성장 궤적 선 그래프`} themeKey={themeKey}
              onClick={(p) => {
                const d = p.data
                if (!d?.metric) return
                if (d.kind === 'ILLUSTRATIVE') { setIllus(`${d.year}년 ${d.metric} ${eok(d.value, 'ESTIMATED')} — Illustrative Projection: 2026·2031 엔진 값 사이 CAGR 보간(Value_y = V2026 × (V2031/V2026)^((y−2026)/5)). 원천 근거가 아닌 예시 경로입니다.`); return }
                setIllus(''); setSel({ year: d.year === 2026 ? 2026 : 2031, metric: d.metric }); setInspOpen(true)
              }} />
          ) : <div className="mt-3 rounded-md border border-dashed border-line p-6 text-center text-[13px] text-ink2"><b>{missingText(a, { year: 2026, metric: 'TS' })}</b> — {naInfo(a, { year: 2026, metric: 'TS' })?.reason ?? '근거 부족'}. 0으로 표시하지 않습니다.</div>}
          {illus && <p className="mt-1 rounded bg-sunk px-2 py-1 text-[12px] text-ink2" role="status">{illus}</p>}
          <p className="mt-1 text-[11.5px] text-ink3" data-testid="illus-note">{ILLUSTRATIVE_NOTE} TS·RAW·FPR은 포함 관계(TS ≥ RAW ≥ FPR)이며 서로 더하지 않습니다. 끝점 클릭 → 수치 산출 근거.</p>

          {/* Phase 3A-4: FPR zoom — separate small chart with its own linear axis (no dual axis on the main chart) */}
          {hasModel && fprAux.series.length > 0 && fprAux.series[0].values.some(v => v != null) && (
            <div className="mt-3 rounded-md border border-line p-2" data-testid="fpr-aux">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-semibold">FPR 확대 보조 차트 <span className="font-normal text-ink3">(별도 축 · TS·RAW 생략 · 이중축 아님)</span></span>
                <span className="text-[11px] text-ink3">{traj.series[0].values[0] && traj.series[2].values[0] ? `FPR 2026 = TS의 ${pct((traj.series[2].values[0] ?? 0) / (traj.series[0].values[0] ?? 1), 1)} — 주 차트에서 하단에 붙어 보이는 FPR·CR·Target을 확대` : 'FPR·CR·Target 확대'}</span>
              </div>
              <EChart option={fprAuxOpt} height={240} ariaLabel={`${a.original_name} FPR 확대 보조 차트`} themeKey={themeKey}
                onClick={(p) => { const d = p.data; if (!d?.metric || d.kind === 'ILLUSTRATIVE') return; setSel({ year: d.year === 2026 ? 2026 : 2031, metric: d.metric }); setInspOpen(true) }} />
            </div>)}

          {/* Summary (ratios, CAGR, deltas live here, not on the chart) */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px] num" data-testid="traj-summary">
              <thead><tr className="text-left text-ink3"><th className="py-1">지표</th><th className="text-right">2026</th><th className="text-right">2031</th><th className="text-right">증감</th><th className="text-right">CAGR</th><th className="text-right pr-3">상위 지표 대비</th><th className="pl-2">추정 등급 2026 · 2031</th></tr></thead>
              <tbody>{traj.series.map(x => {
                const parent = x.metric === 'RAW' ? traj.series[0] : x.metric === 'FPR' ? traj.series[1] : null
                const ratio = (v: number | null, pv: number | null | undefined) => (v != null && pv ? pct(v / pv, 0) : '—')
                const ck = `${x.metric}_CAGR` as 'TS_CAGR' | 'RAW_CAGR' | 'FPR_CAGR'
                return (
                  <tr key={x.metric} className="border-t border-line">
                    <td className="py-1.5 font-semibold"><span className="inline-flex items-center gap-1"><Swatch color={`var(--c-${x.metric.toLowerCase()})`} />{x.metric}</span></td>
                    <td className="text-right"><button className="underline decoration-dotted" onClick={() => { setSel({ year: 2026, metric: x.metric }); setInspOpen(true) }}>{x.rec26.value === null ? missingText(a, { year: 2026, metric: x.metric }) : fmtRec(x.rec26)}</button></td>
                    <td className="text-right"><button className="underline decoration-dotted" onClick={() => { setSel({ year: 2031, metric: x.metric }); setInspOpen(true) }}>{x.rec31.value === null ? missingText(a, { year: 2031, metric: x.metric }) : fmtRec(x.rec31)}</button></td>
                    <td className="text-right">{signedEok(delta(x.rec26.value, x.rec31.value))}</td>
                    <td className="text-right"><button className="underline decoration-dotted" onClick={() => { setSel({ year: 2031, metric: ck }); setInspOpen(true) }}>{pct(b[ck].value)}</button></td>
                    <td className="text-right text-ink2 pr-3">{parent ? `${x.metric}/${parent.metric} ${ratio(x.rec26.value, parent.rec26.value)} → ${ratio(x.rec31.value, parent.rec31.value)}` : '—'}</td>
                    <td className="pl-2"><span className="inline-flex gap-1">{x.rec26.grade && <GradeBadge grade={x.rec26.grade} />}{x.rec31.grade && <GradeBadge grade={x.rec31.grade} />}</span></td>
                  </tr>)
              })}</tbody>
            </table>
          </div>
          {b.FPR_const_capability?.value != null && b.FPR_base.value !== null && m26.FPR.value !== null && (
            <p className="mt-2 text-[11.5px] text-ink3" data-testid="fpr31-decomp">
              FPR 2031({scen}) 증가 {signedEok(b.FPR_base.value - m26.FPR.value)} = 고객 IT 지출 성장 {signedEok(b.FPR_const_capability.value - m26.FPR.value)} + U+ 역량 확대 가정(2031 접근률·포획상한 상향) {signedEok(b.FPR_base.value - b.FPR_const_capability.value)}
            </p>
          )}
          {a.narrative.ts_2031_drivers && <p className="text-[11.5px] text-ink3">주요 변화 원인: {String(a.narrative.ts_2031_drivers)}</p>}
          <details className="mt-2" open={showDetail} onToggle={e => setShowDetail((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-[12.5px] font-semibold text-ink2">연도별 상세 비교 (2026 vs 2031 구조, 보조 뷰)</summary>
            {showDetail && hasModel && <EChart option={opt} height={300} ariaLabel={`${a.original_name} 2026·2031 TS, RAW, FPR 비교 막대그래프`} themeKey={themeKey}
              onClick={(p) => { if (p.data?.metric) { setSel({ year: p.data.year, metric: p.data.metric }); setInspOpen(true) } }} />}
          </details>
        </section>

        {/* D. Opportunity Capture Metrics */}
        <section className="card p-4" aria-label="D. Opportunity Capture Metrics">
          <h3 className="text-[15px] font-bold">Opportunity Capture Metrics <span className="text-[12px] font-normal text-ink3">(현재 확보 수준·추가 확보 여지 — 사내 데이터 기반)</span></h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: 'CSOW' as const, y: 2026 as const, l: 'C-SOW 2026', t: 'CSOW', r: m26.CSOW },
              { k: 'PCR' as const, y: 2026 as const, l: 'Potential Capture Rate', t: 'PCR', r: m26.PCR },
              { k: 'UPSIDE' as const, y: 2026 as const, l: 'Upside Potential 2026', t: 'UPSIDE', r: m26.UPSIDE },
              { k: 'TARGET_SOW' as const, y: 2031 as const, l: '2031 Target SOW', t: 'TARGET_SOW', r: targetView(a.m.target.TARGET_SOW) },
            ].map(x => (
              <button key={x.l} onClick={() => { setSel({ year: x.y, metric: x.k }); setInspOpen(true) }}
                className={`rounded-md border p-2 text-left ${sel.metric === x.k ? 'border-ink' : 'border-line'} bg-sunk`}>
                <div className="text-[11.5px] font-semibold text-ink2"><TermTip code={x.t}>{x.l}</TermTip></div>
                <div className="num text-[15px] font-bold">{x.r.value === null ? <span className="text-[12.5px] text-ink2">{missingText(a, { year: x.y, metric: x.k })}</span> : fmtRec(x.r)}</div>
                <div className="text-[10.5px] text-ink3">{x.r.value === null ? (NA_KO[naInfo(a, { year: x.y, metric: x.k })?.class ?? ''] ?? '') : naInfo(a, { year: x.y, metric: x.k })?.class === 'INTERNAL_REQUIRED' ? '시나리오 참고값 — 공식 목표 아님' : x.r.status}</div>
              </button>
            ))}
          </div>
        </section>

        {/* E. Business areas & demand evidence */}
        {a.area_evidence && (
          <section className="card p-4" aria-labelledby="area-ev">
            <h3 id="area-ev" className="text-[15px] font-bold">사업영역별 기회 및 수요 근거 <span className="text-[12px] font-normal text-ink3">(금액 = 모델 추정 · 근거 상태는 별도)</span></h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12.5px]" data-testid="account-area-evidence">
                <thead><tr className="text-left text-ink3"><th className="py-1">사업영역</th><th className="text-right">FPR 2031 (모델)</th><th><TermTip code="EVIDENCE_TIER">근거 상태</TermTip></th><th>금액 산정</th><th>관측 근거</th></tr></thead>
                <tbody>{Object.entries(a.area_evidence).filter(([, v]) => (v.FPR_2031 ?? 0) > 0).sort((x, y) => (y[1].FPR_2031 ?? 0) - (x[1].FPR_2031 ?? 0)).map(([area, v]) => (
                  <tr key={area} className="border-t border-line align-top">
                    <td className="py-1.5 font-semibold">{area}</td>
                    <td className="num text-right">{eok(v.FPR_2031, 'ESTIMATED')}</td>
                    <td><Pill tone={v.tier === 'EVIDENCE_BASED' ? 'ok' : v.tier === 'MODEL_ESTIMATED' ? 'warn' : 'err'}>{TIER_LABEL[v.tier]}</Pill></td>
                    <td className="text-ink2">{v.value_basis === 'ACCOUNT_SPECIFIC_SHARE' ? '고객별 비중 근거' : '업종 기본 배분(A-MIX)'}</td>
                    <td className="text-[12px] text-ink2">{v.evidence_types.length === 0 ? <span className="text-ink3">관측 없음(기회 0 아님)</span> : v.evidence_types.map(t => `${({ DEMAND_SIGNAL: '수요 신호', ACCOUNT_SPECIFIC_SHARE: '고객별 비중', INCUMBENT_OBSERVED: '기존 공급자 관찰' } as Record<string, string>)[t] ?? t} ${v.observation_ids[t]?.length ?? 0}`).join(' · ')}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            {(a.drivers.length > 0 || a.competitive.length > 0) && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div><div className="kicker mb-1">수요 신호 (공개 발표)</div><ul className="space-y-1 text-[12.5px]">{a.drivers.map(d => <li key={d.driver_id}><Pill>{d.type}</Pill> {d.description}{d.amount ? ` (${d.amount.toLocaleString?.('ko-KR') ?? d.amount} ${d.unit ?? ''}, ${d.period ?? ''})` : ''}</li>)}</ul></div>
                <div><div className="kicker mb-1">경쟁·계약 구조</div><ul className="space-y-1 text-[12.5px]">{a.competitive.map((c, i) => <li key={i}><Pill>{c.category}</Pill> {c.observation}{c.lgu_relationship ? <span className="text-brand"> · LG U+: {c.lgu_relationship}</span> : ''}</li>)}</ul></div>
              </div>
            )}
            <p className="mt-2 text-[11.5px] text-ink3">이 정보는 ③ 전략과제 도출의 Demand Evidence로 연결됩니다(관측 ID 기준).</p>
          </section>
        )}
        {/* Phase 3A: Internal–External Reconciliation (ledger + six internal fields; Phase 4 sales estimate inside) */}
        <ReconPanel data={data} account={a} scen={scen} addr={addr} onInspect={(x) => { setSel(x); setInspOpen(true) }} />

        <details className="card p-4" open={showDeep} onToggle={e => setShowDeep((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-[15px] font-bold">상세 분석 — Wallet 구성(카테고리 분해) · TS Bridge 2026→2031</summary>
          {showDeep && <div className="mt-3 grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {/* Category decomposition */}
          <section className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-bold">Wallet 구성 (카테고리 분해)</h3>
                <p className="text-[11.5px] text-ink3">모델 내부 분해(가정 기반) — 고객별 LG U+ 상품 매출 배분이 아님</p>
              </div>
              <Seg label="연도" value={String(catYear) as '2026' | '2031'} onChange={(v) => setCatYear(Number(v) as 2026 | 2031)} options={[{ v: '2026', l: '2026' }, { v: '2031', l: '2031' }]} />
            </div>
            {m26.TS.by_cat ? <EChart option={catOpt} height={330} ariaLabel="카테고리별 TS·RAW·FPR 막대" themeKey={themeKey}
              onClick={(p) => p.data?.category && setSel({ year: catYear, metric: p.data.metric, category: p.data.category })} /> :
              <div className="py-8 text-center text-[13px] text-ink3">TS 미산출 — 카테고리 분해 불가</div>}
          </section>
          {/* Bridge */}
          <section className="card p-4">
            <h3 className="text-[15px] font-bold">TS Bridge 2026 → 2031 <span className="text-[12px] font-normal text-ink3">({scen.toUpperCase()})</span></h3>
            <p className="text-[11.5px] text-ink3">Driver-based forecast · 항목 클릭 → 파라미터·근거</p>
            {brOpt ? <EChart option={brOpt} height={330} ariaLabel="TS 2026에서 2031까지 증감 요인 폭포 차트" themeKey={themeKey}
              onClick={(p) => setSel({ year: 2031, metric: 'TS', bridgeComponent: (brOpt as any)._keyAt(p.dataIndex) })} /> :
              <div className="py-8 text-center text-[13px] text-ink3">TS 미산출 — 브리지 산출 불가</div>}
          </section>
        </div>}
        </details>

        {/* Narrative */}
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">분석 설명 (2026 · 2031)</h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] md:grid-cols-[170px_1fr]">
            {[
              ['2026 TS 추정', a.narrative.ts_2026], ['주요 추정 근거', a.narrative.ts_basis], ['2026 RAW 논리', a.narrative.raw_logic],
              ['2026 FPR 논리', a.narrative.fpr_logic], ['2031 TS 성장 동인', a.narrative.ts_2031_drivers], ['2031 RAW 변화', a.narrative.raw_2031_drivers],
              ['시나리오 불확실성', a.narrative.uncertainty], ['핵심 사업 기회', a.narrative.key_opportunity],
            ].filter(([, v]) => v).map(([k, v]) => (<Fragment key={k as string}><dt className="font-semibold text-ink2">{k as string}</dt><dd>{String(v)}</dd></Fragment>))}
          </dl>
          {a.override_notes.length > 0 && <div className="mt-3"><div className="kicker mb-1">계정별 분석가 보정</div><ul className="list-disc pl-5 text-[12.5px] text-ink2">{a.override_notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
          {a.open_questions.length > 0 && <div className="mt-3"><div className="kicker mb-1">미확인 자료 · 추가 검증 필요</div><ul className="list-disc pl-5 text-[12.5px] text-ink2">{a.open_questions.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
        </section>

        {/* Entity & facts */}
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">법인 식별 · 원천 사실 (Layer A)</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-[12.5px] md:grid-cols-2">
            <div><span className="text-ink3">경제적 범위:</span> {a.entity.economic_scope ?? 'N/A'}</div>
            <div><span className="text-ink3">제외:</span> {a.entity.exclusions ?? 'N/A'}</div>
            <div className="md:col-span-2"><span className="text-ink3">매핑 메모:</span> {a.entity.entity_notes ?? 'N/A'}</div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead><tr className="text-left text-ink3"><th className="py-1">지표</th><th>FY</th><th className="text-right">값</th><th>단위</th><th>범위</th><th>검증</th><th>출처</th></tr></thead>
              <tbody>{a.facts.map(f => (
                <tr key={f.fact_id} className="border-t border-line align-top">
                  <td className="py-1">{f.metric}</td><td className="num">{f.fiscal_year ?? '-'}</td>
                  <td className="num text-right">{typeof f.value === 'number' ? f.value.toLocaleString('ko-KR') : f.value}</td><td>{f.unit}</td>
                  <td className="max-w-[220px] truncate" title={f.scope}>{f.scope}</td>
                  <td><Pill tone={f.verification_status === 'VERIFIED' ? 'ok' : 'warn'}>{f.verification_status}</Pill></td>
                  <td className="text-ink3">{f.evidence_ids.join(', ')}</td>
                </tr>))}</tbody>
            </table>
            {a.facts.length === 0 && <div className="py-3 text-[12.5px] text-ink3">수집된 수치 사실 없음 — 조사 로그 참조</div>}
          </div>
          <details className="mt-3 text-[12px]"><summary className="cursor-pointer text-ink2">조사 로그 ({a.research_log.length})</summary>
            <ul className="mt-1 space-y-0.5 text-ink3">{a.research_log.map((l, i) => <li key={i}>[{l.result}] {l.step} — {l.target} {l.detail ? `· ${l.detail}` : ''}</li>)}</ul></details>
        </section>

        <ProductRevenueDrilldown account={a} />
      </div>

      {/* F. Evidence inspector — collapsible side panel */}
      {inspOpen && <aside className="card h-fit p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto scroll-thin" aria-label="근거 및 계산 패널">
        <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 text-[12px] font-bold text-ink2"><span>수치 산출 근거 <span className="font-normal text-ink3">Evidence &amp; Calculation Inspector</span></span>
          <button onClick={() => setInspOpen(false)} className="rounded border border-line px-1.5 text-[11px] font-normal text-ink3 hover:text-ink" aria-label="수치 산출 근거 패널 접기">접기</button></div>
        <div className="mb-2 flex items-center justify-between"><div className="kicker">Evidence &amp; Calculation Inspector</div>
          <ConfidenceMeter value={m26.TS.confidence} /></div>
        <Inspector data={data} account={a} sel={sel} scen={scen} addr={addr} />
        <div className="mt-4 border-t border-line pt-2 text-[11px] text-ink3">TS 2026 {eok(m26.TS.value, m26.TS.status)} · 선택 유지: {sel.year} / {sel.metric}{sel.category ? ` / ${sel.category}` : ''}</div>
      </aside>}
    </div>
  )
}
