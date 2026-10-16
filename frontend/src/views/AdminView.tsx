import { useState } from 'react'
import type { Dashboard } from '../types'
import { eok } from '../lib/format'

interface Row { account_id: string; cr_2026_ytd_eok: string; cr_2026_ytd_asof: string; cr_2026_forecast_eok: string; cr_basis: string; target_revenue_2031_eok: string; target_basis: string }

export default function AdminView({ data, mode, onSaved }: { data: Dashboard; mode: 'api' | 'static'; onSaved: () => void }) {
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [msg, setMsg] = useState('')
  const get = (id: string): Row => rows[id] ?? { account_id: id, cr_2026_ytd_eok: '', cr_2026_ytd_asof: '', cr_2026_forecast_eok: '', cr_basis: '', target_revenue_2031_eok: '', target_basis: '' }
  const set = (id: string, k: keyof Row, v: string) => setRows(r => ({ ...r, [id]: { ...get(id), [k]: v } }))
  const changed = Object.values(rows).filter(r => r.cr_2026_forecast_eok || r.target_revenue_2031_eok || r.cr_2026_ytd_eok)

  const warn = (id: string) => {
    const a = data.accounts.find(x => x.account_id === id)!; const r = get(id); const w: string[] = []
    const cr = parseFloat(r.cr_2026_forecast_eok), tg = parseFloat(r.target_revenue_2031_eok)
    if (r.cr_2026_forecast_eok && (isNaN(cr) || cr < 0)) w.push('CR은 0 이상의 숫자(억원)')
    if (!isNaN(cr) && a.m['2026'].FPR.value !== null && cr > a.m['2026'].FPR.value) w.push('CR > FPR 2026 — 저장 시 검증 경고 생성')
    if (!isNaN(tg) && a.m['2031'].base.FPR_base.value !== null && tg > a.m['2031'].base.FPR_base.value) w.push('Target > FPR 2031 — 무결성 오류')
    if (r.cr_2026_forecast_eok && !r.cr_basis) w.push('입력 근거(사내 시스템·기준일) 필수')
    return w
  }

  const csv = () => {
    const head = 'account_id,original_name,cr_2026_ytd_eok,cr_2026_ytd_asof,cr_2026_forecast_eok,cr_basis,target_revenue_2031_eok,target_basis,updated_by,updated_at'
    const body = data.accounts.map(a => { const r = get(a.account_id); return [a.account_id, `"${a.original_name}"`, r.cr_2026_ytd_eok, r.cr_2026_ytd_asof, r.cr_2026_forecast_eok, `"${r.cr_basis}"`, r.target_revenue_2031_eok, `"${r.target_basis}"`, '', new Date().toISOString()].join(',') })
    const blob = new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
    const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = 'management_inputs.csv'; el.click(); URL.revokeObjectURL(u)
  }
  const save = async () => {
    try {
      const r = await fetch('/api/management-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: changed }) })
      const j = await r.json(); setMsg(r.ok ? `저장 및 재계산 완료: ${j.saved}건 · 검증 이슈 ${JSON.stringify(j.issues_summary)}` : `오류: ${j.detail ?? r.status}`); if (r.ok) onSaved()
    } catch (e) { setMsg(`API 연결 실패 — 정적 빌드에서는 CSV 내보내기를 사용하세요. (${String(e)})`) }
  }

  return (
    <div className="space-y-4 p-4">
      <section className="card p-4">
        <h2 className="text-[18px] font-bold">관리자 입력 — Current Revenue · 2031 Target (사내 데이터)</h2>
        <p className="mt-1 text-[12.5px] text-ink2">CR_2026과 2031 Target은 공개자료로 확인할 수 없는 <b>사내 데이터</b>입니다. 비워두면 <b>NULL(미확인)</b>으로 처리되며 0원으로 간주하지 않습니다. 입력 시 C-SOW·Potential Capture Rate·Upside·Target SOW가 재계산되고 무결성 검증이 수행됩니다.</p>
        <p className="mt-1 text-[12px] text-ink3">현재 모드: {mode === 'api' ? 'API — 저장 시 data/internal_inputs/management_inputs.csv 갱신 후 모델 재빌드' : '정적 빌드 — 입력 후 CSV를 내려받아 data/internal_inputs/에 저장하고 `python3 -m models.build` 실행'}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={save} disabled={mode !== 'api' || changed.length === 0} className="rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">API로 저장·재계산</button>
          <button onClick={csv} className="rounded-md border border-line px-3 py-1.5 text-[13px] font-semibold">CSV 내보내기</button>
          {msg && <span className="self-center text-[12px] text-ink2">{msg}</span>}
        </div>
      </section>
      <section className="card p-0 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[12px]">
          <thead className="sticky top-0 bg-panel"><tr className="text-left text-ink3"><th className="p-2">고객</th><th>FPR 2026 (참고)</th><th>CR YTD(억)</th><th>기준일</th><th>CR 2026 연말예상(억)</th><th>CR 근거</th><th>FPR 2031 (참고)</th><th>Target 2031(억)</th><th>Target 근거</th><th>검증</th></tr></thead>
          <tbody>{data.accounts.map(a => { const r = get(a.account_id); const w = warn(a.account_id); const cur = a.m['2026'].CR.value; return (
            <tr key={a.account_id} className="border-t border-line">
              <td className="p-2 font-semibold whitespace-nowrap">{a.account_id} {a.original_name}<div className="font-normal text-ink3">현재 CR: {cur === null ? 'NULL(미입력)' : eok(cur, 'VERIFIED')}</div></td>
              <td className="num text-ink2">{eok(a.m['2026'].FPR.value, a.m['2026'].FPR.status)}</td>
              {(['cr_2026_ytd_eok', 'cr_2026_ytd_asof', 'cr_2026_forecast_eok', 'cr_basis'] as (keyof Row)[]).map(k => <td key={k}><input aria-label={`${a.original_name} ${k}`} value={r[k]} onChange={e => set(a.account_id, k, e.target.value)} className="w-full min-w-[80px] rounded border border-line bg-surface px-1.5 py-1" placeholder={k.includes('asof') ? 'YYYY-MM-DD' : k.includes('basis') ? '예: ERP 매출, 2026-09' : '억원'} /></td>)}
              <td className="num text-ink2">{eok(a.m['2031'].base.FPR_base.value, 'ESTIMATED')}</td>
              {(['target_revenue_2031_eok', 'target_basis'] as (keyof Row)[]).map(k => <td key={k}><input aria-label={`${a.original_name} ${k}`} value={r[k]} onChange={e => set(a.account_id, k, e.target.value)} className="w-full min-w-[80px] rounded border border-line bg-surface px-1.5 py-1" placeholder={k.includes('basis') ? 'Account Plan 근거' : '억원'} /></td>)}
              <td className="text-[11px]" style={{ color: w.length ? 'var(--warn)' : 'var(--ink-3)' }}>{w.join(' · ') || '—'}</td>
            </tr>) })}</tbody>
        </table>
      </section>
    </div>
  )
}
