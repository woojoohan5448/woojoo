/** Segmented radio control (shared by ① and ② for scenario / case switches). */
export default function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-panel p-0.5">
      {options.map(o => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`rounded px-2.5 py-1 text-[12px] font-semibold ${value === o.v ? 'bg-ink text-surface' : 'text-ink2 hover:text-ink'}`}>{o.l}</button>
      ))}
    </div>
  )
}
