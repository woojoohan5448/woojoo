import { useEffect, useId, useRef, useState } from 'react'
import { GLOSSARY, termLabel } from '../lib/glossary'

/**
 * Glossary-backed term with an accessible tooltip (hover, click, keyboard focus; Esc closes).
 * Content order: 원어 + 한국어 뜻 → 정의 → 목적 → 산식 → 해석 주의.
 */
export function TermTip({ code, children, className = '' }: { code: string; children?: React.ReactNode; className?: string }) {
  const t = GLOSSARY[code]
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!pinned) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setPinned(false); setOpen(false) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [pinned])
  if (!t) return <>{children}</>
  const show = open || pinned
  return (
    <span ref={ref} className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => !pinned && setOpen(false)}>
      {children ?? termLabel(code, 'kpi')}
      <button type="button" aria-label={`${t.en} 용어 설명`} aria-describedby={show ? id : undefined} aria-expanded={show}
        data-term={code}
        onFocus={() => setOpen(true)} onBlur={() => !pinned && setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setPinned(p => !p); setOpen(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setPinned(false); setOpen(false) } }}
        className="ml-1 inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-line text-[9.5px] font-bold text-ink3 hover:text-ink focus:outline-none focus:ring-2 focus:ring-[var(--c-ts)]">?</button>
      {show && (
        <span role="tooltip" id={id}
          className="absolute left-0 top-full z-50 mt-1 w-[320px] max-w-[80vw] rounded-md border border-line bg-panel p-3 text-left text-[12px] font-normal normal-case tracking-normal text-ink2 shadow-lg"
          style={{ background: 'var(--surface-1)' }}>
          <span className="block text-[12.5px] font-bold text-ink">{t.no ? `${t.no} ` : ''}{t.en}{t.abbr && t.abbr !== t.en ? ` (${t.abbr})` : ''}</span>
          <span className="block text-ink2">{t.ko}</span>
          <span className="mt-1.5 block">{t.definition}</span>
          <span className="mt-1 block"><b className="text-ink">목적</b> {t.purpose}</span>
          {t.formula && <span className="mt-1 block"><b className="text-ink">산식·기준</b> <span className="num">{t.formula}</span></span>}
          {t.caution && <span className="mt-1 block" style={{ color: 'var(--warn)' }}><b>해석 주의</b> {t.caution}</span>}
        </span>
      )}
    </span>
  )
}
