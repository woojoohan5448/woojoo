import { useMemo } from 'react'
import type { Dashboard, EvidenceTier, StrategyRow } from '../types'
import { TermTip } from '../components/Term'
import { Pill } from '../components/badges'
import { LEVEL_LABEL, TIER_LABEL, eok, pct } from '../lib/format'
import { scenarioTargetVisible } from '../lib/data'
import { LensPill } from './StrategyView'

type Nav = 'account' | 'portfolio' | 'strategy' | 'quality' | 'method' | 'admin'
const TIERS: EvidenceTier[] = ['EVIDENCE_BASED', 'MODEL_ESTIMATED', 'UNVERIFIED']
const TIER_OPACITY: Record<EvidenceTier, number> = { EVIDENCE_BASED: 1, MODEL_ESTIMATED: 0.5, UNVERIFIED: 0.2 }
const LEVEL_TONE = { SUFFICIENT: 'ok', PARTIAL: 'warn', INSUFFICIENT: 'err' } as const
const ST_KO: Record<string, { l: string; tone: 'ok' | 'warn' | 'err' }> = { CANDIDATE: { l: '추진 검토 후보', tone: 'ok' }, NEEDS_VALIDATION: { l: '검증 필요', tone: 'warn' }, ANALYSIS_HYPOTHESIS: { l: '분석 가설', tone: 'err' } }
const REC_KO: Record<string, string> = { EXPAND: '확장', INVEST: '투자', PARTNER: '제휴', 'M&A_REVIEW': 'M&A 검토', MAINTAIN: '유지' }

function Kpi({ term, label, value, sub, accent, testid }: { term?: string; label: string; value: string; sub: string; accent?: string; testid?: string }) {
  return (
    <div className="card p-3" data-testid={testid}>
      <div className="flex items-center gap-1 text-[12px] font-semibold text-ink2">
        {accent && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: accent }} aria-hidden />}
        {term ? <TermTip code={term}>{label}</TermTip> : label}
      </div>
      <div className={`num mt-1 font-bold leading-tight ${/^[A-Z ]+$/.test(value) ? 'text-[15px] pt-1' : 'text-[22px]'}`}>{value}</div>
      <div className="mt-0.5 text-[11.5px] text-ink3 leading-snug">{sub}</div>
    </div>
  )
}

function TierBar({ s }: { s: StrategyRow }) {
  const e = s.evidence
  if (!e) return null
  const tot = TIERS.reduce((x, k) => x + (e.fpr2031_by_tier[k] || 0), 0) || 1
  return (
    <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-sm" role="img"
      aria-label={TIERS.map(k => `${TIER_LABEL[k]} ${pct((e.fpr2031_by_tier[k] || 0) / tot, 0)}`).join(', ')}>
      {TIERS.map(k => (e.fpr2031_by_tier[k] || 0) > 0 && (
        <span key={k} title={`${TIER_LABEL[k]}: ${eok(e.fpr2031_by_tier[k], 'ESTIMATED')} (${pct((e.fpr2031_by_tier[k] || 0) / tot, 0)})`}
          style={{ width: `${(100 * (e.fpr2031_by_tier[k] || 0)) / tot}%`, background: 'var(--c-fpr)', opacity: TIER_OPACITY[k] }} />))}
    </div>
  )
}

export default function OverviewView({ data, onNavigate, onSelect }: { data: Dashboard; onNavigate: (t: Nav) => void; onSelect: (id: string) => void }) {
  const n = data.meta.n_accounts
  const a26 = data.portfolio.aggregate['2026_base'], a31 = data.portfolio.aggregate['2031_base']
  const lo31 = data.portfolio.aggregate['2031_low'], hi31 = data.portfolio.aggregate['2031_high']
  const withData = data.accounts.filter(a => a.m['2026'].TS.value !== null || a.m['2026'].RAW.value !== null).length
  const mismatch = a26.n_mismatch
  const noData = n - withData
  const rawOnly = withData - a26.n_ts - mismatch  // contract-based RAW without TS (e.g. USFK)
  const crN = data.accounts.filter(a => a.m['2026'].CR.value !== null).length
  const tgtApproved = a31.n_target_approved ?? 0
  const showTgt = scenarioTargetVisible()
  const strat = data.strategy
  const levelCount = useMemo(() => {
    const c: Record<string, number> = { SUFFICIENT: 0, PARTIAL: 0, INSUFFICIENT: 0 }
    strat.forEach(s => s.evidence && (c[s.evidence.evidence_level] += 1))
    return c
  }, [strat])
  const inits = data.initiatives ?? []
  const initOf = (area: string) => inits.find(i => i.area === area)
  const stCount = inits.reduce((c, i) => ({ ...c, [i.status]: (c[i.status] ?? 0) + 1 }), {} as Record<string, number>)
  const name = (id: string) => data.accounts.find(a => a.account_id === id)?.original_name ?? id
  const cagr = (x: number | null | undefined, y: number | null | undefined) => (x && y ? Math.pow(y / x, 1 / 5) - 1 : null)

  // concentration of comparable FPR 2026
  const comp = data.accounts.filter(a => a.aggregate_class !== 'DEFINITION_MISMATCH' && a.m['2026'].FPR.value !== null)
    .map(a => ({ id: a.account_id, v: a.m['2026'].FPR.value as number })).sort((x, y) => y.v - x.v)
  const fprTot = comp.reduce((x, r) => x + r.v, 0) || 1
  const top2 = comp.slice(0, 2)
  const top2Share = top2.reduce((x, r) => x + r.v, 0) / fprTot
  const capRows = data.accounts.filter(a => a.aggregate_class !== 'DEFINITION_MISMATCH')
  const capUplift = capRows.reduce((x, a) => { const b = a.m['2031'].base; return x + ((b.FPR_base.value ?? 0) - (b.FPR_const_capability?.value ?? b.FPR_base.value ?? 0)) }, 0)
  const capShare = a31.FPR && a26.FPR ? capUplift / (a31.FPR - a26.FPR) : null
  const gapAccounts = data.accounts.filter(a => a.na_class?.['2026|TS']?.class === 'INSUFFICIENT_EVIDENCE')
  const highDep = strat.filter(s => (s.evidence?.assumption_dependency ?? 0) > 0.5)
  const byFamily = Object.entries(data.portfolio.by_family).sort((x, y) => y[1].FPR_2031 - x[1].FPR_2031).slice(0, 5)
  const topAreas = [...strat].sort((x, y) => y.priority_score - x.priority_score).slice(0, 4)

  return (
    <div className="space-y-4 p-4" data-testid="overview">
      {/* Message first */}
      <section className="card p-4">
        <div className="kicker">TO-BE · ④ 전략적 시사점 · Strategic Implications</div>
        <h2 className="mt-1 text-[20px] font-bold leading-snug">53개 고객 분석(①②)과 전략과제 도출(③)의 결론 — 근거 수준과 함께</h2>
        <p className="mt-1 text-[13px] text-ink2">
          분석 대상 <b>{n}개사</b> 중 수치가 산출된 고객 <b>{withData}개사</b>(TS 비교 합산 {a26.n_ts}개사 · <TermTip code="PARTIAL_SUM">정의 상이 {mismatch}개사 별도</TermTip>{rawOnly > 0 ? ` · 계약 기반 RAW만 ${rawOnly}개사` : ''}) · 수치 없음 {noData}개사.
          모든 합계는 <b>부분합 추정치</b>이며 확정된 전사 목표가 아닙니다. 사내 실적(CR) {crN}/{n}개사, 승인 Target {tgtApproved}/{n}개사.
        </p>
      </section>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="핵심 지표">
        <Kpi testid="kpi-coverage" label="분석 대상 / 유효 분석 고객" value={`${n} / ${withData}`} sub={`TS 비교 합산 ${a26.n_ts} · 정의 상이 ${mismatch}${rawOnly > 0 ? ` · RAW만 ${rawOnly}` : ''} · 수치 없음 ${noData}`} />
        <Kpi term="TS" label="2026 TS (고객 전체 IT 지출액)" value={eok(a26.TS, 'ESTIMATED')} sub={`→ 2031 ${eok(a31.TS, 'ESTIMATED')} · ${a26.n_ts}개사 부분합`} accent="var(--c-ts)" />
        <Kpi term="RAW" label="2031 RAW (LGU+ 공략 가능 시장)" value={eok(a31.RAW, 'ESTIMATED')} sub={`2026 ${eok(a26.RAW, 'ESTIMATED')} · ${a31.n_raw}개사 부분합`} accent="var(--c-raw)" />
        <Kpi term="FPR" label="2031 FPR (최대 확보 가능 매출)" value={eok(a31.FPR, 'ESTIMATED')} sub={`범위 ${eok(lo31.FPR, 'ESTIMATED')}~${eok(hi31.FPR, 'ESTIMATED')} (Low~High) · 2026 ${eok(a26.FPR, 'ESTIMATED')}`} accent="var(--c-fpr)" />
        <Kpi testid="kpi-target" term="TARGET" label="2031 Target Revenue (2031년 목표 매출)" value={tgtApproved > 0 ? eok(a31.TARGET, 'VERIFIED') : '사내 목표 미입력'}
          sub={tgtApproved > 0 ? `경영진 승인 ${tgtApproved}개사 합계` : `승인 목표 0/${n}개사${showTgt ? ` · 시나리오 참고값 ${eok(a31.TARGET_scenario ?? null, 'SCENARIO')}(공식 합계 아님)` : ''}`} accent="var(--c-rev)" />
        <Kpi testid="kpi-areas" term="EVIDENCE_LEVEL" label="전략과제 후보 · 상태" value={`${inits.length}건 · 승인 0`}
          sub={`추진 검토 후보 ${stCount.CANDIDATE ?? 0} · 검증 필요 ${stCount.NEEDS_VALIDATION ?? 0} · 분석 가설 ${stCount.ANALYSIS_HYPOTHESIS ?? 0} · 외부 커버리지 ${data.meta.coverage ? pct(data.meta.coverage.current.external_coverage) : '—'}`} />
      </section>

      {/* Options & decisions (conclusion of ③) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4" aria-labelledby="opts">
          <h3 id="opts" className="text-[15px] font-bold">투자·제휴·상품화 옵션 (사업영역별, ③ 엔진 결과)</h3>
          <ul className="mt-2 space-y-1.5 text-[12.5px]" data-testid="options">{[...strat].sort((x, y) => y.priority_score - x.priority_score).map(s => { const it = initOf(s.area); return (
            <li key={s.area} className="flex flex-wrap items-baseline gap-1.5 border-t border-line pt-1.5" data-area={s.area}>
              <b className="min-w-[150px]">{s.area}</b>
              {it && <Pill tone={ST_KO[it.status].tone}>{it.option.label}</Pill>}
              {it && <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-ink3">시장<LensPill lens="market" level={it.lenses.market.level} />수요<LensPill lens="demand" level={it.lenses.demand.level} />확보<LensPill lens="capture" level={it.lenses.capture.level} /></span>}
            </li>) })}
          </ul>
          <p className="mt-2 text-[11.5px] text-ink3">③ 전략과제 도출 결과(시장·수요·확보 가능성 3관점). 모든 옵션은 제안(PROPOSED) 상태이며 확정 과제·투자 결정이 아닙니다. 수요 근거가 없으면 '분석 가설', 일부 근거가 부족하면 '검증 필요'. <button className="underline" onClick={() => onNavigate('strategy')}>WHY/GAP/OPTION/PRIORITY/ACTION 보기 →</button></p>
        </div>
        <div className="card p-4" aria-labelledby="decide">
          <h3 id="decide" className="text-[15px] font-bold">경영진 의사결정 필요 사항</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12.5px]" data-testid="decisions">
            <li>2031 Target Revenue 승인(현재 승인 {tgtApproved}/{n}개사) — 승인 전에는 Target·Target SOW 산출 불가</li>
            <li>우선순위 가중치 확정(현재 v1 기준안: 규모 35·성장 20·수요 고객 15·진입 15·신뢰도 15 − 난이도)</li>
            <li>2031 접근률·포획상한 상향(LG U+ 역량 확대 가정) 승인 — 2031 FPR 증가분의 {pct(capShare, 0)}에 해당</li>
            <li>근거 3관점 판정 기준 확정(수요: 양(+) 근거 5개사·FPR 비중 30% 등) — 현재 '기존 공급자 관찰'은 신규 수요로 인정하지 않음</li>
            <li>공식 지표 출처 전환 정책 승인(외부 모델 → 승인된 사내 값, 고객·지표 단위 선택 승인) 및 Phase 3B 사내 데이터 연동(Blocker B1·B2·B3·B4·B6·B8 해소 후)</li>
            <li>가정 의존도가 높은 영역({highDep.map(s => s.area).join(', ') || '없음'})의 투자 판단 보류 여부 — 민감도·고객 수요 검증 후 재평가</li>
          </ol>
        </div>
      </section>

      {/* Five executive questions */}
      <section className="card p-4" aria-labelledby="q5">
        <h3 id="q5" className="text-[15px] font-bold">경영진 5대 질문 — 현재 답할 수 있는 수준</h3>
        <ol className="mt-2 grid grid-cols-1 gap-2 text-[13px] lg:grid-cols-5">
          {[
            { q: '① 53개 KA의 전체 IT Spending은?', a: `${eok(a26.TS, 'ESTIMATED')} (2026) → ${eok(a31.TS, 'ESTIMATED')} (2031)`, s: `${a26.n_ts}개사 부분합 · 대부분 추정`, t: 'TS' },
            { q: '② LGU+가 공략할 수 있는 시장은?', a: `${eok(a26.RAW, 'ESTIMATED')} → ${eok(a31.RAW, 'ESTIMATED')}`, s: `${pct(a26.RAW / (a26.TS || 1), 0)} of TS (2026)`, t: 'RAW' },
            { q: '③ 최대 확보 가능 매출은?', a: `${eok(a26.FPR, 'ESTIMATED')} → ${eok(a31.FPR, 'ESTIMATED')}`, s: `CAGR ${pct(cagr(a26.FPR, a31.FPR))} · 증가분의 ${pct(capShare, 0)}는 U+ 역량 확대 가정`, t: 'FPR' },
            { q: '④ 목표와 현재 매출 사이 성장 기회는?', a: crN === 0 && tgtApproved === 0 ? '사내 매출·목표 미입력' : `CR ${crN}개사 · Target ${tgtApproved}개사`, s: '사내 CR·승인 Target 입력 후 산출(관리자 입력·Excel Import)', t: 'UPSIDE' },
            { q: '⑤ 무엇을 우선 준비해야 하는가?', a: `매력도 상위 ${topAreas.slice(0, 3).map(s => s.area).join(' · ')}`, s: `모두 검증 필요 상태 — 우선 준비는 수요·시장 근거 검증 과제(③ ACTION ${inits.reduce((x, i) => x + i.actions.length, 0)}건 제안)`, t: 'PRIORITY_SCORE' },
          ].map((x, i) => (
            <li key={i} className="rounded-md border border-line bg-sunk p-2.5">
              <div className="text-[12px] font-semibold text-ink2"><TermTip code={x.t}>{x.q}</TermTip></div>
              <div className="num mt-1 font-bold">{x.a}</div>
              <div className="mt-0.5 text-[11.5px] text-ink3">{x.s}</div>
            </li>))}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {/* Opportunity by business area */}
        <section className="card p-4" aria-labelledby="areas">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="areas" className="text-[15px] font-bold">사업영역별 기회 집중도 — 전략 점수와 근거 수준을 분리 표시</h3>
            <button onClick={() => onNavigate('strategy')} className="text-[12px] underline">전략과제 우선순위 →</button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-ink3">
            <span><TermTip code="EVIDENCE_TIER">근거 구성(FPR 2031)</TermTip>:</span>
            {TIERS.map(k => <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: 'var(--c-fpr)', opacity: TIER_OPACITY[k] }} />{TIER_LABEL[k]}</span>)}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[980px] text-[12.5px] [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap" data-testid="area-table">
              <thead><tr className="text-left text-ink3">
                <th className="py-1">사업영역</th><th className="text-right">FPR 2026→2031</th><th className="w-[160px] pl-3">근거 구성</th>
                <th className="text-right"><TermTip code="DEMAND_ACCOUNTS">수요 고객 모델 / 관측 신호</TermTip></th><th className="text-right" title="기존 공급자 관찰 — 현행 지출 관측이며 신규 수요 아님">현행 지출 관측</th>
                <th>시장</th><th>수요</th><th>확보 가능성</th><th className="text-right"><TermTip code="ASSUMPTION_DEP">가정 의존도</TermTip></th>
                <th className="text-right"><TermTip code="PRIORITY_SCORE">전략 점수</TermTip></th><th>과제 상태</th></tr></thead>
              <tbody>{[...strat].sort((x, y) => y.FPR_2031 - x.FPR_2031).map(s => {
                const e = s.evidence
                const dep = e?.assumption_dependency
                return (
                  <tr key={s.area} className="border-t border-line align-middle">
                    <td className="py-1.5 font-semibold">{s.area}</td>
                    <td className="num text-right">{eok(s.FPR_2026, 'ESTIMATED')} → <b>{eok(s.FPR_2031, 'ESTIMATED')}</b></td>
                    <td className="pl-3"><TierBar s={s} /></td>
                    <td className="num text-right">{e ? `${e.n_accounts_model} / ${e.n_accounts_signal}` : '—'}</td>
                    <td className="num text-right text-ink2">{e ? e.n_accounts_incumbent_obs : '—'}</td>
                    {(['market', 'demand', 'capture'] as const).map(l => <td key={l}>{initOf(s.area) && <LensPill lens={l} level={initOf(s.area)!.lenses[l].level} />}</td>)}
                    <td className="num text-right" style={{ color: dep != null && dep > 0.5 ? 'var(--warn)' : undefined }}>{dep == null ? '—' : dep < 0 ? '감소 가정' : pct(dep, 0)}</td>
                    <td className="num text-right">{s.priority_score.toFixed(1)}</td>
                    <td className="text-[11.5px]">{initOf(s.area) ? `${REC_KO[s.recommendation_type ?? ''] ?? '—'} · ${ST_KO[initOf(s.area)!.status].l}` : '—'}</td>
                  </tr>)
              })}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-ink3">금액은 모두 모델 산출값입니다. 근거 구성은 금액의 정확도가 아니라 해당 영역 수요가 고객별 원천(수요 신호·고객별 비중·기존 공급자 관찰)으로 관측됐는지를 나타냅니다. 시장·수요·확보 가능성 3관점은 전략 점수에 반영되지 않으며, 수요 근거가 부족한 영역은 확정 성장 기회·투자 권고로 표시하지 않습니다.</p>
        </section>

        {/* Verification needed */}
        <section className="card p-4" aria-labelledby="verify">
          <h3 id="verify" className="text-[15px] font-bold">검증 필요사항</h3>
          <ul className="mt-2 space-y-2 text-[12.5px]" data-testid="verify-list">
            <li><Pill tone="warn">사내 데이터</Pill> CR {crN}/{n} · 승인 Target {tgtApproved}/{n} — ④⑤⑥⑧ 지표 산출 불가. <button className="underline" onClick={() => onNavigate('admin')}>관리자 입력·Excel Import</button></li>
            <li><Pill tone="warn">근거 원문</Pill> IT 지출을 1차 원문에서 확인한 고객 {data.meta.status_counts['EVIDENCE_VERIFIED'] ?? 0}개 — KISA 공시값은 언론 인용 상태(사내망 원문 대조 필요)</li>
            <li><Pill tone="warn">가정 의존</Pill> 성장분의 50% 이상이 배분 가정인 영역: {highDep.map(s => `${s.area} ${pct(s.evidence?.assumption_dependency, 0)}`).join(', ') || '없음'} — 민감도·고객 수요 검증 전 우선순위 확정 금지</li>
            <li><Pill tone="warn">집중도</Pill> {top2.map(r => name(r.id)).join('·')} 2개사가 비교 가능 FPR 2026의 {pct(top2Share, 0)} — 해당 고객 가정 오차가 전사 결과를 좌우</li>
            <li><Pill tone="err">RESEARCH GAP</Pill> TS 근거 부족 {gapAccounts.length}개사: {gapAccounts.map(a => <button key={a.account_id} className="mr-1 underline" onClick={() => onSelect(a.account_id)}>{a.original_name}</button>)}</li>
            <li><Pill>정의 상이</Pill> {mismatch}개사(하이퍼스케일러 국내 인프라 지출·망 이용대가 환산)는 합계에서 별도</li>
          </ul>
          <button onClick={() => onNavigate('quality')} className="mt-3 text-[12px] underline">데이터 신뢰도 →</button>
        </section>

        {/* Phase 3A: verification tasks by business area (from ③ ACTION) */}
        <section className="card p-4" aria-labelledby="vtasks" data-testid="verification-tasks">
          <h3 id="vtasks" className="text-[15px] font-bold">사업영역별 대응 옵션과 검증 과제 <span className="text-[12px] font-normal text-ink3">(③ 도출 결과 · 모두 제안 상태)</span></h3>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[980px] text-[12.5px]">
            <thead><tr className="text-left text-ink3 [&_th]:pr-2"><th className="py-1">사업영역</th><th>대응 옵션</th><th>핵심 검증 과제</th><th>담당(제안)</th><th>검증 사례</th></tr></thead>
            <tbody>{[...inits].sort((x, y) => x.priority.baseline_rank - y.priority.baseline_rank).map(i => (
              <tr key={i.area} className="border-t border-line align-top [&_td]:pr-2" data-area={i.area}>
                <td className="py-1.5 font-semibold whitespace-nowrap">{i.area}</td>
                <td className="whitespace-nowrap"><Pill tone={ST_KO[i.status].tone}>{i.option.label}</Pill></td>
                <td><ul className="list-disc pl-4">{i.actions.filter(a => a.lens !== 'internal').slice(0, 3).map(a => <li key={a.action_id}>{a.text}</li>)}</ul></td>
                <td className="text-[11.5px] text-ink3">{[...new Set(i.actions.filter(a => a.lens !== 'internal').slice(0, 3).map(a => a.owner_role))].join(', ')}</td>
                <td className="text-[11.5px]">{i.verification_case ? <span style={{ color: 'var(--warn)' }}>{i.verification_case.title.replace(/^검증 사례 [①②] /, '')}</span> : '—'}</td>
              </tr>))}</tbody>
          </table></div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Growth (numbers only; trajectory chart is Phase 2) */}
        <section className="card p-4" aria-labelledby="growth">
          <h3 id="growth" className="text-[15px] font-bold">전사 2026 → 2031 성장 (부분합)</h3>
          <table className="mt-2 w-full text-[12.5px] num">
            <thead><tr className="text-left text-ink3"><th className="py-1">지표</th><th className="text-right">2026</th><th className="text-right">2031 Base</th><th className="text-right">Low~High</th><th className="text-right">CAGR</th></tr></thead>
            <tbody>{(['TS', 'RAW', 'FPR'] as const).map(k => (
              <tr key={k} className="border-t border-line">
                <td className="py-1.5"><TermTip code={k}><span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--c-${k.toLowerCase()})` }} />{k}</span></TermTip></td>
                <td className="text-right">{eok(a26[k], 'ESTIMATED')}</td><td className="text-right font-bold">{eok(a31[k], 'ESTIMATED')}</td>
                <td className="text-right text-ink3">{eok(lo31[k], 'ESTIMATED')}~{eok(hi31[k], 'ESTIMATED')}</td><td className="text-right">{pct(cagr(a26[k], a31[k]))}</td></tr>))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-ink3">연도별 통합 궤적·동일 고객 집합 성장률은 <button className="underline" onClick={() => onNavigate('portfolio')}>② 전사 기회 분석</button>(중간연도는 Illustrative Projection).</p>
        </section>

        {/* Industry */}
        <section className="card p-4" aria-labelledby="industry">
          <div className="flex items-center justify-between"><h3 id="industry" className="text-[15px] font-bold">산업별 주요 기회 (FPR 2031)</h3><button onClick={() => onNavigate('portfolio')} className="text-[12px] underline">전사 기회 분석 →</button></div>
          <ul className="mt-2 space-y-1.5 text-[12.5px]">{byFamily.map(([k, r]) => {
            const max = byFamily[0][1].FPR_2031 || 1
            return (
              <li key={k}>
                <div className="flex justify-between"><span className="font-semibold">{k}</span><span className="num">{eok(r.FPR_2031, 'ESTIMATED')} <span className="text-ink3">· {r.n_est}/{r.n}개사</span></span></div>
                <div className="mt-0.5 h-1.5 rounded-sm" style={{ width: `${(100 * r.FPR_2031) / max}%`, background: 'var(--c-fpr)' }} />
              </li>)
          })}</ul>
        </section>

        {/* Capability gap */}
        <section className="card p-4" aria-labelledby="gap">
          <h3 id="gap" className="text-[15px] font-bold">LGU+ 역량 격차 (분석가 가설)</h3>
          <p className="text-[11.5px] text-ink3">공개정보 기반 분석가 판단 — 사내 역량 진단으로 검증 필요. '미확인'을 '부족'으로 단정하지 않습니다.</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px]">{topAreas.map(s => (
            <li key={s.area} className="border-t border-line pt-1.5">
              <div className="flex justify-between gap-2"><b>{s.area}</b><span className="text-ink2">Gap {s.capability_gap ?? '미평가'}</span></div>
              <div className="text-[11.5px] text-ink3">필요 역량: {s.required_capabilities ?? '—'}</div>
            </li>))}
          </ul>
        </section>
      </div>
    </div>
  )
}
