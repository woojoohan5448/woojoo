// Visual regression helper: for every account at desktop resolutions, check that trajectory endpoint labels
// (TS/RAW/FPR/CR/Target) do not overlap each other or the axis labels. node tests/e2e/trajectory_overlap.mjs [baseUrl]
import { chromium } from '../../frontend/node_modules/playwright-core/index.mjs'
const base = process.argv[2] || 'http://127.0.0.1:8000/'
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage()
await p.goto(base, { waitUntil: 'networkidle' })
const ids = await p.evaluate(async () => { try { const r = await fetch('/api/accounts'); return (await r.json()).map(a => a.account_id) } catch { return [] } })
const accounts = ids.length ? ids : Array.from({ length: 53 }, (_, i) => `KA${String(i + 1).padStart(2, '0')}`)
let checked = 0, noChart = 0; const problems = []
for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
  await p.setViewportSize({ width: w, height: h })
  for (const id of accounts) {
    await p.evaluate((a) => { localStorage.setItem('onboarded', 'true'); localStorage.setItem('tab', JSON.stringify('account')); localStorage.setItem('acc', JSON.stringify(a)) }, id)
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(250)
    const boxes = await p.evaluate(() => {
      const svg = document.querySelector('[role=img][aria-label*="성장 궤적"] svg')
      if (!svg) return null
      return [...svg.querySelectorAll('text')].map(t => { const r = t.getBoundingClientRect(); return { t: t.textContent || '', x: r.x, y: r.y, w: r.width, h: r.height } }).filter(r => r.w > 0)
    })
    if (!boxes) { noChart++; continue }
    checked++
    const labels = boxes.filter(r => /^(TS|RAW|FPR|CR|Target)/.test(r.t))
    const axis = boxes.filter(r => /억$|조$|^20\d\d$/.test(r.t))
    const hit = (a, c) => a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) if (hit(labels[i], labels[j])) problems.push(`${w} ${id}: "${labels[i].t}" × "${labels[j].t}"`)
      for (const ax of axis) if (hit(labels[i], ax)) problems.push(`${w} ${id}: "${labels[i].t}" × axis "${ax.t}"`)
    }
  }
}
console.log(JSON.stringify({ checked, noChart, problems: problems.length }))
problems.slice(0, 40).forEach(x => console.log('OVERLAP', x))
await b.close()
process.exitCode = problems.length ? 1 : 0
