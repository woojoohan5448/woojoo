import { useEffect, useMemo, useState } from 'react'
import type { AddrCase, Dashboard, Scenario, Selection } from './types'
import { BUNDLED, cssVar, loadDashboard } from './lib/data'
import type { Palette } from './components/charts'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import AccountView from './views/AccountView'
import PortfolioView from './views/PortfolioView'
import StrategyView from './views/StrategyView'
import QualityView from './views/QualityView'
import AdminView from './views/AdminView'
import MethodologyView from './views/MethodologyView'

type Tab = 'account' | 'portfolio' | 'strategy' | 'quality' | 'admin' | 'method'
const TABS: { id: Tab; label: string }[] = [
  { id: 'account', label: 'Account Opportunity' }, { id: 'portfolio', label: 'Executive Portfolio' },
  { id: 'strategy', label: 'Strategic Opportunity' }, { id: 'quality', label: 'Data Quality' },
  { id: 'admin', label: '관리자 입력' }, { id: 'method', label: 'Methodology' },
]

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

  return (
    <div className="flex h-full flex-col">
      <Header data={data} mode={mode} theme={theme} setTheme={setTheme} />
      <nav className="flex gap-1 overflow-x-auto border-b border-line bg-panel px-4" aria-label="화면 전환">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold border-b-2 ${tab === t.id ? 'border-brand text-ink' : 'border-transparent text-ink3 hover:text-ink'}`}>{t.label}</button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1">
        {(tab === 'account') && <Sidebar data={data} selected={account.account_id} onSelect={selectAccount} />}
        <main className="min-w-0 flex-1 overflow-y-auto scroll-thin">
          {tab === 'account' && <AccountView data={data} account={account} scen={scen} setScen={setScen} addr={addr} setAddr={setAddr} sel={sel} setSel={setSel} palette={palette} themeKey={theme} onSelectAccount={setAccountId} />}
          {tab === 'portfolio' && <PortfolioView data={data} palette={palette} onSelect={selectAccount} themeKey={theme} />}
          {tab === 'strategy' && <StrategyView data={data} palette={palette} onSelect={selectAccount} themeKey={theme} />}
          {tab === 'quality' && <QualityView data={data} onSelect={selectAccount} />}
          {tab === 'admin' && <AdminView data={data} mode={mode} onSaved={() => loadDashboard().then(r => { setData(r.data); setMode(r.mode) })} />}
          {tab === 'method' && <MethodologyView data={data} />}
        </main>
      </div>
    </div>
  )
}
