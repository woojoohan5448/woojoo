import { useMemo, useState } from 'react'
import type { Dashboard, Initiative, LensLevel } from '../types'
import EChart from '../components/EChart'
import type { Palette } from '../components/charts'
import { Pill } from '../components/badges'
import { LEVEL_LABEL, eok, pct } from '../lib/format'
import { TermTip } from '../components/Term'

const STATUS_KO: Record<string, { l: string; tone: 'ok' | 'warn' | 'err' | 'neutral' | 'brand' }> = {
  CANDIDATE: { l: '추진 검토 후보', tone: 'ok' }, NEEDS_VALIDATION: { l: '검증 필요', tone: 'warn' }, ANALYSIS_HYPOTHESIS: { l: '분석 가설', tone: 'err' } }
const STAB: Record<string, string> = { STABLE: '안정', MODERATE: '보통', SENSITIVE: '민감' }
const LENS_KO = { market: 'Market', demand: 'Demand', capture: 'Capture' } as const
const LV: Record<string, Record<LensLevel, string>> = {
  market: { SUFFICIENT: '근거 충분', PARTIAL: '근거 일부', INSUFFICIENT: '근거 부족' },
  demand: { SUFFICIENT: '수요 확인', PARTIAL: '수요 일부', INSUFFICIENT: '수요 근거 없음' },
  capture: { SUFFICIENT: '확보 가능성 높음', PARTIAL: '보통', INSUFFICIENT: '낮음' } }
export function LensPill({ lens, level }: { lens: 'market' | 'demand' | 'capture'; level: LensLevel }) {
  return <Pill tone={level === 'SUFFICIENT' ? 'ok' : level === 'PARTIAL' ? 'warn' : 'err'}>{LV[lens][level]}</Pill>
}

function InitiativeCard({ i, name, onSelect }: { i: Initiative; name: (id: string) => string; onSelect: (id: string) => void }) {
  const dem: any = i.lenses.demand
  return (
    <section className="card p-4" aria-label={`${i.area} 전략과제`} data-testid="initiative-card">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-bold">{i.initiative_id} · {i.area}</h3>
        <Pill tone={STATUS_KO[i.status].tone}>{STATUS_KO[i.status].l}</Pill><Pill>승인 상태: 제안(PROPOSED)</Pill></div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 text-[12.5px]">
        <Block k="WHY" title="왜 — 기회 규모와 근거">{i.why.map((w, n) => <li key={n}>{w}</li>)}</Block>
        <Block k="GAP" title="무엇이 부족한가">{i.gap.map((w, n) => <li key={n}>{w}</li>)}</Block>
        <Block k="OPTION" title="대응 옵션"><li><b>{i.option.label}</b></li>{i.option.text && <li className="text-ink2">{i.option.text}</li>}</Block>
        <Block k="PRIORITY" title="우선순위 — 전략적 매력도(근거와 별도)"><li>기준안 {i.priority.baseline_score}점 · {i.priority.baseline_rank}위 · 민감도 순위 {i.priority.rank_min}~{i.priority.rank_max}위({STAB[i.priority.stability]})</li><li className="text-ink3">{i.priority.note}</li></Block>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3 text-[12px]" data-testid="lenses">
        {(['market', 'demand', 'capture'] as const).map(l => { const L: any = i.lenses[l]; return (
          <div key={l} className="rounded-md border border-line p-2.5" data-lens-card={l}>
            <div className="flex items-center justify-between"><b>{LENS_KO[l]} {l === 'market' ? 'Evidence' : l === 'demand' ? 'Evidence' : 'Feasibility'}</b><LensPill lens={l} level={L.level} /></div>
            <div className="text-[11px] text-ink3">{L.basis}</div>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">{L.facts.slice(0, 6).map((f: string, n: number) => <li key={n}>{f}</li>)}</ul>
            {L.flags.length > 0 && <ul className="mt-1 space-y-0.5">{L.flags.map((f: string, n: number) => <li key={n} style={{ color: 'var(--warn)' }}>⚠ {f}</li>)}</ul>}
          </div>) })}
      </div>
      {dem.signals?.length > 0 && <div className="mt-3 text-[12px]"><div className="kicker mb-1">수요 근거 (양+ · 고객 클릭 → 수치 산출 근거)</div>
        <ul className="space-y-0.5">{dem.signals.slice(0, 8).map((s: any) => <li key={s.id}><button className="underline" onClick={() => onSelect(s.account_id)}>{name(s.account_id)}</button> · {s.type} · {s.description} <span className="text-ink3">[{(s.evidence_ids || []).join(', ')}]</span></li>)}</ul></div>}
      {dem.contradicting?.length > 0 && <div className="mt-2 text-[12px]"><div className="kicker mb-1">반대 근거 (예산 감액 등 — 수요로 집계 안 함)</div>
        <ul className="space-y-0.5">{dem.contradicting.map((s: any) => <li key={s.id}><button className="underline" onClick={() => onSelect(s.account_id)}>{name(s.account_id)}</button> · {s.description}</li>)}</ul></div>}
      <div className="mt-3"><div className="kicker mb-1">ACTION — 다음 행동(제안)</div>
        <table className="w-full text-[12px]" data-testid="actions"><tbody>{i.actions.map(a => <tr key={a.action_id} className="border-t border-line"><td className="py-1 pr-2 num text-ink3">{a.action_id}</td><td className="pr-2">{a.text}</td><td className="pr-2 text-ink3 whitespace-nowrap">{LENS_KO[a.lens as 'market'] ?? '사내 데이터'}</td><td className="pr-2 whitespace-nowrap">{a.owner_role}</td><td><Pill>제안</Pill></td></tr>)}</tbody></table>
      </div>
      {i.verification_case && <p className="mt-2 rounded-md bg-sunk p-2 text-[12px]"><b>{i.verification_case.title}</b> — {i.verification_case.finding} <b>{i.verification_case.implication}</b></p>}
    </section>
  )
}
function Block({ k, title, children }: { k: string; title: string; children: React.ReactNode }) {
  return <div className="rounded-md border border-line p-2.5" data-block={k}><div className="kicker">{k} <span className="normal-case text-ink3">· {title}</span></div><ul className="mt-1 list-disc pl-4 space-y-0.5">{children}</ul></div>
}

const REC_TONE: Record<string, 'brand' | 'ok' | 'warn' | 'neutral' | 'err'> = { INVEST: 'brand', EXPAND: 'ok', PARTNER: 'warn', 'M&A_REVIEW': 'err', MAINTAIN: 'neutral' }
const REC_LABEL: Record<string, string> = { INVEST: '투자', EXPAND: '확장', PARTNER: '제휴', 'M&A_REVIEW': '인수 검토', MAINTAIN: '유지' }

export default function StrategyView({ data, palette: p, onSelect, themeKey }: { data: Dashboard; palette: Palette; onSelect: (id: string) => void; themeKey: string }) {
  const rows = data.strategy
  const [open, setOpen] = useState<string>(rows[0]?.area ?? '')
  const name = (id: string) => data.accounts.find(a => a.account_id === id)?.original_name ?? id
  const opt = useMemo(() => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true, backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink1, fontSize: 12 }, valueFormatter: (v: number) => eok(v, 'ESTIMATED') },
    legend: { top: 0, textStyle: { color: p.ink2, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 8, right: 70, top: 30, bottom: 8, containLabel: true },
    yAxis: { type: 'category', inverse: true, data: rows.map(r => r.area), axisLabel: { color: p.ink2, fontSize: 12, fontWeight: 600 }, axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } } },
    xAxis: { type: 'value', axisLabel: { color: p.ink3, fontSize: 10, formatter: (v: number) => `${v.toLocaleString('ko-KR')}억` }, splitLine: { lineStyle: { color: p.line, type: 'dashed' } } },
    series: [
      { name: 'FPR 2026', type: 'bar', barMaxWidth: 10, itemStyle: { color: p.fpr, opacity: 0.5, borderRadius: [0, 3, 3, 0] }, data: rows.map(r => r.FPR_2026) },
      { name: 'FPR 2031 Base', type: 'bar', barMaxWidth: 10, itemStyle: { color: p.fpr, borderRadius: [0, 3, 3, 0] }, data: rows.map(r => r.FPR_2031),
        label: { show: true, position: 'right', fontSize: 10, color: p.ink2, formatter: (pp: any) => eok(pp.value, 'ESTIMATED') } },
      { name: 'FPR 2031 Strategic Expansion', type: 'bar', barMaxWidth: 10, itemStyle: { color: p.ts, borderRadius: [0, 3, 3, 0] }, data: rows.map(r => r.FPR_2031_expansion) },
    ],
  }), [rows, p])
  const inits = data.initiatives ?? []
  const flow = (data as any).opportunity_flow as { n_accounts: number; n_accounts_with_fpr: number; n_opportunities: number; n_initiatives: number; n_approved: number; n_actions: number; status_counts: Record<string, number> } | undefined
  const sens = data.priority_sensitivity
  const [sel, setSel] = useState<string>(inits[0]?.area ?? '')
  const cur = inits.find(i => i.area === sel)
  const cnt = (lens: 'market' | 'demand' | 'capture', lv: LensLevel) => inits.filter(i => i.lenses[lens].level === lv).length
  return (
    <div className="space-y-4 p-4">
      <section className="card p-4">
        <h2 className="text-[18px] font-bold">③ 전략과제 도출 <span className="text-[13px] font-semibold text-ink3">Opportunity-to-Action · 기존 Strategic Opportunity Engine 재사용</span></h2>
        <ol className="mt-2 flex flex-wrap items-stretch gap-1.5 text-[12px]" aria-label="도출 흐름" data-testid="derivation-flow">
          {[
            ['53 KA Opportunity', `${flow?.n_accounts ?? 53}개사 · FPR 산출 ${flow?.n_accounts_with_fpr ?? '—'}개사`],
            ['Opportunity Pool', `사업영역 ${rows.length}개 · 고객×영역 기회 ${flow?.n_opportunities ?? '—'}건 · FPR 2031 ${eok(rows.reduce((x, r) => x + r.FPR_2031, 0), 'ESTIMATED')}`],
            ['Market / Demand Evidence', `시장 충분 ${cnt('market', 'SUFFICIENT')}·일부 ${cnt('market', 'PARTIAL')}·부족 ${cnt('market', 'INSUFFICIENT')} / 수요 충분 ${cnt('demand', 'SUFFICIENT')}·일부 ${cnt('demand', 'PARTIAL')}·부족 ${cnt('demand', 'INSUFFICIENT')}`],
            ['Capability Gap', `확보 가능성 높음 ${cnt('capture', 'SUFFICIENT')}·보통 ${cnt('capture', 'PARTIAL')}·낮음 ${cnt('capture', 'INSUFFICIENT')} (분석가 판단)`],
            ['Strategic Initiative', `과제 ${inits.length}건 · ${Object.entries(flow?.status_counts ?? {}).map(([k, v]) => `${STATUS_KO[k]?.l ?? k} ${v}`).join(' · ')} · 승인 ${flow?.n_approved ?? 0}`],
            ['Priority', `기준안(v1 산식) + 가중치 민감도 ${sens?.scenarios.length ?? 0}개 시나리오`],
            ['Next Action', `제안 ${flow?.n_actions ?? 0}건 (모두 PROPOSED)`],
          ].map(([k, v], i, arr) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="rounded-md border border-line bg-sunk px-2.5 py-1.5"><b className="block">{k}</b><span className="text-ink3">{v}</span></span>
              {i < arr.length - 1 && <span aria-hidden className="text-ink3">→</span>}
            </li>))}
        </ol>
        <p className="text-[12.5px] text-ink2"><b>전략적 매력도(기존 우선순위 점수)와 근거 3관점은 별개</b>입니다. 근거는 점수에 섞지 않고 나란히 표시합니다. 기존 공급자 관찰·고객별 비중(KISA 등)은 <b>현행 지출 관측</b>이며 신규 수요로 집계하지 않고, 예산 감액 신호는 반대 근거로 표시합니다. 수요 근거가 없으면 <b>분석 가설</b>, 일부라도 부족하면 <b>검증 필요</b>이며 확정 성장 기회·투자 권고로 표시하지 않습니다. 신규 전략과제는 모두 제안(PROPOSED) 상태입니다.</p>
      </section>

      <section className="card p-4 overflow-x-auto" aria-labelledby="matrix-title">
        <h3 id="matrix-title" className="text-[15px] font-bold">전략과제 후보 매트릭스 <span className="text-[12px] font-normal text-ink3">(행 클릭 → WHY/GAP/OPTION/PRIORITY/ACTION)</span></h3>
        <table className="mt-2 w-full min-w-[1080px] text-[12.5px]" data-testid="initiative-matrix">
          <thead>
            <tr className="text-left text-[11px] text-ink3"><th colSpan={2}></th><th colSpan={3} className="border-b border-line">전략적 매력도 — 기존 산식(근거 미반영)</th><th className="w-3"></th><th colSpan={3} className="border-b border-line">근거 3관점 — 점수 미반영</th><th colSpan={2}></th></tr>
            <tr className="text-left text-ink3 [&_th]:whitespace-nowrap [&_th]:pr-2"><th className="py-1">#</th><th>사업영역</th><th className="text-right"><TermTip code="PRIORITY_SCORE">점수</TermTip></th><th className="text-right">순위 범위</th><th>민감도</th><th></th><th>Market</th><th>Demand</th><th>Capture</th><th>과제 상태</th><th>옵션</th></tr>
          </thead>
          <tbody>{[...inits].sort((x, y) => x.priority.baseline_rank - y.priority.baseline_rank).map(i => (
            <tr key={i.area} className={`border-t border-line cursor-pointer [&_td]:pr-2 ${sel === i.area ? 'bg-sunk' : ''}`} onClick={() => setSel(i.area)} data-area={i.area}>
              <td className="py-1.5 num">{i.priority.baseline_rank}</td><td className="font-semibold whitespace-nowrap">{i.area}</td>
              <td className="num text-right">{i.priority.baseline_score}</td>
              <td className="num text-right">{i.priority.rank_min === i.priority.rank_max ? `${i.priority.rank_min}위` : `${i.priority.rank_min}~${i.priority.rank_max}위`}</td>
              <td><Pill tone={i.priority.stability === 'STABLE' ? 'ok' : i.priority.stability === 'MODERATE' ? 'warn' : 'err'}>{STAB[i.priority.stability]}</Pill></td><td></td>
              {(['market', 'demand', 'capture'] as const).map(l => <td key={l} data-lens={l}><LensPill lens={l} level={i.lenses[l].level} /></td>)}
              <td data-status={i.status}><Pill tone={STATUS_KO[i.status].tone}>{STATUS_KO[i.status].l}</Pill></td>
              <td className="whitespace-nowrap text-[12px]">{i.option.label}</td>
            </tr>))}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-ink3">점수 = {rows[0]?.score_formula}. 순위 범위 = 가중치를 하나씩 ±50% 바꾸거나 균등 가중일 때의 최소~최대 순위. 판정 규칙 — Market: {cur?.lenses && (cur as any).lens_rules?.market?.SUFFICIENT} / Demand: {(cur as any)?.lens_rules?.demand?.SUFFICIENT} / Capture: {(cur as any)?.lens_rules?.capture?.SUFFICIENT}</p>
      </section>

      {cur && <InitiativeCard i={cur} name={name} onSelect={onSelect} />}

      <section className="card p-4" aria-labelledby="vcase" data-testid="verification-cases">
        <h3 id="vcase" className="text-[15px] font-bold">별도 검증 사례</h3>
        <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">{inits.filter(i => i.verification_case).map(i => (
          <div key={i.area} className="rounded-md border border-line p-3 text-[12.5px]" data-case={i.area}>
            <div className="font-bold">{i.verification_case!.title}</div>
            <p className="mt-1">{i.verification_case!.finding}</p>
            <p className="mt-1 font-semibold" style={{ color: 'var(--warn)' }}>{i.verification_case!.implication}</p>
            <div className="mt-1 flex flex-wrap gap-1"><span className="text-ink3">Market</span><LensPill lens="market" level={i.lenses.market.level} /><span className="text-ink3">Demand</span><LensPill lens="demand" level={i.lenses.demand.level} /><span className="text-ink3">Capture</span><LensPill lens="capture" level={i.lenses.capture.level} /><span className="text-ink3">· 기존(Phase 1) 판정 {LEVEL_LABEL[rows.find(r => r.area === i.area)?.evidence?.evidence_level ?? ''] ?? '—'}</span></div>
          </div>))}</div>
      </section>

      {sens && <section className="card p-4 overflow-x-auto" aria-labelledby="sens-title" data-testid="sensitivity">
        <h3 id="sens-title" className="text-[15px] font-bold">가중치 민감도 <span className="text-[12px] font-normal text-ink3">(전략적 매력도 순위만 · 근거 신뢰도와 혼합하지 않음)</span></h3>
        <table className="mt-2 w-full min-w-[900px] text-[12px] num">
          <thead><tr className="text-left text-ink3 [&_th]:whitespace-nowrap [&_th]:pr-2"><th className="py-1">시나리오</th>{[...inits].sort((x, y) => x.priority.baseline_rank - y.priority.baseline_rank).map(i => <th key={i.area} className="text-right">{i.area}</th>)}</tr></thead>
          <tbody>{sens.scenarios.map(sc => (
            <tr key={sc.id} className={`border-t border-line [&_td]:pr-2 ${sc.id === 'BASELINE' ? 'font-semibold' : ''}`}><td className="py-1 whitespace-nowrap">{sc.label}</td>
              {[...inits].sort((x, y) => x.priority.baseline_rank - y.priority.baseline_rank).map(i => { const r = sc.ranks[i.area], b0 = i.priority.baseline_rank
                return <td key={i.area} className="text-right" style={{ color: r !== b0 ? 'var(--warn)' : undefined }}>{r}위 <span className="text-ink3 text-[10.5px]">({sc.scores[i.area]})</span></td> })}
            </tr>))}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-ink3">{sens.method} 기준안 가중치는 경영진 확정 전 v1입니다.</p>
      </section>}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_1.3fr]">
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">사업영역별 FPR (2026 → 2031)</h3>
          <EChart option={opt} height={360} ariaLabel="사업영역별 FPR 2026, 2031 비교" themeKey={themeKey} onClick={(pp) => setOpen(rows[pp.dataIndex]?.area)} />
        </section>
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">사업영역 상세 (기존 엔진 출력)</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{rows.map(r => <button key={r.area} onClick={() => setOpen(r.area)} className={`rounded border border-line px-2 py-0.5 text-[12px] ${open === r.area ? 'bg-ink text-surface' : ''}`}>{r.area}</button>)}</div>
          <p className="mt-2 text-[12px] text-ink2">수요 집계는 TS 산출 {data.portfolio.aggregate['2026_base'].n_ts}개사 + 특수모델 고객 부분합, 역량 평가는 공개정보 기반 분석가 판단입니다. 아래 상세의 '근거 수준'은 Phase 1 판정(기존 공급자 관찰 포함)으로, 추적용으로만 유지합니다.</p>
        </section>
      </div>
      {rows.filter(r => r.area === open).map(r => (
        <section key={r.area} className="card p-4">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-bold">{r.area}</h3>{r.recommendation_type && <Pill tone={REC_TONE[r.recommendation_type]}>{REC_LABEL[r.recommendation_type]} · {STATUS_KO[inits.find(i => i.area === r.area)?.status ?? 'ANALYSIS_HYPOTHESIS'].l}</Pill>}{r.evidence && <Pill tone="neutral">Phase 1 판정(추적용): {LEVEL_LABEL[r.evidence.evidence_level]}</Pill>}<span className="text-[12px] text-ink3">카테고리: {r.categories.join(', ')}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6 num">
            {[['RAW 2026', eok(r.RAW_2026, 'ESTIMATED')], ['FPR 2026', eok(r.FPR_2026, 'ESTIMATED')], ['RAW 2031', eok(r.RAW_2031, 'ESTIMATED')], ['FPR 2031 Base', eok(r.FPR_2031, 'ESTIMATED')], ['FPR 2031 High', eok(r.FPR_2031_high, 'SCENARIO')], ['수요 신뢰도', `${r.demand_confidence}/100`]].map(([k, v]) => (
              <div key={k} className="rounded-md bg-sunk p-2"><div className="kicker">{k}</div><div className="text-[15px] font-bold">{v}</div></div>))}
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-[150px_1fr]">
            {[['LG U+ 현재 위치', r.lgu_position], ['진입 가능성', r.entry_feasibility], ['경쟁 강도', r.competition], ['필요 역량', r.required_capabilities], ['역량 격차', r.capability_gap], ['투자 필요성', r.investment_need], ['실행 난이도', r.difficulty], ['옵션 설명(검증 전)', r.recommendation], ['주의', r.caveats]]
              .filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="font-semibold text-ink2">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {r.evidence && <div className="mt-3 rounded-md border border-line p-2 text-[12.5px]" data-testid="area-evidence">
            <div className="kicker mb-1">Phase 1 근거 구성 (추적용 · 기존 공급자 관찰 포함 — 3관점 판정은 위 매트릭스)</div>
            <div>Evidence-based {r.evidence.accounts_by_tier.EVIDENCE_BASED.length}개사 ({eok(r.evidence.fpr2031_by_tier.EVIDENCE_BASED, 'ESTIMATED')}) · Model-estimated {r.evidence.accounts_by_tier.MODEL_ESTIMATED.length}개사 ({eok(r.evidence.fpr2031_by_tier.MODEL_ESTIMATED, 'ESTIMATED')}) · Unverified {r.evidence.accounts_by_tier.UNVERIFIED.length}개사 ({eok(r.evidence.fpr2031_by_tier.UNVERIFIED, 'ESTIMATED')})</div>
            <div className="mt-0.5">관측: 수요 신호 {r.evidence.n_accounts_signal}개사 · 기존 공급자 관찰 {r.evidence.n_accounts_incumbent_obs}개사 · 고객별 비중 근거 {r.evidence.n_accounts_specific_share}개사 · 가정 의존도 {r.evidence.assumption_dependency == null ? '—' : r.evidence.assumption_dependency < 0 ? '감소 가정' : pct(r.evidence.assumption_dependency, 0)}</div>
            {r.evidence.signals.length > 0 && <ul className="mt-1 space-y-0.5 text-ink2">{r.evidence.signals.slice(0, 6).map(sg => <li key={sg.signal_id}><button className="underline" onClick={() => onSelect(sg.account_id)}>{name(sg.account_id)}</button> · {sg.type} · {sg.description}</li>)}</ul>}
          </div>}
          <div className="mt-3"><div className="kicker mb-1">수요 상위 고객 (FPR 2031)</div>
            <div className="flex flex-wrap gap-1.5">{r.top_accounts.map(t => <button key={t.account_id} onClick={() => onSelect(t.account_id)} className="rounded border border-line px-2 py-0.5 text-[12px] hover:border-brand">{name(t.account_id)} <span className="num text-ink3">{eok(t.FPR_2031, 'ESTIMATED')}</span></button>)}</div></div>
          {r.evidence_refs && r.evidence_refs.length > 0 && <div className="mt-3"><div className="kicker mb-1">근거 (시장 벤치마크)</div>
            <ul className="text-[12px] text-ink2 space-y-0.5">{r.evidence_refs.map(id => { const it = data.market_benchmarks.items.find(i => i.item_id === id); const ev = it && data.market_benchmarks.evidence.find(e => e.evidence_id === it.evidence_id)
              return <li key={id}><Pill>{id}</Pill> {it ? `${it.topic}: ${it.value} ${it.unit} (${it.year})` : ''} {ev && <a href={ev.source_url} target="_blank" rel="noreferrer" className="underline">{ev.publisher}</a>} {ev && ev.verification_status !== 'VERIFIED' && <span className="text-ink3">(원문 미열람)</span>}</li> })}</ul></div>}
        </section>
      ))}
    </div>
  )
}
