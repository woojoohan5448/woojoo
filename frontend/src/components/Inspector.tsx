import type { Account, AddrCase, Dashboard, Evidence, MetricRec, Scenario, Selection } from '../types'
import { TermTip } from './Term'
import { CAT_LABEL, METRIC_LABEL, NA_KO, STATUS_LABEL, eok, fmtRec, missingText, naInfo, pct } from '../lib/format'
import { resolveMetric } from '../lib/data'
import { ConfidenceMeter, GradeBadge, Pill, StatusBadge } from './badges'
import { BRIDGE_LABEL } from './charts'

function termCode(sel: Selection): string {
  if (sel.metric === 'REV') return sel.year === 2026 ? 'CR' : 'TARGET'
  if (sel.metric.endsWith('_CAGR')) return 'Y2031'
  if (sel.year === 2031 && ['TS', 'RAW', 'FPR'].includes(sel.metric)) return sel.metric
  return sel.metric
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-3 mt-3">
      <h4 className="kicker mb-1.5"><span className="num mr-1">{String(n).padStart(2, '0')}</span>{title}</h4>
      <div className="text-[13px] text-ink leading-relaxed">{children}</div>
    </section>
  )
}

function EvidenceCard({ e }: { e: Evidence }) {
  const unconfirmed = e.verification_status !== 'VERIFIED'
  return (
    <div className="rounded-md border border-line bg-sunk p-2.5 mb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-[12.5px] leading-snug">{e.source_title || '(제목 없음)'}</div>
        <Pill tone={e.tier === 1 ? 'ok' : e.tier === 2 ? 'warn' : 'neutral'}>Tier {e.tier}</Pill>
      </div>
      <div className="text-[11.5px] text-ink2 mt-0.5">{e.publisher} · 발행 {e.publication_date || '미상'} · 조회 {e.accessed_at || '-'} · {e.fiscal_period || ''}</div>
      {e.page_or_section && <div className="text-[11.5px] text-ink3">위치: {e.page_or_section}</div>}
      {e.quoted_statement && <blockquote className="mt-1.5 border-l-2 border-line pl-2 text-[12px] text-ink2 italic">“{e.quoted_statement}”</blockquote>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px]">
        {e.reported_value && <span className="num">원천값 {e.reported_value} {e.reported_unit}</span>}
        <Pill tone={unconfirmed ? 'warn' : 'ok'}>{unconfirmed ? '원문 미열람(검색 인용)' : '원천 직접 확인'}</Pill>
        {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="underline break-all">원문 링크</a>}
      </div>
      <div className="text-[10.5px] text-ink3 mt-1">{e.evidence_id}{e.document_id ? ` · 문서 ${e.document_id}` : ''}{e.source_hash ? ` · hash ${e.source_hash}` : ''}</div>
    </div>
  )
}

function assumptionText(d: Dashboard, id: string): string {
  const pe = d.parameter_evidence[id] ?? d.parameter_evidence[`${id}.organic`]
  return pe ? `${pe.basis} — ${pe.comment}` : ''
}

interface Props { data: Dashboard; account: Account; sel: Selection; scen: Scenario; addr: AddrCase }

export default function Inspector({ data, account: a, sel, scen, addr }: Props) {
  const evById = new Map(a.evidence.map(e => [e.evidence_id, e]))
  const params = data.params

  // --- Category drill (internal decomposition) --------------------------------------------
  if (sel.category) {
    const c = sel.category
    const b = a.m['2031'][scen]
    const ts = sel.year === 2026 ? a.m['2026'].TS : b.TS
    const raw = sel.year === 2026 ? a.m['2026'].RAW : addr === 'base' ? b.RAW_base : b.RAW_expansion
    const fpr = sel.year === 2026 ? a.m['2026'].FPR : addr === 'base' ? b.FPR_base : b.FPR_expansion
    const caseKey = sel.year === 2026 ? '2026' : addr === 'base' ? '2031_base' : '2031_expansion'
    const capKey = sel.year === 2026 ? '2026' : '2031'
    const mix = a.mix?.[c]
    return (
      <div>
        <div className="kicker">카테고리 분해 · {sel.year}{sel.year === 2031 ? ` · ${scen}` : ''}</div>
        <h3 className="text-lg font-bold mt-0.5">{CAT_LABEL[c]}</h3>
        <p className="text-[12px] text-ink3 mt-1">모델 내부 분해(Layer C 가정 기반)입니다. 고객별 LG U+ 상품 매출 배분이 아닙니다.</p>
        <Section n={1} title="수치">
          <div className="grid grid-cols-3 gap-2 num">
            <div><div className="text-ink3 text-[11px]">TS_i</div><b>{eok(ts.by_cat?.[c] ?? null, 'ESTIMATED')}</b></div>
            <div><div className="text-ink3 text-[11px]">RAW_i</div><b>{eok(raw.by_cat?.[c] ?? null, 'ESTIMATED')}</b></div>
            <div><div className="text-ink3 text-[11px]">FPR_i</div><b>{eok(fpr.by_cat?.[c] ?? null, 'ESTIMATED')}</b></div>
          </div>
        </Section>
        <Section n={2} title="계산식">
          <code className="block text-[12px] bg-sunk rounded p-2">TS_i = TS × Mix_i{sel.year === 2031 ? ' (2031: 브리지 증감 배분 B-ALLOC 반영)' : ''}<br />RAW_i = TS_i × Addressability_i [{caseKey}]<br />FPR_i = RAW_i × Capture_Ceiling_i [{capKey}]</code>
        </Section>
        <Section n={3} title="적용 가정">
          <ul className="list-disc pl-4">
            {sel.year === 2026 && <li>Mix_i (A-MIX, {a.family}) = {mix !== undefined ? pct(mix) : 'N/A'}{c === 'SECURITY' && a.sec_ratio ? ' — KISA 공시 정보보호/IT 비율로 대체' : ''}</li>}
            <li>Addressability_i (C-ADDR {caseKey}) = 기본 {pct(params.addressability[caseKey][c], 0)}{sel.year === 2026 ? ` → 적용 ${pct(a.rates_2026[c], 0)}` : ''}</li>
            <li>Capture Ceiling_i (C-CAP {capKey}) = 기본 {pct(params.capture_ceiling[capKey][c], 0)}{sel.year === 2026 ? ` → 적용 ${pct(a.caps_2026[c], 0)}` : ''}</li>
          </ul>
          <div className="text-[12px] text-ink3 mt-1">{assumptionText(data, 'C-ADDR')}</div>
        </Section>
        {a.override_notes.length > 0 && <Section n={4} title="계정별 보정 사유"><ul className="list-disc pl-4">{a.override_notes.map((n, i) => <li key={i}>{n}</li>)}</ul></Section>}
      </div>
    )
  }

  // --- Bridge component -----------------------------------------------------------------
  if (sel.bridgeComponent && sel.bridgeComponent !== 'start' && sel.bridgeComponent !== 'end') {
    const k = sel.bridgeComponent
    const b = a.m['2031'][scen]
    const v = b.bridge?.components[k] ?? null
    const prm = b.bridge?.params ?? {}
    const pkey = k === 'organic' ? 'organic_cagr' : k
    const formula: Record<string, string> = {
      organic: 'Organic = TS_2026 × ((1+g_org)^5 − 1)', cloud: 'Cloud = TS_2026 × cloud_ratio (5년 누적)', ai: 'AI = TS_2026 × ai_ratio (5년 누적)',
      regulatory: 'Regulatory = TS_2026 × reg_ratio', efficiency: 'Efficiency = −TS_2026 × eff_ratio', substitution: 'Substitution = −TS_2026 × sub_ratio',
      infra: 'Infra = Σ 계정별 인프라 드라이버(연환산, 2031)', other: 'Other = 계정별 조정',
    }
    return (
      <div>
        <div className="kicker">2026→2031 브리지 · {scen.toUpperCase()}</div>
        <h3 className="text-lg font-bold mt-0.5">{BRIDGE_LABEL[k]}</h3>
        <Section n={1} title="수치"><b className="num text-xl">{v === null ? 'N/A' : (v >= 0 ? '+' : '−') + eok(Math.abs(v), 'ESTIMATED', { approx: false })}</b> <StatusBadge status={scen === 'base' ? 'ESTIMATED' : 'SCENARIO'} /></Section>
        <Section n={2} title="계산식"><code className="block text-[12px] bg-sunk rounded p-2">{formula[k]}</code>
          {prm[pkey] !== undefined && <div className="mt-1 num">적용 파라미터 {pkey} = {String(prm[pkey])} ({a.family} · {scen})</div>}</Section>
        <Section n={3} title="근거·가정">
          <div>{assumptionText(data, `B-BRIDGE.${k}`) || assumptionText(data, 'B-BRIDGE')}</div>
          <div className="mt-1 flex flex-wrap gap-1">{(data.parameter_evidence[`B-BRIDGE.${k}`]?.refs ?? []).map(r => {
            const it = data.market_benchmarks.items.find(i => i.item_id === r)
            return <Pill key={r}>{r}{it ? `: ${it.metric} ${it.value}${it.unit} (${it.year})` : ''}</Pill>
          })}</div>
          {k === 'infra' && (a.infra_drivers as any[]).map((d, i) => <div key={i} className="mt-2 text-[12px]">{d.description}</div>)}
        </Section>
      </div>
    )
  }

  // --- Metric ----------------------------------------------------------------------------
  const { rec, label } = resolveMetric(a, sel.bridgeComponent === 'start' ? { year: 2026, metric: 'TS' } : sel.bridgeComponent === 'end' ? { year: 2031, metric: 'TS' } : sel, scen, addr)
  if (!rec) return <div className="text-ink3">데이터 포인트를 선택하세요.</div>
  const evIds = new Set<string>([...rec.evidence_ids, ...rec.inputs.flatMap(i => i.evidence_ids ?? [])])
  if (sel.metric === 'TS' || sel.bridgeComponent) a.anchor.evidence_ids.forEach(e => evIds.add(e))
  const evs = [...evIds].map(id => evById.get(id)).filter(Boolean) as Evidence[]
  const metricIssues = a.issues.filter(i => !i.metric || i.metric === (sel.metric === 'REV' ? (sel.year === 2026 ? 'CR' : 'TARGET') : sel.metric))
  const isEstimate = rec.status !== 'VERIFIED'
  return (
    <div>
      <div className="kicker">{a.original_name} · {label}</div>
      <h3 className="text-[15px] font-semibold text-ink2 mt-0.5"><TermTip code={termCode(sel)}>{METRIC_LABEL[sel.metric === 'REV' ? (sel.year === 2026 ? 'CR' : 'TARGET') : sel.metric]}</TermTip></h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="num text-[28px] font-bold leading-none">{rec.value === null ? <span className="text-[18px]">{missingText(a, sel)}</span> : fmtRec(rec)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2"><StatusBadge status={rec.status} /><GradeBadge grade={rec.grade ?? (rec.value === null ? naInfo(a, sel)?.class : naInfo(a, sel)?.class === 'INTERNAL_REQUIRED' ? 'INTERNAL_REQUIRED' : null)} /><ConfidenceMeter value={rec.confidence} /></div>
      {naInfo(a, sel) && (rec.value === null || naInfo(a, sel)?.class === 'INTERNAL_REQUIRED') && <div className="mt-2 rounded border border-line bg-sunk p-2 text-[12px]"><b>{NA_KO[naInfo(a, sel)!.class] ?? naInfo(a, sel)!.class}</b> — {naInfo(a, sel)!.reason}</div>}

      <Section n={1} title="수치 및 단위">
        <div className="num">{rec.value === null ? '값 없음 — ' + (rec.notes[0] ?? '근거 부족') : `${rec.unit === '%' ? pct(rec.value, 2) : `${rec.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} 억원 (KRW)`}`}</div>
        {rec.low !== null && rec.high !== null && <div className="num text-ink2">불확실성 범위: {eok(rec.low, 'ESTIMATED', { approx: false })} ~ {eok(rec.high, 'ESTIMATED', { approx: false })}</div>}
      </Section>
      <Section n={2} title="원천값 (입력)">
        {rec.inputs.length === 0 ? <span className="text-ink3">직접 입력 없음(상위 지표에서 파생)</span> :
          <ul className="space-y-1">{rec.inputs.map((i, k) => (
            <li key={k} className="num">{i.name}: <b>{i.value === null || i.value === undefined ? 'N/A' : i.unit === 'ratio' ? pct(Number(i.value), 2) : `${Number(i.value).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${i.unit ?? ''}`}</b>
              {i.fiscal_year ? ` · FY${i.fiscal_year}` : ''}{i.scope ? ` · ${i.scope}` : ''}{i.fact_status ? <span className="ml-1"><Pill tone={i.fact_status === 'VERIFIED' ? 'ok' : 'warn'}>{i.fact_status}</Pill></span> : null}
              {i.assumption_id && <span className="ml-1"><Pill>{i.assumption_id}</Pill></span>}</li>))}</ul>}
      </Section>
      <Section n={3} title="추정값 여부">{isEstimate ? `${rec.status} (${STATUS_LABEL[rec.status]}) — 원천에서 직접 확인된 값이 아닙니다.` : '원천 직접 확인값(VERIFIED)'}</Section>
      <Section n={4} title="계산 공식"><code className="block whitespace-pre-wrap text-[12px] bg-sunk rounded p-2">{rec.formula}</code></Section>
      <Section n={5} title="주요 가정">
        {rec.assumption_ids.length === 0 ? <span className="text-ink3">없음</span> :
          <ul className="space-y-1">{rec.assumption_ids.map(id => <li key={id}><Pill>{id}</Pill> <span className="text-[12px] text-ink2">{assumptionText(data, id)}</span></li>)}</ul>}
        {rec.notes.length > 0 && <ul className="list-disc pl-4 mt-1 text-[12px] text-ink2">{rec.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      </Section>
      <Section n={6} title={`출처 문서 · 링크 · 발행일 · 원문 구간 (${evs.length}건)`}>
        {evs.length === 0 ? <div className="text-ink3">직접 연결된 출처 없음 — {rec.status === 'UNKNOWN' ? '근거 없음' : '가정 기반 산출(추가 검증 필요)'}</div> : evs.map(e => <EvidenceCard key={e.evidence_id} e={e} />)}
      </Section>
      <Section n={7} title="신뢰수준">
        <ConfidenceMeter value={rec.confidence} width={120} />
        {(sel.metric === 'TS' && sel.year === 2026) && <div className="text-[12px] text-ink2 mt-1 num">구성: {Object.entries(a.conf_parts).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>}
        <div className="text-[11px] text-ink3 mt-1">분석 품질 평가 점수(0–100)이며 통계적 확률이 아닙니다.</div>
      </Section>
      {(sel.metric === 'TS' || sel.bridgeComponent) && (a.anchor.alternatives?.length || a.conflicts?.length || a.estimation_inputs?.length || a.comparables?.length) ? (
        <Section n={8} title="교차검증 · 대안 추정 · 근거 충돌">
          {a.anchor.alternatives?.length ? <div className="mb-1"><div className="text-ink3 text-[11px]">채택하지 않은 대안 앵커</div>{a.anchor.alternatives.map((x, i) => <div key={i} className="num text-[12px]">{x.method} FY{x.fiscal_year}: {eok(Number(x.value), 'ESTIMATED')}</div>)}</div> : null}
          {a.anchor.coverage_basis && <div className="text-[12px] text-ink2 mb-1">포괄률 근거: {a.anchor.coverage_basis}</div>}
          {a.anchor.note && <div className="text-[12px] text-ink2 mb-1">비고: {a.anchor.note}</div>}
          {a.conflicts?.length ? <div className="mb-1"><div className="text-ink3 text-[11px]">근거 충돌 기록 ({a.conflicts.length})</div><ul className="list-disc pl-4 text-[12px]">{a.conflicts.slice(0, 5).map((c, i) => <li key={i}><span className="num">{String(c.existing_value ?? '')} → {String(c.new_value ?? '')} {c.unit ?? ''}</span> {c.explanation?.slice(0, 160)}</li>)}</ul></div> : null}
          {a.estimation_inputs?.length ? <div><div className="text-ink3 text-[11px]">모델 입력(간접 근거)</div><ul className="list-disc pl-4 text-[12px]">{a.estimation_inputs.slice(0, 5).map((e, i) => <li key={i}>{e.name}: <span className="num">{String(e.value)} {e.unit}</span>{e.basis ? ` — ${String(e.basis).slice(0, 100)}` : ''}</li>)}</ul></div> : null}
        </Section>) : null}
      <Section n={9} title="불확실성 및 추가 확인 필요사항">
        <ul className="list-disc pl-4 space-y-0.5">
          {metricIssues.filter(i => i.severity !== 'INFO' || ['SOURCE_NOT_OPENED', 'CR_NULL', 'TARGET_SCENARIO', 'SOW_COMPARE_NA', 'CORRECTION_APPLIED'].includes(i.code)).slice(0, 8).map((i, k) =>
            <li key={k}><span style={{ color: i.severity === 'ERROR' ? 'var(--err)' : i.severity === 'WARN' ? 'var(--warn)' : 'var(--ink-3)' }}>[{i.severity}]</span> {i.message}</li>)}
          {a.open_questions.slice(0, 4).map((q, k) => <li key={`q${k}`} className="text-ink2">{q}</li>)}
        </ul>
      </Section>
    </div>
  )
}
