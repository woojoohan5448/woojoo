import { Fragment, useMemo, useState } from 'react'
import type { Account, AddrCase, Dashboard, MetricKey, Scenario, Selection } from '../types'
import EChart from '../components/EChart'
import Inspector from '../components/Inspector'
import { bridgeOption, categoryOption, opportunityOption, rowLabel, type Palette } from '../components/charts'
import { ConfidenceMeter, Pill, StatusBadge, Swatch } from '../components/badges'
import { RESEARCH_STATUS_LABEL, SEGMENT_LABEL, eok, fmtRec, pct, signedEok } from '../lib/format'
import { resolveMetric } from '../lib/data'
import ProductRevenueDrilldown from '../extensions/ProductRevenueDrilldown'

interface Props {
  data: Dashboard; account: Account; scen: Scenario; setScen: (s: Scenario) => void; addr: AddrCase; setAddr: (a: AddrCase) => void
  sel: Selection; setSel: (s: Selection) => void; palette: Palette; themeKey: string; onSelectAccount: (id: string) => void
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-panel p-0.5">
      {options.map(o => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`rounded px-2.5 py-1 text-[12px] font-semibold ${value === o.v ? 'bg-ink text-surface' : 'text-ink2 hover:text-ink'}`}>{o.l}</button>
      ))}
    </div>
  )
}

export default function AccountView({ data, account: a, scen, setScen, addr, setAddr, sel, setSel, palette, themeKey, onSelectAccount }: Props) {
  const [log, setLog] = useState(false)
  const [catYear, setCatYear] = useState<2026 | 2031>(2026)
  const [showTable, setShowTable] = useState(false)
  const opt = useMemo(() => opportunityOption(a, scen, addr, sel, palette, log), [a, scen, addr, sel, palette, log])
  const catOpt = useMemo(() => categoryOption(a, catYear, scen, addr, sel, palette), [a, catYear, scen, addr, sel, palette])
  const brOpt = useMemo(() => bridgeOption(a, scen, sel, palette), [a, scen, sel, palette])
  const m26 = a.m['2026'], b = a.m['2031'][scen]
  const raw31 = addr === 'base' ? b.RAW_base : b.RAW_expansion
  const fpr31 = addr === 'base' ? b.FPR_base : b.FPR_expansion
  const hasModel = m26.TS.value !== null || m26.RAW.value !== null

  const delta = (x: number | null, y: number | null) => (x === null || y === null ? null : y - x)
  const ROWS: MetricKey[] = ['TS', 'RAW', 'FPR', 'REV']

  return (
    <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        {/* Account header */}
        <section className="card p-4">
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
                {a.aggregate_class !== 'COMPARABLE' && <Pill tone="warn">{a.aggregate_class === 'OVERLAP_RISK' ? `중복 위험: ${a.overlap_groups.join(', ')}` : a.aggregate_class === 'DEFINITION_MISMATCH' ? '정의 상이 — 합계 제외' : '합계 제외(미확인)'}</Pill>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Seg label="시나리오" value={scen} onChange={setScen} options={[{ v: 'low', l: 'Low' }, { v: 'base', l: 'Base' }, { v: 'high', l: 'High' }]} />
              <Seg label="2031 접근성 케이스" value={addr} onChange={setAddr} options={[{ v: 'base', l: 'Base Case' }, { v: 'expansion', l: 'Strategic Expansion' }]} />
            </div>
          </div>
        </section>

        {/* Main opportunity graph */}
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[15px] font-bold">2026 vs 2031 Opportunity Structure</h3>
              <p className="text-[12px] text-ink3">동일 금액 축 · 옅은 막대 = 상위 지표(포함 관계) · 수염 = 2026 추정 범위 / 2031 Low~High 시나리오 · 빗금 = 시나리오 값 · 막대 클릭 → 근거 패널</p>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-ink2">
              {(['TS', 'RAW', 'FPR', 'REV'] as MetricKey[]).map(m => <span key={m} className="inline-flex items-center gap-1"><Swatch color={({ TS: 'var(--c-ts)', RAW: 'var(--c-raw)', FPR: 'var(--c-fpr)', REV: 'var(--c-rev)' })[m]} />{m === 'REV' ? 'CR/Target' : m}</span>)}
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={log} onChange={e => setLog(e.target.checked)} />로그 축</label>
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showTable} onChange={e => setShowTable(e.target.checked)} />표 보기</label>
            </div>
          </div>
          {!hasModel && <div className="mt-3 rounded-md border border-dashed border-line p-3 text-[13px] text-ink2">이 고객은 신뢰할 만한 IT 지출 근거·추정 기준이 부족하여 TS/RAW/FPR이 <b>미확인(UNKNOWN)</b>입니다. 0으로 표시하지 않습니다. 아래 '추가 확인 필요사항'과 Data Quality 탭을 참고하세요.</div>}
          <EChart option={opt} height={300} ariaLabel={`${a.original_name} 2026·2031 TS, RAW, FPR, 매출 비교 막대그래프`} themeKey={themeKey}
            onClick={(p) => { if (p.data?.metric) setSel({ year: p.data.year, metric: p.data.metric }) }} />
          {showTable && (
            <table className="mt-2 w-full text-[12.5px] num">
              <thead><tr className="text-left text-ink3"><th className="py-1">지표</th><th>2026</th><th>상태</th><th>2031 ({scen}/{addr})</th><th>상태</th></tr></thead>
              <tbody>{ROWS.map(m => {
                const r26 = resolveMetric(a, { year: 2026, metric: m }, scen, addr).rec, r31 = resolveMetric(a, { year: 2031, metric: m }, scen, addr).rec
                return <tr key={m} className="border-t border-line"><td className="py-1">{rowLabel(m, 2026).split('  ')[0]}/{rowLabel(m, 2031).split('  ')[0]}</td><td>{fmtRec(r26)}</td><td>{r26 && <StatusBadge status={r26.status} compact />}</td><td>{fmtRec(r31)}</td><td>{r31 && <StatusBadge status={r31.status} compact />}</td></tr>
              })}</tbody>
            </table>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: 'CSOW' as const, y: 2026 as const, l: 'C-SOW 2026', r: m26.CSOW },
              { k: 'PCR' as const, y: 2026 as const, l: 'Potential Capture Rate', r: m26.PCR },
              { k: 'UPSIDE' as const, y: 2026 as const, l: 'Upside 2026', r: m26.UPSIDE },
              { k: 'TARGET_SOW' as const, y: 2031 as const, l: 'Target SOW 2031', r: a.m.target.TARGET_SOW },
            ].map(x => (
              <button key={x.l} onClick={() => setSel({ year: x.y, metric: x.k })}
                className={`rounded-md border p-2 text-left ${sel.metric === x.k ? 'border-ink' : 'border-line'} bg-sunk`}>
                <div className="kicker">{x.l}</div>
                <div className="num text-[15px] font-bold">{fmtRec(x.r)}</div>
                <div className="text-[10.5px] text-ink3">{x.r.value === null ? (m26.CR.value === null && x.k !== 'TARGET_SOW' ? 'CR 미입력 → N/A' : x.r.status === 'UNKNOWN' ? '산출 불가' : '') : x.r.status}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 2026-2031 comparison */}
        <section className="card p-4">
          <h3 className="text-[15px] font-bold">2026 → 2031 Comparison <span className="text-[12px] font-normal text-ink3">({scen.toUpperCase()} · {addr === 'base' ? 'Base Case' : 'Strategic Expansion'})</span></h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px] num">
              <thead><tr className="text-left text-ink3"><th className="py-1">지표</th><th>2026</th><th>2031</th><th>증감</th><th>CAGR</th><th>신뢰도 26→31</th></tr></thead>
              <tbody>
                {[
                  { l: 'TS (Wallet 전체)', a: m26.TS, b: b.TS, c: b.TS_CAGR, k: 'TS_CAGR' as const },
                  { l: 'RAW (Wallet Expansion)', a: m26.RAW, b: raw31, c: b.RAW_CAGR, k: 'RAW_CAGR' as const },
                  { l: 'FPR (Capture Opportunity)', a: m26.FPR, b: fpr31, c: b.FPR_CAGR, k: 'FPR_CAGR' as const },
                ].map(r => (
                  <tr key={r.l} className="border-t border-line">
                    <td className="py-1.5 font-semibold">{r.l}</td><td>{fmtRec(r.a)}</td><td>{fmtRec(r.b)}</td>
                    <td>{signedEok(delta(r.a.value, r.b.value))}</td>
                    <td><button className="underline decoration-dotted" onClick={() => setSel({ year: 2031, metric: r.k })}>{pct(r.c.value)}</button></td>
                    <td><span className="text-ink2">{r.a.confidence} → {r.b.confidence}</span></td>
                  </tr>
                ))}
                <tr className="border-t border-line"><td className="py-1.5 font-semibold">CR → Target</td><td>{fmtRec(m26.CR)}</td><td>{fmtRec(a.m.target.TARGET)}</td><td>{signedEok(a.m.target.TARGET_INCREMENT.value)}</td><td>—</td><td className="text-ink2">{a.m.target.TARGET.status}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-ink2"><b>주요 변화 원인:</b> {String(a.narrative.ts_2031_drivers ?? 'N/A')}</p>
          {a.narrative.raw_2031_drivers && <p className="text-[12px] text-ink2">{String(a.narrative.raw_2031_drivers)}</p>}
          <p className="text-[11px] text-ink3 mt-1">시장 성장률(벤치마크), 고객 IT 지출 성장률(TS CAGR), LG U+ 매출 성장률(FPR/Target)은 서로 다른 개념입니다.</p>
        </section>

        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
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
        </div>

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
          {(a.drivers.length > 0 || a.competitive.length > 0) && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div><div className="kicker mb-1">성장 동인 (공개 발표)</div><ul className="space-y-1 text-[12.5px]">{a.drivers.map(d => <li key={d.driver_id}><Pill>{d.type}</Pill> {d.description}{d.amount ? ` (${d.amount.toLocaleString?.('ko-KR') ?? d.amount} ${d.unit ?? ''}, ${d.period ?? ''})` : ''}</li>)}</ul></div>
              <div><div className="kicker mb-1">경쟁·조달 구조</div><ul className="space-y-1 text-[12.5px]">{a.competitive.map((c, i) => <li key={i}><Pill>{c.category}</Pill> {c.observation}{c.lgu_relationship ? <span className="text-brand"> · LG U+: {c.lgu_relationship}</span> : ''}</li>)}</ul></div>
            </div>
          )}
          <details className="mt-3 text-[12px]"><summary className="cursor-pointer text-ink2">조사 로그 ({a.research_log.length})</summary>
            <ul className="mt-1 space-y-0.5 text-ink3">{a.research_log.map((l, i) => <li key={i}>[{l.result}] {l.step} — {l.target} {l.detail ? `· ${l.detail}` : ''}</li>)}</ul></details>
        </section>

        <ProductRevenueDrilldown account={a} />
      </div>

      {/* Evidence inspector */}
      <aside className="card h-fit p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-150px)] xl:overflow-y-auto scroll-thin" aria-label="근거 및 계산 패널">
        <div className="mb-2 flex items-center justify-between"><div className="kicker">Evidence &amp; Calculation Inspector</div>
          <ConfidenceMeter value={m26.TS.confidence} /></div>
        <Inspector data={data} account={a} sel={sel} scen={scen} addr={addr} />
        <div className="mt-4 border-t border-line pt-2 text-[11px] text-ink3">TS 2026 {eok(m26.TS.value, m26.TS.status)} · 선택 유지: {sel.year} / {sel.metric}{sel.category ? ` / ${sel.category}` : ''}</div>
      </aside>
    </div>
  )
}
