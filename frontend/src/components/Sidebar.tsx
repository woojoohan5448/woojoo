import { useMemo, useState } from 'react'
import type { Dashboard } from '../types'
import { RESEARCH_STATUS_LABEL, SEGMENT_LABEL, eok, missingText } from '../lib/format'
import { ConfidenceMeter } from './badges'

type SortKey = 'id' | 'name' | 'ts' | 'fpr' | 'conf'

export default function Sidebar({ data, selected, onSelect }: { data: Dashboard; selected: string; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState('ALL')
  const [st, setSt] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('id')
  const segs = useMemo(() => [...new Set(data.accounts.map(a => a.segment))], [data])
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const r = data.accounts.filter(a =>
      (seg === 'ALL' || a.segment === seg) && (st === 'ALL' || a.research_status === st) &&
      (!ql || a.original_name.toLowerCase().includes(ql) || (a.entity.legal_name_ko ?? '').toLowerCase().includes(ql) || (a.entity.legal_name_en ?? '').toLowerCase().includes(ql) || a.account_id.toLowerCase().includes(ql)))
    const v = (x: number | null) => x ?? -1
    const s = [...r]
    if (sort === 'name') s.sort((a, b) => a.original_name.localeCompare(b.original_name, 'ko'))
    if (sort === 'ts') s.sort((a, b) => v(b.m['2026'].TS.value) - v(a.m['2026'].TS.value))
    if (sort === 'fpr') s.sort((a, b) => v(b.m['2026'].FPR.value) - v(a.m['2026'].FPR.value))
    if (sort === 'conf') s.sort((a, b) => b.m['2026'].TS.confidence - a.m['2026'].TS.confidence)
    return s
  }, [data, q, seg, st, sort])

  return (
    <aside className="hidden w-[272px] shrink-0 flex-col border-r border-line bg-panel md:flex" aria-label="고객 선택">
      <div className="space-y-1.5 border-b border-line p-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="고객명·법인명 검색" aria-label="고객 검색"
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand" />
        <div className="grid grid-cols-2 gap-1.5">
          <select value={seg} onChange={e => setSeg(e.target.value)} aria-label="산업 필터" className="rounded border border-line bg-surface px-1.5 py-1 text-[12px]">
            <option value="ALL">전체 산업</option>{segs.map(s => <option key={s} value={s}>{SEGMENT_LABEL[s] ?? s}</option>)}
          </select>
          <select value={st} onChange={e => setSt(e.target.value)} aria-label="조사 상태" className="rounded border border-line bg-surface px-1.5 py-1 text-[12px]">
            <option value="ALL">전체 상태</option>{Object.entries(RESEARCH_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="정렬" className="w-full rounded border border-line bg-surface px-1.5 py-1 text-[12px]">
          <option value="id">정렬: 원본 순서</option><option value="name">정렬: 이름</option><option value="ts">정렬: 2026 TS 큰 순</option>
          <option value="fpr">정렬: 2026 FPR 큰 순</option><option value="conf">정렬: 신뢰도 높은 순</option>
        </select>
        <div className="text-[11px] text-ink3">{list.length} / {data.accounts.length}개 고객</div>
      </div>
      <ul className="flex-1 overflow-y-auto scroll-thin">
        {list.map(a => {
          const active = a.account_id === selected
          const ts = a.m['2026'].TS
          return (
            <li key={a.account_id}>
              <button onClick={() => onSelect(a.account_id)} aria-current={active}
                className={`w-full border-b border-line px-3 py-2 text-left ${active ? 'bg-sunk' : 'hover:bg-sunk/60'}`}
                style={active ? { boxShadow: 'inset 3px 0 0 var(--brand)' } : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{a.original_name}</span>
                  <span className="num shrink-0 text-[11px] text-ink3">{a.account_id}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-ink3">
                  <span className="truncate">{SEGMENT_LABEL[a.segment] ?? a.segment} · {RESEARCH_STATUS_LABEL[a.research_status]}</span>
                  <span className="num shrink-0 text-ink2">{ts.value !== null ? eok(ts.value, ts.status) : a.m['2026'].RAW.value !== null ? 'RAW만' : missingText(a, { year: 2026, metric: 'TS' }) === 'RESEARCH GAP' ? 'GAP' : missingText(a, { year: 2026, metric: 'TS' })}</span>
                </div>
                <div className="mt-1"><ConfidenceMeter value={ts.confidence} width={90} /></div>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
