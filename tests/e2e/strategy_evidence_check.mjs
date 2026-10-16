// Item 7 check (read-only): in ③ 전략과제 도출 and ④ 전략적 시사점, areas whose evidence is not SUFFICIENT
// must never be presented as a confirmed recommendation — the existing score stays a separate column.
// node tests/e2e/strategy_evidence_check.mjs [baseUrl] [outJson]
import { chromium } from '../../frontend/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:8000/'
const outJson = process.argv[3] || 'docs/vnext/phase3a/screens/strategy_evidence_results.json'
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
const data = JSON.parse(fs.readFileSync(new URL('../../data/processed/dashboard.json', import.meta.url), 'utf-8'))
const LEVEL = { SUFFICIENT: '근거 충분', PARTIAL: '근거 일부', INSUFFICIENT: '근거 부족' }
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage({ viewport: { width: 1600, height: 1100 } })
const checks = []; let fail = 0
const ok = (c, msg) => { checks.push({ ok: !!c, msg }); if (!c) fail++ }
const open = async (tab) => {
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('onboarded', 'true'); localStorage.setItem('tab', JSON.stringify(t)) }, tab)
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400)
}
await open('strategy')
const rows = await p.$$eval('table tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim())).filter(c => c.length >= 10))
for (const s of data.strategy) {
  const r = rows.find(c => c[1] === s.area)
  if (!r) { ok(false, `③ ${s.area}: 표에 없음`); continue }
  const e = s.evidence, hyp = e.recommendation_mode === 'HYPOTHESIS'
  ok(r[2] === String(s.priority_score), `③ ${s.area}: 점수 ${r[2]} = 엔진 ${s.priority_score} (점수 불변)`)
  ok(r[6] === LEVEL[e.evidence_level], `③ ${s.area}: 근거 수준 열 별도 표시 '${r[6]}' (엔진 ${e.evidence_level})`)
  ok(hyp === r[9].includes('가설'), `③ ${s.area}: 권고 '${r[9]}' — ${hyp ? '가설 표기 있음' : '근거 충분 → 가설 표기 없음'} (mode ${e.recommendation_mode})`)
  ok(e.evidence_level === 'SUFFICIENT' || hyp, `③ ${s.area}: 근거 ${e.evidence_level}이면 RECOMMENDATION 아님`)
}
await open('overview')
const opts = await p.$$eval('[data-testid=options] li', lis => lis.map(li => ({ area: li.querySelector('b')?.textContent.trim(), text: li.textContent })))
for (const s of data.strategy) {
  const o = opts.find(x => x.area === s.area), hyp = s.evidence.recommendation_mode === 'HYPOTHESIS'
  ok(o && (hyp ? o.text.includes('검토 가설') && !o.text.includes('우선 검토') : o.text.includes('우선 검토')), `④ ${s.area}: '${o?.text.trim()}' — ${hyp ? '검토 가설(단정 표시 없음)' : '근거 충분 → 우선 검토'}`)
}
const body = await p.textContent('main')
ok(body.includes('확정 과제·투자 결정이 아닙니다'), '④ 확정 과제 아님 고지 표시')
await b.close()
const res = { fail, n: checks.length, rows: rows.map(c => ({ area: c[1], score: c[2], evidence: c[6], recommendation: c[9] })), checks }
fs.writeFileSync(outJson, JSON.stringify(res, null, 2))
checks.forEach(c => console.log(c.ok ? 'PASS' : 'FAIL', c.msg)); console.log(`${checks.length - fail}/${checks.length}`)
process.exit(fail ? 1 : 0)
