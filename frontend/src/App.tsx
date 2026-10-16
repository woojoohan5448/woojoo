import { useEffect, useMemo, useState } from 'react'
import type { AddrCase, Dashboard, Scenario, Selection } from './types'
import { BUNDLED, cssVar, loadDashboard, setScenarioTargetVisible } from './lib/data'
import type { Palette } from './components/charts'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Onboarding from './components/Onboarding'
import OverviewView from './views/OverviewView'
import AccountView from './views/AccountView'
import PortfolioView from './views/PortfolioView'
import StrategyView from './views/StrategyView'
import QualityView from './views/QualityView'
import AdminView from './views/AdminView'
import MethodologyView from './views/MethodologyView'

/* vNext IA (correction): analysis flow AS-IS (Account Intelligence) → TO-BE (Strategic Intelligence).
   AS-IS/TO-BE are analysis stages, not past/future data (AS-IS screens include 2031 forecasts).
   Internal tab ids are unchanged so existing state/links keep working. */
type Tab = 'overview' | 'account' | 'portfolio' | 'strategy' | 'quality' | 'admin' | 'method'
const GROUPS: { stage: string; title: string; tabs: { id: Tab; no: string; label: string; sub: string }[] }[] = [
  { stage: 'AS-IS', title: 'Account Intelligence', tabs: [
    { id: 'account', no: '①', label: '고객별 사업기회', sub: 'Account Opportunity' },
    { id: 'portfolio', no: '②', label: '전사 기회 분석', sub: 'Opportunity Portfolio' }] },
  { stage: 'TO-BE', title: 'Strategic Intelligence', tabs: [
    { id: 'strategy', no: '③', label: '전략과제 도출', sub: 'Strategic Initiatives' },
    { id: 'overview', no: '④', label: '전략적 시사점', sub: 'Strategic Implications' }] },
]
export const PURPOSE: Partial<Record<Tab, string>> = {
  account: '53개 핵심 고객의 전체 IT 지출에서 LGU+가 확보할 수 있는 매출 잠재력까지 분석합니다.',
  portfolio: '53개 고객의 사업기회를 통합하여 성장 기회가 집중된 산업과 사업영역을 파악합니다.',
  strategy: '고객 수요와 LGU+ 사업역량을 비교하여 우선 준비해야 할 사업과 역량을 도출합니다.',
  overview: '분석 결과를 종합하여 사업화·투자·제휴의 우선순위와 의사결정 과제를 정리합니다.',
}
const OPS: { id: Tab; label: string }[] = [
  { id: 'quality', label: '데이터 신뢰도' }, { id: 'method', label: '분석 기준·산식' }, { id: 'admin', label: '관리자 입력 · Excel Import' },
]
const isOps = (t: Tab) => OPS.some(o => o.id === t)

function readPalette(): Palette {
  return { ts: cssVar('--c-ts'), raw: cssVar('--c-raw'), fpr: cssVar('--c-fpr'), rev: cssVar('--c-rev'), ink1: cssVar('--ink-1'), ink2: cssVar('--ink-2'),
    ink3: cssVar('--ink-3'), line: cssVar('--line'), surface: cssVar('--surface-1'), sunk: cssVar('--surface-2') }
}

function store<T>(k: string, v?: T): T | null {
  try { if (v !== undefined) localStorage.setItem(k, JSON.stringify(v)); const r = localStorage.getItem(k); return r ? JSON.parse(r) : null } catch { return null }
}

export default function App() {
  const [data, setData] = useState<Dashboard>(BUNDLED)
  const [mode, setMode] = useState<'api' | 'static'>('static')
  const [tab, setTab] = useState<Tab>((store<Tab>('tab') as Tab) || 'account')
  const [accountId, setAccountId] = useState<string>(store<string>('acc') || 'KA03')
  const [scen, setScen] = useState<Scenario>('base')
  const [addr, setAddr] = useState<AddrCase>('base')
  const [sel, setSel] = useState<Selection>({ year: 2026, metric: 'TS' })
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>((store<'light' | 'dark' | 'system'>('theme')) || 'system')
  const [palette, setPalette] = useState<Palette>(readPalette)
  const [showTgt, setShowTgt] = useState(false)  // D1: scenario target only on explicit toggle (not persisted)
  const [onboard, setOnboard] = useState<boolean>(!store<boolean>('onboarded'))
  setScenarioTargetVisible(showTgt)

  useEffect(() => { loadDashboard().then(r => { setData(r.data); setMode(r.mode) }) }, [])
  useEffect(() => { store('tab', tab) }, [tab])
  useEffect(() => { store('acc', accountId) }, [accountId])
  useEffect(() => {
    store('theme', theme)
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme)
    setPalette(readPalette())
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const h = () => setPalette(readPalette())
    mq?.addEventListener?.('change', h)
    return () => mq?.removeEventListener?.('change', h)
  }, [theme])

  const account = useMemo(() => data.accounts.find(a => a.account_id === accountId) ?? data.accounts[0], [data, accountId])
  const selectAccount = (id: string) => { setAccountId(id); setTab('account') }
  const closeOnboarding = () => { setOnboard(false); store('onboarded', true) }
  const btn = (active: boolean) => `whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold border-b-2 ${active ? 'border-brand text-ink' : 'border-transparent text-ink3 hover:text-ink'}`

  return (
    <div className="flex h-full flex-col">
      <Header data={data} mode={mode} theme={theme} setTheme={setTheme} compact={tab !== 'portfolio'}
        showTgt={showTgt} setShowTgt={setShowTgt} onGuide={() => setOnboard(true)} />
      <nav className="flex items-stretch gap-0 overflow-x-auto border-b border-line bg-panel px-2" aria-label="분석 단계">
        {GROUPS.map((g, gi) => (
          <div key={g.stage} className={`flex flex-col ${gi > 0 ? 'ml-1 border-l border-line pl-1' : ''}`} role="group" aria-label={`${g.stage} · ${g.title}`}>
            <div className="px-3 pt-1.5 text-[10.5px] font-bold tracking-[.08em] whitespace-nowrap" style={{ color: g.stage === 'AS-IS' ? 'var(--c-ts)' : 'var(--brand)' }}>
              {g.stage} · {g.title}{gi === 0 && <span className="ml-1 font-normal text-ink3">→</span>}
            </div>
            <div className="flex">
              {g.tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={btn(tab === t.id)} title={t.sub}>
                  <span className="mr-1 text-ink3">{t.no}</span>{t.label}
                </button>))}
            </div>
          </div>))}
        <div className="ml-auto flex flex-col border-l border-line pl-1" role="group" aria-label="지원">
          <div className="px-3 pt-1.5 text-[10.5px] font-bold tracking-[.08em] text-ink3 whitespace-nowrap">지원</div>
          <button onClick={() => setTab(isOps(tab) ? tab : 'quality')} aria-current={isOps(tab) ? 'page' : undefined} className={btn(isOps(tab))}>
            <span className="mr-1 text-ink3">⑤</span>데이터·운영 관리
          </button>
        </div>
      </nav>
      {isOps(tab) && (
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-sunk px-4" aria-label="데이터·운영 관리 하위 메뉴">
          {OPS.map(t => <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`whitespace-nowrap px-3 py-1.5 text-[12.5px] font-semibold ${tab === t.id ? 'text-ink underline underline-offset-4' : 'text-ink3 hover:text-ink'}`}>{t.label}</button>)}
        </nav>
      )}
      <div className="flex min-h-0 flex-1">
        {(tab === 'account') && <Sidebar data={data} selected={account.account_id} onSelect={selectAccount} />}
        <main className="min-w-0 flex-1 overflow-y-auto scroll-thin">
          {PURPOSE[tab] && <p className="px-4 pt-3 text-[12.5px] text-ink2" data-testid="tab-purpose"><b className="mr-1.5 text-ink">{GROUPS.flatMap(g => g.tabs).find(t => t.id === tab)?.no} {GROUPS.flatMap(g => g.tabs).find(t => t.id === tab)?.label}</b>{PURPOSE[tab]}</p>}
          {tab === 'overview' && <OverviewView data={data} onNavigate={setTab} onSelect={selectAccount} />}
          {tab === 'account' && <AccountView data={data} account={account} scen={scen} setScen={setScen} addr={addr} setAddr={setAddr} sel={sel} setSel={setSel} palette={palette} themeKey={theme} onSelectAccount={setAccountId} showTgt={showTgt} />}
          {tab === 'portfolio' && <PortfolioView data={data} palette={palette} onSelect={selectAccount} themeKey={theme} />}
          {tab === 'strategy' && <StrategyView data={data} palette={palette} onSelect={selectAccount} themeKey={theme} />}
          {tab === 'quality' && <QualityView data={data} onSelect={selectAccount} />}
          {tab === 'admin' && <AdminView data={data} mode={mode} onSaved={() => loadDashboard().then(r => { setData(r.data); setMode(r.mode) })} />}
          {tab === 'method' && <MethodologyView data={data} />}
        </main>
      </div>
      <Onboarding open={onboard} onClose={closeOnboarding} />
    </div>
  )
}
