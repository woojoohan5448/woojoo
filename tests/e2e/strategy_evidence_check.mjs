// ③·④ rendered check (read-only): existing score unchanged and shown separately from the three evidence lenses,
// no initiative presented as confirmed/approved, Security & SI/MS verification cases present.
// node tests/e2e/strategy_evidence_check.mjs [baseUrl] [outJson] [width]
import { chromium } from '../../frontend/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:8000/'
const outJson = process.argv[3] || 'docs/vnext/phase3a/screens/strategy_evidence_results.json'
const width = Number(process.argv[4] || 1600)
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
const data = JSON.parse(fs.readFileSync(new URL('../../data/processed/dashboard.json', import.meta.url), 'utf-8'))
const ST = { CANDIDATE: '추진 검토 후보', NEEDS_VALIDATION: '검증 필요', ANALYSIS_HYPOTHESIS: '분석 가설' }
const LV = { market: { SUFFICIENT: '근거 충분', PARTIAL: '근거 일부', INSUFFICIENT: '근거 부족' }, demand: { SUFFICIENT: '수요 확인', PARTIAL: '수요 일부', INSUFFICIENT: '수요 근거 없음' }, capture: { SUFFICIENT: '확보 가능성 높음', PARTIAL: '보통', INSUFFICIENT: '낮음' } }
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage({ viewport: { width, height: 1100 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
const checks = []; let fail = 0
const ok = (c, msg) => { checks.push({ ok: !!c, msg }); if (!c) fail++ }
const open = async (tab) => {
  await p.goto(base, { waitUntil: 'networkidle' })
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('onboarded', 'true'); localStorage.setItem('tab', JSON.stringify(t)) }, tab)
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400)
}
await open('strategy')
const flow = await p.textContent('[data-testid=derivation-flow]')
for (const k of ['53 KA Opportunity', 'Opportunity Pool', 'Market / Demand Evidence', 'Capability Gap', 'Strategic Initiative', 'Priority', 'Next Action']) ok(flow.includes(k), `③ 도출 흐름 단계 '${k}'`)
ok(/승인 0/.test(flow), '③ 흐름: 신규 전략과제 승인 0건')
const rows = await p.$$eval('[data-testid=initiative-matrix] tbody tr', trs => trs.map(tr => ({ area: tr.dataset.area, cells: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()) })))
for (const i of data.initiatives) {
  const r = rows.find(x => x.area === i.area); if (!r) { ok(false, `③ ${i.area} 없음`); continue }
  const s = data.strategy.find(x => x.area === i.area)
  ok(r.cells[2] === String(s.priority_score), `③ ${i.area}: 매력도 점수 ${r.cells[2]} = 엔진 ${s.priority_score}(불변)`)
  ok(r.cells[6] === LV.market[i.lenses.market.level] && r.cells[7] === LV.demand[i.lenses.demand.level] && r.cells[8] === LV.capture[i.lenses.capture.level], `③ ${i.area}: 3관점 별도 열 ${r.cells.slice(6, 9).join('/')}`)
  ok(r.cells[9] === ST[i.status], `③ ${i.area}: 과제 상태 '${r.cells[9]}'`)
  ok(!r.cells[10].includes('권고') && (i.status === 'CANDIDATE' || /검증 필요|분석 가설/.test(r.cells[10])), `③ ${i.area}: 옵션 '${r.cells[10]}' — 확정 권고 표시 없음`)
  if (i.lenses.demand.level === 'INSUFFICIENT') ok(i.status === 'ANALYSIS_HYPOTHESIS' && r.cells[9] === '분석 가설', `③ ${i.area}: 수요 근거 없음 → 분석 가설`)
}
// initiative card: WHY/GAP/OPTION/PRIORITY/ACTION
for (const area of ['Security', 'SI / Managed Services']) {
  await p.click(`[data-testid=initiative-matrix] tr[data-area="${area}"]`); await p.waitForTimeout(150)
  const blocks = await p.$$eval('[data-testid=initiative-card] [data-block]', els => els.map(e => e.dataset.block))
  ok(['WHY', 'GAP', 'OPTION', 'PRIORITY'].every(k => blocks.includes(k)) && await p.$('[data-testid=initiative-card] [data-testid=actions]'), `③ ${area}: WHY/GAP/OPTION/PRIORITY/ACTION 블록`)
  const card = await p.textContent('[data-testid=initiative-card]')
  ok(card.includes('제안(PROPOSED)') && !card.includes('승인 상태: 승인'), `③ ${area}: 승인 상태 = 제안`)
}
const cases = await p.textContent('[data-testid=verification-cases]')
ok(cases.includes('Security') && cases.includes('성장 가정 의존도') && /60%/.test(cases), '③ 검증 사례 ① Security 성장 가정 의존도 60%')
ok(cases.includes('SI / Managed Services') && cases.includes('기존 공급자 관찰'), '③ 검증 사례 ② SI/MS 기존 공급자 관찰 의존')
const sens = await p.$$eval('[data-testid=sensitivity] tbody tr', trs => trs.length)
ok(sens === data.priority_sensitivity.scenarios.length, `③ 가중치 민감도 ${sens}개 시나리오(근거 미혼합)`)
await open('overview')
const opts = await p.$$eval('[data-testid=options] li', lis => lis.map(li => ({ area: li.dataset.area, text: li.textContent })))
for (const i of data.initiatives) {
  const o = opts.find(x => x.area === i.area)
  ok(o && o.text.includes(i.option.label) && !o.text.includes('우선 검토') && !o.text.includes('권고'), `④ ${i.area}: '${i.option.label}' (3관점 표시, 확정 권고 없음)`)
}
const vt = await p.$$eval('[data-testid=verification-tasks] tbody tr', trs => trs.length)
ok(vt === data.initiatives.length, `④ 사업영역별 검증 과제 ${vt}행`)
const body = await p.textContent('main')
ok(body.includes('확정 과제·투자 결정이 아닙니다'), '④ 확정 과제 아님 고지')
ok(errs.length === 0, `페이지 오류 없음 (${errs.join('; ')})`)
await b.close()
fs.writeFileSync(outJson, JSON.stringify({ base, width, fail, n: checks.length, checks }, null, 2))
checks.forEach(c => console.log(c.ok ? 'PASS' : 'FAIL', c.msg)); console.log(`${checks.length - fail}/${checks.length}`)
process.exit(fail ? 1 : 0)
