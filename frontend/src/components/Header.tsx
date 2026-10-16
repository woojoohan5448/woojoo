import type { Dashboard } from '../types'
import { eok } from '../lib/format'

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="min-w-[118px] px-3 py-1.5 border-l border-line first:border-l-0">
      <div className="kicker flex items-center gap-1">{accent && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: accent }} />}{label}</div>
      <div className="num text-[17px] font-bold leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10.5px] text-ink3 leading-tight">{sub}</div>}
    </div>
  )
}

export default function Header({ data, mode, theme, setTheme }: { data: Dashboard; mode: 'api' | 'static'; theme: string; setTheme: (t: 'light' | 'dark' | 'system') => void }) {
  const agg = data.portfolio.aggregate
  const a26 = agg['2026_base'], a31 = agg['2031_base']
  const n = data.meta.n_accounts
  const verified = (data.meta.status_counts['EVIDENCE_VERIFIED'] ?? 0) + (data.meta.status_counts['QUALITY_APPROVED'] ?? 0)
  const cov = (k: number) => `${k}/${n}개사 부분합`
  const tgtN = data.accounts.filter(a => a.m.target.TARGET.value !== null && a.aggregate_class !== 'DEFINITION_MISMATCH').length
  const tgtScenario = data.accounts.every(a => a.m.target.TARGET.status !== 'VERIFIED')
  return (
    <header className="bg-panel border-b border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div>
          <div className="text-[11px] font-bold tracking-[.12em] text-brand">LG U+ ENTERPRISE STRATEGIC INTELLIGENCE</div>
          <h1 className="text-[19px] font-bold leading-tight">2026–2031 Key Account Opportunity Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink3">
          <span title="데이터 버전">v{data.meta.data_version}</span>
          <span className="rounded border border-line px-1.5 py-0.5">{mode === 'api' ? 'API 모드(실시간)' : '정적 빌드'}</span>
          {data.meta.is_test_data && <span className="rounded px-1.5 py-0.5 font-bold" style={{ color: 'var(--err)', border: '1px solid var(--err)' }}>테스트 데이터</span>}
          <select aria-label="테마" value={theme} onChange={e => setTheme(e.target.value as any)} className="rounded border border-line bg-panel px-1.5 py-0.5 text-ink2">
            <option value="system">시스템</option><option value="light">라이트</option><option value="dark">다크</option>
          </select>
        </div>
      </div>
      <div className="flex overflow-x-auto px-1 py-2 scroll-thin">
        <Kpi label="분석 고객" value={`${n}`} sub={`근거검증 ${verified} · 추정 ${data.meta.status_counts['MODEL_ESTIMATED'] ?? 0}`} />
        <Kpi label="2026 TS" value={eok(a26.TS, 'ESTIMATED')} sub={cov(a26.n_ts)} accent="var(--c-ts)" />
        <Kpi label="2026 RAW" value={eok(a26.RAW, 'ESTIMATED')} sub={cov(a26.n_raw)} accent="var(--c-raw)" />
        <Kpi label="2026 FPR" value={eok(a26.FPR, 'ESTIMATED')} sub={cov(a26.n_fpr)} accent="var(--c-fpr)" />
        <Kpi label="2031 TS" value={eok(a31.TS, 'ESTIMATED')} sub={cov(a31.n_ts)} accent="var(--c-ts)" />
        <Kpi label="2031 RAW" value={eok(a31.RAW, 'ESTIMATED')} sub={cov(a31.n_raw)} accent="var(--c-raw)" />
        <Kpi label="2031 FPR" value={eok(a31.FPR, 'ESTIMATED')} sub={cov(a31.n_fpr)} accent="var(--c-fpr)" />
        <Kpi label="2031 Target" value={eok(a31.TARGET, 'SCENARIO')} sub={`${tgtScenario ? '시나리오(경영진 미입력)' : ''} · ${tgtN}개사`} accent="var(--c-rev)" />
        <Kpi label="합산 제외" value={`${a26.n_mismatch + (n - a26.n_ts - a26.n_mismatch)}개사`} sub={`정의상이 ${a26.n_mismatch} · 미확인/비적용 ${n - a26.n_ts - a26.n_mismatch}`} />
        {data.meta.coverage && <Kpi label="외부 데이터 커버리지" value={`${(data.meta.coverage.current.external_coverage * 100).toFixed(1)}%`} sub={`RESEARCH GAP ${data.meta.coverage.current.external_missing} · 기준선 ${data.meta.coverage.baseline ? (data.meta.coverage.baseline.external_coverage * 100).toFixed(1) + '%' : '-'}`} />}
        {data.meta.contains_internal_data && <Kpi label="사내 데이터" value="포함" sub="외부 반출 금지" accent="var(--err)" />}
      </div>
    </header>
  )
}
