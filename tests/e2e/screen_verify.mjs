// Screen verification of the Growth Trajectory for representative accounts (API or static mode).
// node tests/e2e/screen_verify.mjs [baseUrl] [outDir] [tag]
import { chromium } from '../../frontend/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:8000/'
const out = process.argv[3] || 'docs/vnext/phase3a/screens'
const tag = process.argv[4] || 'verify'
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
const CASES = [
  ['KA03', 'FIN · KISA 공시 앵커(HIGH) · 캡티브 IT 존재'],
  ['KA29', 'PLATFORM · 최대 FPR · 인건비 믹스 가정 민감'],
  ['KA14', 'ITS · 계정별 인프라 동인(AI 5조) → 비선형 성장'],
  ['KA32', '국방 특수 · TS 없음(RESEARCH GAP) · 계약 RAW만'],
  ['KA45', '글로벌 테크 · 시나리오 앵커 · 정의 상이(합계 제외)'],
  ['KA28', 'DC 펀드 · 전 계열 RESEARCH GAP(빈 상태)'],
]
// replicate lib/format.ts eok() for ESTIMATED/SCENARIO values
const round2 = v => { if (v === 0) return 0; const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1); return Math.round(v / mag) * mag }
const eok = v => { if (v == null) return 'N/A'; const r = round2(v); return Math.abs(r) >= 10000 ? `≈${(r / 10000).toLocaleString('ko-KR', { maximumFractionDigits: r % 10000 === 0 ? 0 : 2 })}조원` : `≈${r.toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(r) < 10 ? 1 : 0 })}억원` }
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto(base, { waitUntil: 'networkidle' })
const data = await p.evaluate(async () => { try { const r = await fetch('/api/dashboard'); if (r.ok) return await r.json() } catch {} return null })
  ?? JSON.parse(fs.readFileSync(new URL('../../data/processed/dashboard.json', import.meta.url), 'utf-8'))  // static mode: same engine output that is bundled into the HTML
const results = []
const ok = (r, cond, msg) => { r.checks.push({ ok: !!cond, msg }); if (!cond) r.fail++ }
for (const [id, profile] of CASES) {
  const a = data ? data.accounts.find(x => x.account_id === id) : null
  const r = { id, name: a?.original_name, profile, checks: [], fail: 0 }
  await p.evaluate((x) => { localStorage.clear(); localStorage.setItem('onboarded', 'true'); localStorage.setItem('tab', JSON.stringify('account')); localStorage.setItem('acc', JSON.stringify(x)) }, id)
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const chart = p.locator('[role=img][aria-label*="성장 궤적"]')
  const has = await chart.count() === 1
  const anyVal = a && ['TS', 'RAW', 'FPR'].some(m => a.m['2026'][m].value != null)
  ok(r, has === !!anyVal, `차트 표시 여부 = 값 존재 여부 (${has ? '차트' : '빈 상태'})`)
  const status = await p.locator('[data-testid=traj-status]').innerText().catch(() => '')
  r.status = status.replace(/\n/g, ' · ')
  if (!has) {
    const main = await p.locator('main').innerText()
    ok(r, main.includes('RESEARCH GAP') && main.includes('0으로 표시하지 않습니다'), '빈 상태: RESEARCH GAP 사유 표시, 0 미대체')
    await p.screenshot({ path: `${out}/${tag}_${id}.png` }); results.push(r); continue
  }
  const texts = () => chart.locator('svg text').evaluateAll(els => els.map(e => e.textContent || ''))
  const r31 = (s, m, d) => m === 'TS' ? a.m['2031'][s].TS.value : a.m['2031'][s][`${m}_${d === 'base' ? 'base' : 'expansion'}`].value
  for (const [s, d, btns] of [['base', 'base', []], ['high', 'base', ['High']], ['low', 'base', ['Low']], ['base', 'expansion', ['Base', 'Strategic Expansion']]]) {
    for (const bt of btns) { await p.click(`button[role=radio]:has-text("${bt}")`); await p.waitForTimeout(250) }
    const tx = await texts()
    for (const m of ['TS', 'RAW', 'FPR']) {
      const e26 = a.m['2026'][m].value, e31 = r31(s, m, d)
      const labs = tx.filter(t => t.startsWith(`${m} ≈`))
      if (e26 == null && e31 == null) { ok(r, labs.length === 0, `[${s}/${d}] ${m} 결측 → 라벨·곡선 없음(0 대체 없음)`); continue }
      ok(r, labs.includes(`${m} ${eok(e26)}`) && labs.includes(`${m} ${eok(e31)}`), `[${s}/${d}] ${m} 끝값 2026 ${eok(e26)} · 2031 ${eok(e31)} = 엔진 (화면: ${labs.join(', ')})`)
    }
  }
  await p.click('button[role=radio]:has-text("Base Case")'); await p.click('button[role=radio]:has-text("Base")'); await p.waitForTimeout(250)
  // tooltip on an illustrative year and on 2031
  const box = await chart.boundingBox()
  const yearX = async (y) => (await chart.locator('svg text', { hasText: new RegExp(`^${y}$`) }).first().boundingBox())
  for (const [y, expect] of [['2028', 'Illustrative'], ['2031', '2031 전망'], ['2026', '2026 기준값']]) {
    const yb = await yearX(y)
    await p.mouse.move(yb.x + yb.width / 2, box.y + box.height * 0.5); await p.waitForTimeout(250)
    const tip = await p.evaluate(() => [...document.querySelectorAll('div')].filter(d => (d.getAttribute('style') || '').includes('z-index: 9999999') && d.offsetParent !== null).map(d => d.innerText).join(' | '))
    ok(r, tip.includes(expect), `툴팁 ${y}: '${expect}' 포함`)
    if (y === '2028') r.tooltip2028 = tip.replace(/\n/g, ' ')
  }
  await p.mouse.move(5, 5)
  // inspector via 2031 endpoint label click (fallback: summary table)
  const lastLab = chart.locator('svg text', { hasText: /^(FPR|RAW) ≈/ }).last()
  await lastLab.click({ force: true }).catch(() => {})
  await p.waitForTimeout(300)
  let insp = await p.locator('aside[aria-label="근거 및 계산 패널"]').innerText().catch(() => '')
  ok(r, /(FPR|RAW) 2031/.test(insp), `끝점 클릭 → 근거 패널(${(insp.match(/(FPR|RAW) 2031[^\n]*/) || [''])[0]})`)
  ok(r, insp.includes('계산 공식') || insp.includes('산식') || insp.includes('='), '근거 패널에 산식 표시')
  // overlaps among endpoint labels and with axis labels
  const boxes = await chart.locator('svg text').evaluateAll(els => els.map(e => { const q = e.getBoundingClientRect(); return { t: e.textContent || '', x: q.x, y: q.y, w: q.width, h: q.height } }).filter(q => q.w > 0))
  const labels = boxes.filter(q => /^(TS|RAW|FPR|CR|Target)/.test(q.t)), axis = boxes.filter(q => /억$|조$|^20\d\d$/.test(q.t))
  const hit = (u, v) => u.x < v.x + v.w - 1 && v.x < u.x + u.w - 1 && u.y < v.y + v.h - 1 && v.y < u.y + u.h - 1
  const ov = []; labels.forEach((u, i) => { labels.slice(i + 1).forEach(v => hit(u, v) && ov.push(`${u.t}×${v.t}`)); axis.forEach(v => hit(u, v) && ov.push(`${u.t}×${v.t}`)) })
  ok(r, ov.length === 0, `레이블 겹침 0건${ov.length ? ' (' + ov.join(', ') + ')' : ''}`)
  if (a.aggregate_class === 'DEFINITION_MISMATCH') ok(r, status.includes('정의 상이'), '정의 상이 경고 칩')
  if (a.m['2026'].TS.value == null) ok(r, status.includes('TS N/A') || status.includes('RESEARCH GAP'), 'TS 결측 상태 칩')
  ok(r, status.includes('사내 매출 미입력') && status.includes('사내 목표 미입력'), 'CR·Target 미입력 상태 1회 표시(마커 없음)')
  await p.click('button[aria-label="수치 산출 근거 패널 접기"]').catch(() => {}); await p.mouse.move(2, 2); await p.waitForTimeout(400)
  await p.locator('section[aria-labelledby=traj-title]').screenshot({ path: `${out}/${tag}_${id}.png` })
  results.push(r)
}
fs.writeFileSync(`${out}/${tag}_results.json`, JSON.stringify(results, null, 1))
for (const r of results) { console.log(`${r.fail ? 'FAIL' : 'PASS'} ${r.id} ${r.name} — ${r.checks.length - r.fail}/${r.checks.length}`); r.checks.filter(c => !c.ok).forEach(c => console.log('   ✗', c.msg)) }
await b.close()
process.exitCode = results.some(r => r.fail) ? 1 : 0
