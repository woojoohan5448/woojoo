// Phase 3A E2E — ① reconciliation panel + FPR zoom, ② integrated trajectory, label overlap, at 1280/1440/1920.
// node tests/e2e/phase3a.e2e.mjs [baseUrl] [outJson]       (SYNTH=1 → expects the sandbox synthetic recon store)
import { chromium } from '../../frontend/node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:8000/'
const outJson = process.argv[3] || null
const SYNTH = process.env.SYNTH === '1'
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
const WIDTHS = (process.env.WIDTHS || '1280,1440,1920').split(',').map(Number)
const ACCS = (process.env.ACCS || 'KA03,KA29,KA14,KA32,KA45,KA28').split(',')
const round2 = v => { if (v === 0) return 0; const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1); return Math.round(v / mag) * mag }
const eok = v => { if (v == null) return 'N/A'; const r = round2(v); return Math.abs(r) >= 10000 ? `≈${(r / 10000).toLocaleString('ko-KR', { maximumFractionDigits: r % 10000 === 0 ? 0 : 2 })}조원` : `≈${r.toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(r) < 10 ? 1 : 0 })}억원` }
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(base, { waitUntil: 'networkidle' })
const data = await p.evaluate(async () => { try { const r = await fetch('/api/dashboard'); if (r.ok) return await r.json() } catch {} return null })
  ?? JSON.parse(fs.readFileSync(new URL('../../data/processed/dashboard.json', import.meta.url), 'utf-8'))
const mode = base.startsWith('file:') ? 'static' : 'api'
const checks = []; let fail = 0; const per = {}
const ok = (c, msg, w) => { checks.push({ ok: !!c, msg, w }); per[w] = per[w] || { n: 0, fail: 0 }; per[w].n++; if (!c) { fail++; per[w].fail++ } }
const go = async (tab, acc) => {
  await p.evaluate(([t, a]) => { localStorage.clear(); localStorage.setItem('onboarded', 'true'); localStorage.setItem('tab', JSON.stringify(t)); if (a) localStorage.setItem('acc', JSON.stringify(a)) }, [tab, acc])
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300)
}
const texts = (sel) => p.evaluate((s) => { const svg = document.querySelector(s); return svg ? [...svg.querySelectorAll('text')].map(t => { const r = t.getBoundingClientRect(); return { t: t.textContent || '', x: r.x, y: r.y, w: r.width, h: r.height } }).filter(r => r.w > 0) : null }, sel)
const overlaps = (boxes) => {
  if (!boxes) return 0
  const labels = boxes.filter(r => /^(TS|RAW|FPR|CR|Target)/.test(r.t)), axis = boxes.filter(r => /억$|조$|^20\d\d$/.test(r.t))
  const hit = (a, c) => a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1
  let n = 0
  for (let i = 0; i < labels.length; i++) { for (let j = i + 1; j < labels.length; j++) if (hit(labels[i], labels[j])) n++; for (const ax of axis) if (hit(labels[i], ax)) n++ }
  return n
}
const v31 = (a, s, m, c) => (m === 'TS' ? a.m['2031'][s].TS : a.m['2031'][s][`${m}_${c}`]).value
const agg = (m, s, c) => { const set = data.accounts.filter(a => a.aggregate_class !== 'DEFINITION_MISMATCH' && a.m['2026'][m].value != null && v31(a, s, m, c) != null); return { n: set.length, v26: set.reduce((t, a) => t + a.m['2026'][m].value, 0), v31: set.reduce((t, a) => t + v31(a, s, m, c), 0) } }
let charts = 0, overlapTotal = 0

for (const w of WIDTHS) {
  await p.setViewportSize({ width: w, height: 1000 })
  // ---------- ① account: reconciliation panel + FPR zoom
  for (const id of ACCS) {
    const a = data.accounts.find(x => x.account_id === id)
    await go('account', id)
    const panel = await p.$('[data-testid=recon-panel]')
    ok(panel, `[${w}] ${id} 대사 패널 표시`, w)
    if (!panel) continue
    const led = await p.$$eval('[data-testid=ledger-table] tbody tr', trs => trs.map(tr => ({ key: tr.dataset.key, cells: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()) })))
    ok(led.length === 8, `[${w}] ${id} 원장 8행(TS/RAW/FPR 2026·2031, CR, Target)`, w)
    const ts26 = led.find(r => r.key === 'TS|2026|BASE|BASE_CASE')
    const exp = a.m['2026'].TS.value == null ? 'N/A' : eok(a.m['2026'].TS.value)
    ok(ts26 && ts26.cells[1].startsWith(exp), `[${w}] ${id} TS 2026 원장 값 '${ts26?.cells[1]}' = 엔진 ${exp}`, w)
    const src = SYNTH && id === 'KA03' ? null : led.filter(r => /^(TS|RAW|FPR)\|/.test(r.key || '')).every(r => r.cells[2].includes('외부 모델(기본 출처)') || r.cells[1].startsWith('N/A'))
    if (src !== null) ok(src, `[${w}] ${id} TS/RAW/FPR 공식 출처 = 외부 모델(기본값)`, w)
    ok(led.every(r => r.cells.length === 9), `[${w}] ${id} 값마다 출처·기준연도·시나리오·데이터 상태·승인 상태·근거 ID 열`, w)
    const tgt = led.find(r => r.key === 'TARGET|2031|APPROVED')
    ok(tgt && tgt.cells[1].includes('사내 목표 미입력') && tgt.cells[6].includes('사내 미입력'), `[${w}] ${id} Target 승인값 없음(자동 생성 없음)`, w)
    const fields = await p.$$eval('[data-testid=internal-fields] tbody tr', trs => trs.map(tr => tr.dataset.field))
    ok(fields.join() === 'SAM,RAW,ACTUAL,PLAN,STRETCH,TARGET', `[${w}] ${id} 사내 6개 필드 행`, w)
    if (!SYNTH) ok(await p.$('[data-testid=recon-empty]'), `[${w}] ${id} 사내 미연동 안내(Blocker)`, w)
    // evidence id → inspector
    const evBtn = await p.$('[data-testid=ledger-table] tbody tr button')
    if (evBtn) { await evBtn.click(); await p.waitForTimeout(200); ok(await p.$('aside, [aria-label*="수치 산출 근거"]'), `[${w}] ${id} 근거 ID 클릭 → 근거 패널`, w) }
    // FPR zoom chart
    const hasFpr = a.m['2026'].FPR.value != null
    const aux = await p.$('[data-testid=fpr-aux]')
    ok(!!aux === hasFpr, `[${w}] ${id} FPR 확대 보조 차트 ${hasFpr ? '표시' : '미표시(FPR 없음)'}`, w)
    if (aux) {
      const bx = await texts('[data-testid=fpr-aux] svg'); charts++
      const lab = bx.filter(r => r.t.startsWith('FPR ')).map(r => r.t)
      ok(lab.includes(`FPR ${eok(a.m['2026'].FPR.value)}`) && lab.includes(`FPR ${eok(a.m['2031'].base.FPR_base.value)}`), `[${w}] ${id} 보조 차트 끝값 = 엔진 (${lab.join(', ')})`, w)
      ok(!bx.some(r => /^(TS|RAW) /.test(r.t)), `[${w}] ${id} 보조 차트에 TS·RAW 없음(별도 축)`, w)
      const ov = overlaps(bx); overlapTotal += ov; ok(ov === 0, `[${w}] ${id} 보조 차트 라벨 겹침 ${ov}`, w)
    }
    const mainBx = await texts('[role=img][aria-label*="성장 궤적"] svg'); if (mainBx) { charts++; const ov = overlaps(mainBx); overlapTotal += ov; ok(ov === 0, `[${w}] ${id} 주 차트 라벨 겹침 ${ov}`, w) }
  }
  // ---------- ② portfolio integrated trajectory
  await go('portfolio')
  const chips = await p.textContent('[data-testid=ptraj-chips]')
  for (const m of ['TS', 'RAW', 'FPR']) { const g = agg(m, 'base', 'base'); ok(chips.includes(`${m} 유효 ${g.n}/53`), `[${w}] ② ${m} 유효 ${g.n}/53 표시`, w) }
  for (const [scen, lab] of [['base', 'Base'], ['high', 'High'], ['low', 'Low']]) {
    await p.click(`[data-testid=portfolio-trajectory] [role=radiogroup][aria-label="시나리오"] button:has-text("${lab}")`); await p.waitForTimeout(250)
    const bx = await texts('[data-testid=ptraj-main] svg'); charts++
    const t = bx.map(r => r.t)
    for (const m of ['TS', 'RAW', 'FPR']) { const g = agg(m, scen, 'base'); ok(t.includes(`${m} ${eok(g.v26)}`) && t.includes(`${m} ${eok(g.v31)}`), `[${w}] ② ${scen} ${m} 끝값 = 동일 고객 합계 ${eok(g.v26)} → ${eok(g.v31)}`, w) }
    const ov = overlaps(bx); overlapTotal += ov; ok(ov === 0, `[${w}] ② ${scen} 주 차트 라벨 겹침 ${ov}`, w)
    const ax = await texts('[data-testid=ptraj-fpr-aux] svg'); charts++
    const ov2 = overlaps(ax); overlapTotal += ov2; ok(ov2 === 0 && ax.some(r => r.t === `FPR ${eok(agg('FPR', scen, 'base').v31)}`), `[${w}] ② ${scen} FPR 보조 차트 끝값·겹침 ${ov2}`, w)
  }
  await p.click('[data-testid=portfolio-trajectory] [role=radiogroup][aria-label="시나리오"] button:has-text("Base")')
  await p.click('[data-testid=portfolio-trajectory] [role=radiogroup][aria-label="케이스"] button:has-text("Strategic Expansion")'); await p.waitForTimeout(250)
  { const t = (await texts('[data-testid=ptraj-main] svg')).map(r => r.t); const g = agg('FPR', 'base', 'expansion'); ok(t.includes(`FPR ${eok(g.v31)}`), `[${w}] ② Strategic Expansion FPR 2031 = ${eok(g.v31)}`, w) }
  await p.click('[data-testid=portfolio-trajectory] [role=radiogroup][aria-label="케이스"] button:has-text("Base Case")')
  const before = await p.textContent('[data-testid=ptraj-chips]')
  await p.click('[data-testid=ex-overlap]'); await p.waitForTimeout(200)
  const after = await p.textContent('[data-testid=ptraj-chips]')
  const nB = Number(/FPR 유효 (\d+)/.exec(before)[1]), nA = Number(/FPR 유효 (\d+)/.exec(after)[1])
  ok(nA < nB && after.includes('제외'), `[${w}] ② 중복 위험 제외 시 FPR 유효 ${nB} → ${nA}`, w)
  await p.click('[data-testid=ex-overlap]')
  const tbl = await p.$$eval('[data-testid=ptraj-table] tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim())))
  ok(tbl.length === 3 && tbl.every(r => /\/53$/.test(r[1])) && tbl.every(r => r[8].length > 0), `[${w}] ② 부분합·연도별 합계·결측 구분 표`, w)
  const comp = await p.$$('[data-testid=ptraj-composition] li button')
  ok(comp.length === 10, `[${w}] ② 구성 추적 상위 10개사`, w)
  if (comp.length) { await comp[0].click(); await p.waitForTimeout(300); ok(await p.$('[data-testid=recon-panel]'), `[${w}] ② 구성 고객 클릭 → ① 고객 화면(근거 추적)`, w) }
  // ---------- ③ / ④ smoke at this width
  await go('strategy'); ok(await p.$('[data-testid=initiative-matrix]') && await p.$('[data-testid=initiative-card]'), `[${w}] ③ 매트릭스·과제 카드`, w)
  await go('overview'); ok(await p.$('[data-testid=verification-tasks]'), `[${w}] ④ 검증 과제 표`, w)
  const firstTab = await p.evaluate(() => { localStorage.clear(); return true })
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300)
  const active = await p.evaluate(() => JSON.parse(localStorage.getItem('tab') || '"account"'))
  ok(firstTab && active === 'account', `[${w}] 첫 화면 = ① 고객별 사업기회(④를 첫 탭으로 옮기지 않음)`, w)
}
if (SYNTH) {
  await p.setViewportSize({ width: 1440, height: 1000 })
  await go('account', 'KA03')
  const chips = await p.textContent('[data-testid=recon-chips]')
  ok(chips.includes('합성 테스트 데이터'), '[synth] 합성 데이터 경고 배지', 1440)
  const raw26 = await p.$$eval('[data-testid=ledger-table] tbody tr[data-key="RAW|2026|BASE|BASE_CASE"] td', tds => tds.map(t => t.textContent.trim()))
  ok(raw26[2]?.includes('사내 승인값') && raw26[1]?.includes('외부 모델'), `[synth] KA03 RAW 2026 공식 출처 전환(승인 선택) — '${raw26[1]}' / '${raw26[2]}'`, 1440)
  const ts26 = await p.$$eval('[data-testid=ledger-table] tbody tr[data-key="TS|2026|BASE|BASE_CASE"] td', tds => tds.map(t => t.textContent.trim()))
  ok(ts26[2]?.includes('외부 모델'), '[synth] 선택 없는 슬롯은 외부 모델 유지', 1440)
  const rec = await p.textContent('[data-testid=internal-fields]')
  ok(rec.includes('12,000 백만원') && rec.includes('합성') && rec.includes('격리'), '[synth] 원본값 그대로 표시·합성·격리 상태', 1440)
  ok(rec.includes('정합(±20%)') && rec.includes('비교 불가') && rec.includes('참고(정의 근사)'), '[synth] 정의 비교 가능성별 대사 판정', 1440)
}
ok(errs.length === 0, `페이지 오류 없음 ${errs.slice(0, 3).join(' | ')}`, 'all')
await b.close()
const res = { base, mode, synth: SYNTH, widths: WIDTHS, accounts: ACCS, n: checks.length, fail, charts_checked: charts, label_overlaps: overlapTotal, per_width: per, checks }
if (outJson) fs.writeFileSync(outJson, JSON.stringify(res, null, 2))
checks.filter(c => !c.ok).forEach(c => console.log('FAIL', c.msg))
console.log(JSON.stringify({ mode, synth: SYNTH, n: checks.length, fail, charts_checked: charts, label_overlaps: overlapTotal, per_width: per }))
process.exit(fail ? 1 : 0)
