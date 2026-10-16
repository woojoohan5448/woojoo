import type { Dashboard } from '../types'
import { Pill } from '../components/badges'
import { CAT_LABEL, pct } from '../lib/format'

export default function MethodologyView({ data }: { data: Dashboard }) {
  const p = data.params
  const cats = Object.keys(CAT_LABEL)
  return (
    <div className="space-y-4 p-4 text-[13px]">
      <section className="card p-4">
        <h2 className="text-[18px] font-bold">Methodology &amp; Assumptions</h2>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-ink2">
          <li><b>TS</b> = 고객 법인(별도)의 연간 IT/ICT 비용(KISA 정보기술부문 투자액 정의 준용: 감가상각+인건비+외주·유지보수 등, CAPEX 신규취득과 중복 금지).</li>
          <li><b>RAW</b> = Σ(TS_i × Addressability_i), <b>FPR</b> = Σ(RAW_i × Capture_Ceiling_i). 불변식 0 ≤ FPR ≤ RAW ≤ TS 자동 검증.</li>
          <li><b>CR</b>은 사내 데이터만 사용(미입력=NULL). C-SOW=CR/RAW, PCR=CR/FPR, Upside=FPR−CR.</li>
          <li><b>2031</b>: TS_2026 + Organic + Cloud + AI + Infra + Regulatory − Efficiency − Substitution (Low/Base/High).</li>
          <li><b>Target 2031</b>: 경영진 입력, 없으면 FPR_2031×{p.target_rule.attainment_of_fpr_2031} 시나리오(의사결정 필요).</li>
          <li>상태 5종: VERIFIED · DERIVED · ESTIMATED · SCENARIO · UNKNOWN. 추정치는 유효숫자 2자리·'≈'로 표시해 과도한 정밀성을 피함.</li>
        </ol>
        <p className="mt-2 text-[12px] text-ink3">상세: docs/METHODOLOGY.md · DATA_DICTIONARY.md · RESEARCH_PROTOCOL.md</p>
      </section>
      <section className="card p-4 overflow-x-auto">
        <h3 className="text-[15px] font-bold">C-ADDR 접근률 · C-CAP 포획 상한 (기본값)</h3>
        <table className="mt-2 w-full min-w-[640px] num text-[12px]">
          <thead><tr className="text-left text-ink3"><th className="py-1">카테고리</th><th>ADDR 2026</th><th>ADDR 2031 Base</th><th>ADDR 2031 Expansion</th><th>CAP 2026</th><th>CAP 2031</th></tr></thead>
          <tbody>{cats.map(c => <tr key={c} className="border-t border-line"><td className="py-1">{CAT_LABEL[c]}</td><td>{pct(p.addressability['2026'][c], 0)}</td><td>{pct(p.addressability['2031_base'][c], 0)}</td><td>{pct(p.addressability['2031_expansion'][c], 0)}</td><td>{pct(p.capture_ceiling['2026'][c], 0)}</td><td>{pct(p.capture_ceiling['2031'][c], 0)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="card p-4 overflow-x-auto">
        <h3 className="text-[15px] font-bold">IT 집약도 보정 (B-INT)</h3>
        <table className="mt-2 w-full min-w-[560px] num text-[12px]">
          <thead><tr className="text-left text-ink3"><th className="py-1">산업군</th><th>방식</th><th>분모</th><th>n</th><th>Low</th><th>Base</th><th>High</th><th>관측</th></tr></thead>
          <tbody>{Object.entries(data.intensity_calibration).filter(([k]) => !k.startsWith('_')).map(([k, v]) => <tr key={k} className="border-t border-line"><td className="py-1">{k}</td><td><Pill tone={v.basis === 'EMPIRICAL' ? 'ok' : 'warn'}>{v.basis}</Pill></td><td>{(v as any).denominator}</td><td>{v.n}</td><td>{pct(v.low, 2)}</td><td>{pct(v.base, 2)}</td><td>{pct(v.high, 2)}</td><td className="text-ink3">{v.observations.map(o => `${o.account_id} ${pct(o.ratio, 1)}`).join(', ')}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="card p-4">
        <h3 className="text-[15px] font-bold">파라미터 근거 맵</h3>
        <ul className="mt-2 space-y-1.5">{Object.entries(data.parameter_evidence).filter(([k]) => !k.startsWith('_')).map(([k, v]) => <li key={k}><Pill>{k}</Pill> <Pill tone={v.basis === 'ANALYST_JUDGMENT' ? 'warn' : 'ok'}>{v.basis}</Pill> <span className="text-ink2">{v.comment}</span> {v.refs.length > 0 && <span className="text-ink3">[{v.refs.join(', ')}]</span>}</li>)}</ul>
      </section>
      <section className="card p-4 overflow-x-auto">
        <h3 className="text-[15px] font-bold">시장 벤치마크 (Tier 2/3)</h3>
        <table className="mt-2 w-full min-w-[640px] text-[12px]">
          <thead><tr className="text-left text-ink3"><th className="py-1">ID</th><th>주제</th><th>지표</th><th className="text-right">값</th><th>연도</th><th>출처</th></tr></thead>
          <tbody>{data.market_benchmarks.items.map(i => { const ev = data.market_benchmarks.evidence.find(e => e.evidence_id === i.evidence_id); return (
            <tr key={i.item_id} className="border-t border-line"><td className="py-1 font-mono">{i.item_id}</td><td>{i.topic}</td><td>{i.metric}</td><td className="num text-right">{String(i.value)} {i.unit}</td><td>{i.year}</td>
              <td>{ev ? <a href={ev.source_url} target="_blank" rel="noreferrer" className="underline">{ev.publisher}</a> : ''}{ev && ev.verification_status !== 'VERIFIED' ? <span className="text-ink3"> (원문 미열람)</span> : ''}</td></tr>) })}</tbody>
        </table>
      </section>
    </div>
  )
}
