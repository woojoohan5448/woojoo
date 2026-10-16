/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface-0)', panel: 'var(--surface-1)', sunk: 'var(--surface-2)', line: 'var(--line)',
        ink: 'var(--ink-1)', ink2: 'var(--ink-2)', ink3: 'var(--ink-3)',
        brand: 'var(--brand)', ts: 'var(--c-ts)', raw: 'var(--c-raw)', fpr: 'var(--c-fpr)', rev: 'var(--c-rev)',
      },
      fontFamily: { sans: ['Pretendard', 'Inter', 'Apple SD Gothic Neo', 'Malgun Gothic', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
