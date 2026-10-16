import { useState } from 'react'
import type { Account, AddrCase, Dashboard, InternalRec, LedgerEntry, ReconRow, Scenario, Selection } from '../types'
import { Pill } from './badges'
import { TermTip } from './Term'
import { eok, pct } from '../lib/format'

/** Phase 3A — Internal–External Reconciliation (사내–외부 데이터 대사).
 *  Shows, per value: official source, base year, scenario, data status, approval status, evidence IDs (ledger),
 *  then the six internal fields side by side with the external model. Read-only: no import, no recalculation. */

export const SOURCE_LABEL: Record<string, string> = { EXTERNAL_MODEL: '외부 모델(기본 출처)', INTERNAL_APPROVED: '사내 승인값' }
export const APPROVAL_LABEL: Record<string, string> = {
  MODEL_DEFAULT: '모델 기본값(경영 승인 아님)', RESEARCH_GAP: 'RESEARCH GAP', APPROVED: '승인', NOT_PROVIDED: '사내 미입력',
}
const REC_STATUS: Record<string, string> = { SOURCE: '원천값', VALIDATED: '형식 검증', VERIFIED: '검증(미승인)', APPROVED: '승인', REJECTED: '반려', SUPERSEDED: '대체됨' }
const JUDGE: Record<string, { l: string; tone: 'ok' | 'warn' | 'err' | 'neutral' }> = {
  ALIGNED: { l: '정합(±20%)', tone: 'ok' }, REVIEW_INTERNAL_HIGHER: { l: '검토 — 사내 높음', tone: 'warn' }, REVIEW_INTERNAL_LOWER: { l: '검토 — 사내 낮음', tone: 'warn' },
  REFERENCE_ONLY: { l: '참고(정의 근사)', tone: 'neutral' }, NOT_COMPARABLE: { l: '비교 불가(정의 미확정)', tone: 'neutral' },
  WITHIN_FPR: { l: 'FPR 이내', tone: 'ok' }, TARGET_ABOVE_FPR: { l: 'FPR 초과 — 검토', tone: 'err' }, EXTERNAL_NA: { l: '외부값 없음', tone: 'neutral' },
}
/** The six internal fields the contract manages, in display order. */
export const INTERNAL_FIELDS: { id: string; label: string; measures: string[]; ext: string; note: string }[] = [
  { id: 'SAM', label: 'Internal SAM', measures: ['INT_SAM'], ext: '② RAW', note: '정의 미확정(B2) → 비교 불가' },
  { id: 'RAW', label: 'Internal RAW (원본 · 역산 보정 · 보정 후)', measures: ['INT_RAW_SOURCE', 'INT_RAW_ADJ', 'INT_RAW_ADJUSTED'], ext: '② RAW', note: '역산 산식 미확인(B3) → 참고' },
  { id: 'ACTUAL', label: 'Actual Revenue', measures: ['ACTUAL_REVENUE'], ext: '④ CR', note: '승인 시 공식 CR' },
  { id: 'PLAN', label: 'Sales Plan', measures: ['SALES_PLAN'], ext: '③ FPR 상한', note: '승인 시 매출 계획 경로' },
  { id: 'STRETCH', label: 'Stretch', measures: ['STRETCH'], ext: '③ FPR 상한', note: '비교 전용' },
  { id: 'TARGET', label: 'Target Case · Approved Target', measures: ['TARGET_CASE', 'APPROVED_TARGET'], ext: '⑧ Target / FPR 상한', note: '승인 목표만 공식(D1), 케이스 자동 승격 금지' },
]

export const caseId = (scen: Scenario, addr: AddrCase) => `${scen.toUpperCase()}|${addr === 'base' ? 'BASE_CASE' : 'STRATEGIC_EXPANSION'}`

export default function ReconPanel({ data, account: a, scen, addr, onInspect }: { data: Dashboard; account: Account; scen: Scenario; addr: AddrCase; onInspect: (s: Selection) => void }) {
  const [showAll, setShowAll] = useState(false)
  const R = data.recon
  if (!R) return null
  const acc = R.accounts[a.account_id]
  const led = new Map((acc?.ledger ?? []).map(e => [e.key, e]))
  const cs = caseId(scen, addr)
  const rows: { label: string; metric: 'TS' | 'RAW' | 'FPR' | 'REV'; year: 2026 | 2031; e: LedgerEntry | undefined; scen: string }[] = [
    ...(['TS', 'RAW', 'FPR'] as const).map(m => ({ label: `${m} 2026`, metric: m, year: 2026 as const, e: led.get(`${m}|2026|BASE|BASE_CASE`), scen: '기준값' })),
    ...(['TS', 'RAW', 'FPR'] as const).map(m => ({ label: `${m} 2031`, metric: m, year: 2031 as const, e: led.get(`${m}|2031|${cs}`), scen: `${scen.toUpperCase()} · ${m === 'TS' ? '—' : addr === 'base' ? 'Base Case' : 'Strategic Expansion'}` })),
    { label: 'CR 2026', metric: 'REV', year: 2026, e: led.get('CR|2026|ACTUAL'), scen: '실적' },
    { label: 'Target 2031', metric: 'REV', year: 2031, e: led.get('TARGET|2031|APPROVED'), scen: '경영 승인' },
  ]
  const internal = acc?.internal ?? []
  const recon = new Map((acc?.recon_rows ?? []).map(r => [r.record_id, r]))
  const switched = (acc?.ledger ?? []).filter(e => e.official_source === 'INTERNAL_APPROVED' && e.selection_id).length
  const slotNote = (m: string) => {
    const pol = R.policy[m === 'REV' ? 'CR' : m]
    if (!pol) return ''
    if (m === 'REV') return '사내 승인값만(외부 대체 없음)'
    return pol.internal_candidates.length ? `전환 후보: ${pol.internal_candidates.join(', ')}` : (pol.pending ?? '사내 후보 미정의')
  }
  return (
    <section className="card p-4" aria-labelledby="recon-title" data-testid="recon-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="recon-title" className="text-[15px] font-bold">Internal–External Reconciliation <span className="text-[12px] font-normal text-ink3">(사내–외부 데이터 대사 · 읽기 전용)</span></h3>
        <div className="flex flex-wrap gap-1.5" data-testid="recon-chips">
          <Pill tone="brand">공식 출처: {switched ? `사내 승인 전환 ${switched}건` : '외부 모델(기본값)'}</Pill>
          <Pill>사내 레코드 {internal.length}건</Pill>
          {R.contains_synthetic && <Pill tone="err">합성 테스트 데이터 — 실데이터 아님</Pill>}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-ink2">외부 모델 값은 <b>현재 기본 출처</b>이며 영구 공식값이 아닙니다. 사내 값은 ① 레코드 승인 ② 정의 일치(DIRECT) ③ 출처 선택 승인(직무 분리)을 모두 충족할 때만 고객·지표·연도·케이스 단위로 공식 출처가 전환됩니다(자동 전환 없음). 원천 레코드는 불변 보존, 선택 결과만 별도 관리합니다.</p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[980px] text-[12px]" data-testid="ledger-table">
          <thead><tr className="text-left text-ink3 [&_th]:whitespace-nowrap [&_th]:pr-2"><th className="py-1">지표</th><th className="text-right">값</th><th>공식 출처</th><th>기준연도</th><th>시나리오</th><th>데이터 상태</th><th>승인 상태</th><th>근거 ID</th><th>출처 전환 조건</th></tr></thead>
          <tbody>{rows.map(r => {
            const e = r.e
            const ref = e?.scenario_reference
            return (
              <tr key={r.label} className="border-t border-line align-top [&_td]:pr-2" data-key={e?.key}>
                <td className="py-1 font-semibold whitespace-nowrap">{r.label}</td>
                <td className="num text-right whitespace-nowrap">{e?.value_eok == null ? <span className="text-ink3">{r.metric === 'REV' ? (r.year === 2026 ? '사내 매출 미입력' : '사내 목표 미입력') : 'N/A'}</span> : eok(e.value_eok, e.official_source === 'EXTERNAL_MODEL' ? 'ESTIMATED' : 'VERIFIED')}
                  {ref?.value_eok != null && <div className="text-[10.5px] text-ink3">시나리오 참고 {eok(ref.value_eok, 'SCENARIO')}(공식 아님)</div>}
                  {e?.replaced_external_value != null && <div className="text-[10.5px] text-ink3">외부 모델 {eok(e.replaced_external_value, 'ESTIMATED')}</div>}</td>
                <td className="whitespace-nowrap">{e?.official_source ? <Pill tone={e.official_source === 'INTERNAL_APPROVED' ? 'ok' : 'neutral'}>{SOURCE_LABEL[e.official_source]}</Pill> : <span className="text-ink3">—</span>}</td>
                <td className="num whitespace-nowrap">{e?.base_year ? (r.metric === 'REV' || e.official_source === 'INTERNAL_APPROVED' ? `FY${e.base_year}${e.official_source === 'INTERNAL_APPROVED' && r.metric !== 'REV' ? ' (사내)' : ''}` : `FY${e.base_year} 앵커 → FY${r.year}`) : '—'}</td>
                <td className="whitespace-nowrap">{r.scen}</td>
                <td>{e?.value_eok == null && r.metric === 'REV' ? '—' : (e?.data_status ?? '—')}</td>
                <td className="whitespace-nowrap">{APPROVAL_LABEL[e?.approval_status ?? ''] ?? e?.approval_status ?? '—'}</td>
                <td className="whitespace-nowrap">{e && e.official_source === 'INTERNAL_APPROVED' && r.metric !== 'REV' ? <span title={`출처 선택 ${e.selection_id}`}>{e.evidence_ids.join(', ')} · {e.selection_id}</span> : e && e.evidence_ids.length ? <button className="underline text-left" onClick={() => onInspect({ year: r.year, metric: r.metric })} title="근거 패널 열기">{e.evidence_ids.slice(0, 3).join(', ')}{e.evidence_ids.length > 3 ? ` 외 ${e.evidence_ids.length - 3}` : ''}</button> : <span className="text-ink3">—</span>}</td>
                <td className="text-[11px] text-ink3">{slotNote(r.metric)}</td>
              </tr>)
          })}</tbody>
        </table>
      </div>

      <h4 className="mt-3 text-[13px] font-bold">사내 필드 비교 <span className="font-normal text-ink3 text-[11.5px]">(원천값 ≠ 검증값 ≠ 승인값 — 승인값만 공식 계산)</span></h4>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]" data-testid="internal-fields">
          <thead><tr className="text-left text-ink3 [&_th]:whitespace-nowrap [&_th]:pr-2"><th className="py-1">사내 필드</th><th>외부 대응</th><th>레코드(원본값 · 상태) · 외부 값 · 대사 판정</th><th>규칙</th></tr></thead>
          <tbody>{INTERNAL_FIELDS.map(f => {
            const rs = internal.filter(r => f.measures.includes(r.measure_id))
            return (
              <tr key={f.id} className="border-t border-line align-top [&_td]:pr-2" data-field={f.id}>
                <td className="py-1 font-semibold">{f.label}</td>
                <td className="whitespace-nowrap text-ink2">{f.ext}</td>
                <td>{rs.length === 0 ? <span className="text-ink3">사내 입력 없음</span> : (showAll ? rs : rs.slice(0, 4)).map(r => <RecLine key={r.record_id} r={r} x={recon.get(r.record_id)} />)}
                  {!showAll && rs.length > 4 && <button className="text-[11px] underline" onClick={() => setShowAll(true)}>+{rs.length - 4}건 더 보기</button>}</td>
                <td className="text-[11px] text-ink3">{f.note}</td>
              </tr>)
          })}</tbody>
        </table>
      </div>
      {internal.length > 0 && (() => { const oi = R.official_internal ?? {}; const cr = oi.CR?.[a.account_id], tg = oi.TARGET?.[a.account_id], pl = oi.REVENUE_PLAN?.[a.account_id]
        return <p className="mt-2 text-[12px]" data-testid="recon-official-internal"><b>계약 기준 승인값 해석</b>(공식 슬롯 후보): CR {cr ? `${cr.value_eok}억 (${cr.period_type}, ${cr.records.join('+')})` : '없음'} · Target {tg ? `${tg.value_eok}억${tg.derived_from_case_id ? ` (← ${tg.derived_from_case_id})` : ''}` : '없음'} · 매출 계획 {pl ? `${Object.keys(pl).length}개 연도` : '없음'} <span className="text-ink3">— 미승인·격리·비교 전용 레코드는 제외. 대시보드 KPI(CR·Target) 연결은 Phase 3B 승인 후.</span></p> })()}
      {internal.length === 0 && <p className="mt-2 text-[12px] text-ink3" data-testid="recon-empty">사내 데이터 미연동 — 실제 사내 Excel 연동(Phase 3B)은 Blocker B1(양식)·B2(SAM 정의)·B3(RAW 역산)·B4(Target Case)·B6(고객 매핑)·B8(보안 승인) 해소 후 별도 승인으로 진행합니다. 그 전까지 모든 공식 값은 외부 모델 기본값이며 CR·Target은 미입력(0 대체 없음)입니다.</p>}
      {(acc?.internal ?? []).some(r => r.quarantined) && <p className="mt-1 text-[12px]" style={{ color: 'var(--err)' }}>계약 위반으로 격리된 레코드는 공식·대사 계산에서 제외됩니다(원본은 보존).</p>}
      <p className="mt-1 text-[11px] text-ink3"><TermTip code="RAW">RAW</TermTip> 비교 쌍은 외부 RAW ↔ 사내 SAM/RAW, 매출 계열은 외부 FPR 상한 점검만 수행합니다(지출과 매출 직접 비교 금지). 계약 {R.contract_version} · 정책 {R.policy_version}</p>

      {a.reconciliation && (
        <details className="mt-3"><summary className="cursor-pointer text-[12.5px] font-semibold">영업 추정(SALES_ESTIMATE) 대사 — Phase 4</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px] num"><thead><tr className="text-left text-ink3"><th className="py-1">지표</th><th>외부 추정</th><th>영업 추정</th><th>차이</th><th>판정</th><th>담당</th></tr></thead>
              <tbody>{a.reconciliation.rows.map(r => <tr key={`${r.year}${r.metric}`} className="border-t border-line"><td className="py-1">{r.year} {r.metric}</td><td>{eok(r.external, 'ESTIMATED')}</td><td>{r.sales === null ? '—' : eok(r.sales, 'VERIFIED')}</td>
                <td>{r.diff_pct === null ? '—' : pct(r.diff_pct, 0)}</td><td><Pill tone={r.flag === 'ALIGNED' ? 'ok' : r.flag.startsWith('REVIEW') ? 'warn' : 'neutral'}>{r.flag}</Pill></td><td className="text-ink3">{r.sales_rep ?? ''}</td></tr>)}</tbody></table>
            <div className="mt-2 text-[12.5px] num">사내 CR {eok(a.reconciliation.internal_cr, 'VERIFIED')} · 경영진 목표 {eok(a.reconciliation.management_target, 'VERIFIED')} · Opportunity Gap(FPR−CR) {eok(a.reconciliation.opportunity_gap, 'ESTIMATED')}</div>
            {a.reconciliation.notes.map((n, i) => <p key={i} className="text-[12px]" style={{ color: 'var(--warn)' }}>{n}</p>)}
          </div>
        </details>)}
    </section>
  )
}

function RecLine({ r, x }: { r: InternalRec; x?: ReconRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1" data-record={r.record_id}>
      <span className="num">{r.fiscal_year}</span>
      <span className="text-ink3">{r.measure_id.replace('INT_RAW_', 'RAW_').replace('TARGET_CASE', r.case_id)}{r.area_level !== 'ACCOUNT' ? ` · ${r.area_id}` : ''}</span>
      <span className="num font-semibold" title={`원본 셀 ${r.raw.value} ${r.raw.unit} · ${r.source_id}`}>{r.raw.value} {r.raw.unit}</span>
      <Pill tone={r.quarantined ? 'err' : r.status === 'APPROVED' ? 'ok' : r.status === 'VERIFIED' ? 'warn' : 'neutral'}>{r.quarantined ? '격리' : REC_STATUS[r.status] ?? r.status}</Pill>
      {r.synthetic && <Pill tone="err">합성</Pill>}
      {x && <span className="inline-flex items-center gap-1 text-ink3">· 외부 <span className="num">{x.external_eok == null ? '—' : eok(Number(x.external_eok), 'ESTIMATED')}</span>
        <Pill tone={JUDGE[x.judgement]?.tone ?? 'neutral'}>{JUDGE[x.judgement]?.l ?? x.judgement}</Pill>{x.diff_pct != null && x.judgement !== 'NOT_COMPARABLE' && <span className="num">{pct(Number(x.diff_pct), 0)}</span>}</span>}
    </div>
  )
}
