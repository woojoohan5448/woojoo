import { useMemo, useState } from 'react'
import type { Dashboard } from '../types'
import EChart from '../components/EChart'
import type { Palette } from '../components/charts'
import { Pill } from '../components/badges'
import { LEVEL_LABEL, eok, pct } from '../lib/format'
import { TermTip } from '../components/Term'

const REC_TONE: Record<string, 'brand' | 'ok' | 'warn' | 'neutral' | 'err'> = { INVEST: 'brand', EXPAND: 'ok', PARTNER: 'warn', 'M&A_REVIEW': 'err', MAINTAIN: 'neutral' }
const REC_LABEL: Record<string, string> = { INVEST: '투자', EXPAND: '확장', PARTNER: '제휴', 'M&A_REVIEW': '인수 검토(권고)', MAINTAIN: '유지' }

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
  const cov = data.portfolio.aggregate['2026_base']
  return (
    <div className="space-y-4 p-4">
      <section className="card p-4">
        <h2 className="text-[18px] font-bold">전략과제 우선순위 <span className="text-[13px] font-semibold text-ink3">Strategic Priorities · 사업영역 Opportunity Pool (기존 Strategic Opportunity Engine)</span></h2>
        <p className="text-[12.5px] text-ink2">53개 고객의 카테고리별 수요(RAW·FPR)를 사업영역으로 통합하고 LG U+ 역량·경쟁·실행 난이도를 결합해 우선순위를 산정합니다. 수요 집계는 TS 산출 {cov.n_ts}개사 + 특수모델 고객 부분합이며, 역량 평가는 공개정보 기반 분석가 판단(사내 진단으로 검증 필요)입니다. <b>M&A는 확정 결론이 아닌 검토 권고</b>입니다.</p>
        <p className="mt-1 text-[12.5px] text-ink2"><b>전략 점수(매력도)와 근거 수준은 별개 지표</b>입니다. 근거 충분이 아닌 영역의 권고는 <b>검토 가설</b>이며, 가정 의존도가 높은 영역은 민감도·고객 수요 검증 후 재평가합니다. 고객 수요 기반 전략과제 후보·WHY/GAP/OPTION/ACTION은 Phase 3에서 제공됩니다.</p>
      </section>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_1.3fr]">
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">사업영역별 FPR (2026 → 2031)</h3>
          <EChart option={opt} height={360} ariaLabel="사업영역별 FPR 2026, 2031 비교" themeKey={themeKey} onClick={(pp) => setOpen(rows[pp.dataIndex]?.area)} />
        </section>
        <section className="card p-4 overflow-x-auto">
          <h3 className="text-[15px] font-bold">우선 검토 순위 <span className="text-[12px] font-normal text-ink3">(v1 기준 점수 · 가중치 확정은 경영진 의사결정)</span></h3>
          <table className="mt-2 w-full min-w-[860px] text-[12.5px] num [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead><tr className="text-left text-ink3"><th className="py-1">#</th><th>사업영역</th><th className="text-right"><TermTip code="PRIORITY_SCORE">점수</TermTip></th><th className="text-right">FPR 2031</th><th className="text-right">CAGR</th><th className="text-right"><TermTip code="DEMAND_ACCOUNTS">수요 고객 모델/관측</TermTip></th><th><TermTip code="EVIDENCE_LEVEL">근거 수준</TermTip></th><th className="text-right"><TermTip code="ASSUMPTION_DEP">가정 의존도</TermTip></th><th className="text-right" title="정의 상이(하이퍼스케일러 국내 투자 기준) — 합계 미포함">별도 수요*</th><th>권고</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.area} className={`border-t border-line cursor-pointer ${open === r.area ? 'bg-sunk' : ''}`} onClick={() => setOpen(r.area)}>
                <td className="py-1.5">{i + 1}</td><td className="font-semibold">{r.area}</td><td className="text-right">{r.priority_score}</td>
                <td className="text-right">{eok(r.FPR_2031, 'ESTIMATED')}</td><td className="text-right">{pct(r.FPR_CAGR)}</td><td className="text-right">{r.n_accounts} / {r.evidence?.n_accounts_signal ?? '—'}</td><td>{r.evidence && <Pill tone={r.evidence.evidence_level === 'SUFFICIENT' ? 'ok' : r.evidence.evidence_level === 'PARTIAL' ? 'warn' : 'err'}>{LEVEL_LABEL[r.evidence.evidence_level]}</Pill>}</td><td className="text-right">{r.evidence?.assumption_dependency == null ? '—' : r.evidence.assumption_dependency < 0 ? '감소 가정' : pct(r.evidence.assumption_dependency, 0)}</td><td className="text-right text-ink3">{r.FPR_2031_definition_mismatch > 0 ? eok(r.FPR_2031_definition_mismatch, 'ESTIMATED') : '—'}</td>
                <td>{r.recommendation_type && <Pill tone={REC_TONE[r.recommendation_type]}>{REC_LABEL[r.recommendation_type] ?? r.recommendation_type}{r.evidence?.recommendation_mode === 'HYPOTHESIS' ? ' · 가설' : ''}</Pill>}</td></tr>))}</tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink3">점수 = {rows[0]?.score_formula}</p>
          <p className="text-[11px] text-ink3">* 별도 수요: TS 정의가 다른 고객(하이퍼스케일러 국내 인프라 투자 기준, {[...new Set(rows.flatMap(r => r.mismatch_accounts))].map(name).join(', ') || '없음'})의 FPR 2031. 우선순위 점수·합계에는 미포함, 의사결정 시 참고.</p>
        </section>
      </div>
      {rows.filter(r => r.area === open).map(r => (
        <section key={r.area} className="card p-4">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-bold">{r.area}</h3>{r.recommendation_type && <Pill tone={REC_TONE[r.recommendation_type]}>{REC_LABEL[r.recommendation_type]}{r.evidence?.recommendation_mode === 'HYPOTHESIS' ? ' · 검토 가설' : ''}</Pill>}{r.evidence && <Pill tone={r.evidence.evidence_level === 'SUFFICIENT' ? 'ok' : 'warn'}>{LEVEL_LABEL[r.evidence.evidence_level]}</Pill>}<span className="text-[12px] text-ink3">카테고리: {r.categories.join(', ')}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6 num">
            {[['RAW 2026', eok(r.RAW_2026, 'ESTIMATED')], ['FPR 2026', eok(r.FPR_2026, 'ESTIMATED')], ['RAW 2031', eok(r.RAW_2031, 'ESTIMATED')], ['FPR 2031 Base', eok(r.FPR_2031, 'ESTIMATED')], ['FPR 2031 High', eok(r.FPR_2031_high, 'SCENARIO')], ['수요 신뢰도', `${r.demand_confidence}/100`]].map(([k, v]) => (
              <div key={k} className="rounded-md bg-sunk p-2"><div className="kicker">{k}</div><div className="text-[15px] font-bold">{v}</div></div>))}
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-[150px_1fr]">
            {[['LG U+ 현재 위치', r.lgu_position], ['진입 가능성', r.entry_feasibility], ['경쟁 강도', r.competition], ['필요 역량', r.required_capabilities], ['역량 격차', r.capability_gap], ['투자 필요성', r.investment_need], ['실행 난이도', r.difficulty], [r.evidence?.recommendation_mode === 'HYPOTHESIS' ? '권고(검토 가설)' : '권고', r.recommendation], ['주의', r.caveats]]
              .filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="font-semibold text-ink2">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {r.evidence && <div className="mt-3 rounded-md border border-line p-2 text-[12.5px]" data-testid="area-evidence">
            <div className="kicker mb-1">근거 수준 (전략 점수와 별도)</div>
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
