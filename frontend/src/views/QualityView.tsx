import { useMemo, useState } from 'react'
import type { Dashboard } from '../types'
import { Pill } from '../components/badges'
import { RESEARCH_STATUS_LABEL } from '../lib/format'

export default function QualityView({ data, onSelect }: { data: Dashboard; onSelect: (id: string) => void }) {
  const [sev, setSev] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO'>('WARN')
  const [code, setCode] = useState('ALL')
  const all = useMemo(() => data.accounts.flatMap(a => a.issues.map(i => ({ ...i, name: a.original_name }))), [data])
  const codes = [...new Set(all.map(i => i.code))].sort()
  const list = all.filter(i => (sev === 'ALL' || i.severity === sev) && (code === 'ALL' || i.code === code))
  const ms = data.meta.metric_status_2026
  return (
    <div className="space-y-4 p-4">
      <section className="card p-4">
        <h2 className="text-[18px] font-bold">Data Quality &amp; Research Coverage</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(data.issues_summary).map(([k, v]) => <div key={k} className="rounded-md bg-sunk p-2"><div className="kicker">{k}</div><div className="num text-[20px] font-bold" style={{ color: k === 'ERROR' ? 'var(--err)' : k === 'WARN' ? 'var(--warn)' : 'var(--ink-2)' }}>{v}</div></div>)}
          <div className="rounded-md bg-sunk p-2"><div className="kicker">원천 사실 검증</div><div className="text-[12px] num">{Object.entries(data.meta.fact_status).map(([k, v]) => `${k} ${v}`).join(' · ')}</div></div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><div className="kicker mb-1">조사 상태</div><div className="flex flex-wrap gap-1.5">{Object.entries(data.meta.status_counts).map(([k, v]) => <Pill key={k}>{RESEARCH_STATUS_LABEL[k] ?? k}: {v}</Pill>)}</div></div>
          <div><div className="kicker mb-1">2026 지표 상태 분포</div><div className="text-[12px] num space-y-0.5">{Object.entries(ms).map(([m, d]) => <div key={m}><b>{m}</b> {Object.entries(d).map(([s, n]) => `${s} ${n}`).join(' · ')}</div>)}</div></div>
        </div>
        {data.meta.coverage && (
          <div className="mt-3 overflow-x-auto"><div className="kicker mb-1">결측 상태 분류 (53개사 × 12개 지표)</div>
            <table className="w-full min-w-[560px] text-[12px] num"><thead><tr className="text-left text-ink3"><th className="py-1">분류</th><th>기준선(v1)</th><th>현재</th><th>의미</th></tr></thead>
              <tbody>{['ESTIMATED_HIGH', 'ESTIMATED_MEDIUM', 'ESTIMATED_LOW', 'INTERNAL_REQUIRED', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE', 'ERROR'].map(k => (
                <tr key={k} className="border-t border-line"><td className="py-1 font-mono">{k}</td><td>{data.meta.coverage!.baseline?.by_class?.[k] ?? 0}</td><td><b>{data.meta.coverage!.current.by_class[k] ?? 0}</b></td>
                  <td className="text-ink2">{{ ESTIMATED_HIGH: '직접 공시·보도 기반 추정', ESTIMATED_MEDIUM: '감사보고서 IT 비용 항목·자사 비율 기반', ESTIMATED_LOW: '벤치마크·비교기업·시나리오', INTERNAL_REQUIRED: 'INTERNAL INPUT REQUIRED (사내 매출·목표)', INSUFFICIENT_EVIDENCE: 'RESEARCH GAP', NOT_APPLICABLE: '지표 비적용', ERROR: 'VALIDATION ERROR' }[k]}</td></tr>))}</tbody></table>
            <p className="mt-1 text-[12px] text-ink2">외부 추정 가능 필드 커버리지 {(data.meta.coverage.baseline!.external_coverage * 100).toFixed(1)}% → <b>{(data.meta.coverage.current.external_coverage * 100).toFixed(1)}%</b> ({data.meta.coverage.current.external_covered}/{data.meta.coverage.current.external_fields})</p>
          </div>)}
        <p className="mt-2 text-[11.5px] text-ink3">값은 자동 수정되지 않으며, 산식 위반·계보 누락·정의 불일치는 아래 이슈로만 기록됩니다.</p>
      </section>
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={sev} onChange={e => setSev(e.target.value as any)} className="rounded border border-line bg-panel px-1.5 py-1 text-[12px]" aria-label="심각도"><option value="ALL">전체</option><option>ERROR</option><option>WARN</option><option>INFO</option></select>
          <select value={code} onChange={e => setCode(e.target.value)} className="rounded border border-line bg-panel px-1.5 py-1 text-[12px]" aria-label="이슈 코드"><option value="ALL">전체 코드</option>{codes.map(c => <option key={c}>{c}</option>)}</select>
          <span className="text-[12px] text-ink3">{list.length}건</span>
        </div>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[640px] text-[12px]">
          <thead><tr className="text-left text-ink3"><th className="py-1">고객</th><th>심각도</th><th>코드</th><th>지표</th><th>내용</th></tr></thead>
          <tbody>{list.slice(0, 400).map((i, k) => (
            <tr key={k} className="border-t border-line align-top"><td className="py-1"><button className="underline decoration-dotted" onClick={() => onSelect(i.account_id)}>{i.name}</button></td>
              <td><Pill tone={i.severity === 'ERROR' ? 'err' : i.severity === 'WARN' ? 'warn' : 'neutral'}>{i.severity}</Pill></td><td className="font-mono text-[11px]">{i.code}</td><td>{i.metric ?? ''}{i.year ? ` ${i.year}` : ''}{i.scenario ? ` ${i.scenario}` : ''}</td><td>{i.message}</td></tr>))}</tbody>
        </table></div>
      </section>
    </div>
  )
}
