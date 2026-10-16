import { useEffect, useRef, useState } from 'react'
import { GLOSSARY } from '../lib/glossary'

const STEPS = [
  { title: '이 대시보드의 목적',
    body: (
      <>
        <p>LG유플러스 Enterprise 53개 Key Account의 2026~2031 사업기회를 정량화하고, <b>고객 수요를 전사 전략과제와 우선순위로 전환</b>하기 위한 분석 도구입니다.</p>
        <p className="mt-2">모든 수치는 근거·산식과 연결되어 있으며, 추정값은 등급(HIGH/MEDIUM/LOW)과 근거 유형으로 구분됩니다. 수치를 클릭하면 <b>수치 산출 근거</b> 패널에서 원천을 확인할 수 있습니다.</p>
      </>) },
  { title: 'TS → RAW → FPR 의 관계',
    body: (
      <>
        <div className="mt-1 space-y-1.5" aria-hidden>
          {[['TS', 'var(--c-ts)', 100], ['RAW', 'var(--c-raw)', 62], ['FPR', 'var(--c-fpr)', 30]].map(([k, c, w]) => (
            <div key={k as string} className="flex items-center gap-2">
              <span className="w-10 text-[12px] font-bold">{k}</span>
              <span className="h-3 rounded-sm" style={{ width: `${w}%`, background: c as string }} />
            </div>))}
        </div>
        <ul className="mt-3 space-y-1 text-[12.5px]">
          <li><b>{GLOSSARY.TS.no} {GLOSSARY.TS.en} (TS)</b> — {GLOSSARY.TS.ko}: 판매 불가 영역까지 포함한 전체 시장</li>
          <li><b>{GLOSSARY.RAW.no} {GLOSSARY.RAW.en} (RAW)</b> — {GLOSSARY.RAW.ko}: RAW ≤ TS</li>
          <li><b>{GLOSSARY.FPR.no} {GLOSSARY.FPR.en} (FPR)</b> — {GLOSSARY.FPR.ko}: FPR ≤ RAW</li>
          <li><b>④ CR · ⑧ Target</b> — 사내 실적·승인 목표. 없으면 0이 아니라 <b>사내 입력 필요</b></li>
        </ul>
        <p className="mt-2 text-[12px] text-ink3">세 지표는 포함 관계이므로 더하지 않습니다.</p>
      </>) },
  { title: '53개 고객 분석 → 전사 전략과제 (AS-IS → TO-BE)',
    body: (
      <>
        <ol className="space-y-1.5 text-[12.5px]">
          <li><b>AS-IS · Account Intelligence</b></li>
          <li className="pl-3">① 고객별 사업기회 — 53개사 TS·RAW·FPR·CR·Target과 2026~2031 성장 궤적</li>
          <li className="pl-3">② 전사 기회 분석 — 산업·사업영역별 통합(부분합, 정의 상이 제외)</li>
          <li><b>TO-BE · Strategic Intelligence</b></li>
          <li className="pl-3">③ 전략과제 도출 — Opportunity Pool → Demand Evidence → Capability Gap → Strategic Initiative</li>
          <li className="pl-3">④ 전략적 시사점 — 우선 검토 영역·옵션·의사결정 과제</li>
        </ol>
        <p className="mt-2">AS-IS/TO-BE는 분석 단계의 구분입니다(AS-IS에도 2031 전망 포함). 전략 점수(매력도)와 <b>근거 수준</b>은 별개이며, 근거가 부족한 영역의 권고는 "검토 가설"입니다.</p>
      </>) },
]

/** 3-step first-visit guide. Reopen via the "가이드" button in the header. */
export default function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (open) { setI(0); setTimeout(() => ref.current?.focus(), 0) } }, [open])
  if (!open) return null
  const s = STEPS[i]
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.45)' }} onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="onb-title" onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight' && i < STEPS.length - 1) setI(i + 1); if (e.key === 'ArrowLeft' && i > 0) setI(i - 1) }}
        className="card w-[520px] max-w-full p-5 outline-none shadow-xl">
        <div className="kicker">시작 안내 {i + 1} / {STEPS.length}</div>
        <h2 id="onb-title" className="mt-1 text-[18px] font-bold">{s.title}</h2>
        <div className="mt-2 text-[13px] text-ink2 leading-relaxed">{s.body}</div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1" aria-hidden>{STEPS.map((_, k) => <span key={k} className="h-1.5 w-6 rounded-full" style={{ background: k === i ? 'var(--brand)' : 'var(--line)' }} />)}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] text-ink3">건너뛰기</button>
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-md border border-line px-3 py-1.5 text-[13px]">이전</button>}
            {i < STEPS.length - 1
              ? <button onClick={() => setI(i + 1)} className="rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white">다음</button>
              : <button onClick={onClose} className="rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white">시작하기</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
