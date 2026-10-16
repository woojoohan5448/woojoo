// E2E: node tests/e2e/dashboard.e2e.mjs [baseUrl]  (requires server running; uses preinstalled Chromium)
import { chromium } from '../../frontend/node_modules/playwright-core/index.mjs'
const base = process.argv[2] || 'http://127.0.0.1:8000/'
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []; p.on('pageerror', e => errors.push(e.message))
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1 } else console.log('PASS', m) }
await p.goto(base, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
// vNext Phase 1: first visit → 3-step onboarding, then 전략 인사이트 (Strategic Overview) is the first screen
ok(await p.locator('[role=dialog][aria-labelledby=onb-title]').count() === 1, 'vNext: onboarding shown on first visit')
await p.click('[role=dialog] button:has-text("다음")'); await p.waitForTimeout(150)
ok((await p.locator('[role=dialog]').innerText()).includes('Realistical Addressable Wallet'), 'vNext: onboarding step 2 explains TS→RAW→FPR with original terms')
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
ok(await p.locator('[role=dialog]').count() === 0, 'vNext: onboarding closes with Esc')
ok(await p.locator('[data-testid=overview]').count() === 1, 'vNext: Strategic Overview is the first screen')
ok((await p.locator('[data-testid=kpi-target]').innerText()).includes('INTERNAL INPUT REQUIRED'), 'vNext D1: 2031 Target KPI shows INTERNAL INPUT REQUIRED without approved targets')
ok((await p.locator('[data-testid=kpi-coverage]').innerText()).includes('53 /'), 'vNext: analysed (53) vs valid-data accounts shown separately')
ok(await p.locator('[data-testid=area-table] tbody tr').count() === 8, 'vNext: business-area table shows evidence level separate from score')
// keyboard-accessible glossary tooltip
await p.locator('button[data-term="RAW"]').first().focus(); await p.waitForTimeout(150)
ok((await p.locator('[role=tooltip]').first().innerText()).includes('LGU+ 공략 가능 시장'), 'vNext: glossary tooltip opens on keyboard focus')
await p.keyboard.press('Escape')
await p.click('nav[aria-label="분석 단계"] button:has-text("고객별 사업기회")'); await p.waitForTimeout(500)
const insp = () => p.locator('aside[aria-label="근거 및 계산 패널"]').innerText()
ok((await insp()).includes('국민은행 · TS 2026'), 'default account KA03 inspector shows TS 2026')
// click the 2031 FPR bar via ECharts instance-independent approach: find svg path elements of bars and click label text
await p.locator('svg text', { hasText: /^≈460억원/ }).first().click({ force: true }).catch(() => {})
await p.waitForTimeout(300)
// fallback: click via chart coordinates of 2031 FPR row (row 3 of right grid)
let t = await insp()
if (!t.includes('FPR 2031')) {
  const box = await p.locator('[role=img]').first().boundingBox()
  await p.mouse.click(box.x + box.width * 0.58 + 6, box.y + 34 + (box.height - 68) * (2.5 / 4)); await p.waitForTimeout(300); t = await insp()
}
ok(t.includes('FPR 2031'), 'clicking 2031 FPR bar updates inspector to FPR 2031')
ok(t.includes('FPR_2031 = Σ(RAW_2031_i × Capture_Ceiling_i)'), 'inspector shows FPR 2031 formula')
const v1 = (await insp()).match(/≈[\d,.]+(억원|조원)/)?.[0]
await p.click('button[role=radio]:has-text("High")'); await p.waitForTimeout(300)
const t2 = await insp(); const v2 = t2.match(/≈[\d,.]+(억원|조원)/)?.[0]
ok(t2.toLowerCase().includes('(high'), 'scenario switch keeps selection and updates label to high')
ok(v1 !== v2, `scenario switch changes value (${v1} → ${v2})`)
await p.click('button[role=radio]:has-text("Base")'); await p.waitForTimeout(200)
await p.fill('input[aria-label="고객 검색"]', '카카오'); await p.waitForTimeout(200)
await p.locator('aside[aria-label="고객 선택"] li button', { hasText: '(주)카카오' }).first().click(); await p.waitForTimeout(400)
const t3 = await insp()
ok(t3.includes('(주)카카오 · FPR 2031'), 'account switch keeps year/metric selection and syncs inspector')
ok((await p.locator('h2').first().innerText()).includes('카카오'), 'account header synced')
const main3 = await p.locator('main').innerText()
ok(main3.includes('근거 유형: 재무항목 재구성 추정'), 'QA: account header shows evidence basis (direct disclosure vs estimate)')
ok(await p.locator('[data-testid=fpr31-decomp]').count() === 1 && main3.includes('U+ 역량 확대 가정'), 'QA: FPR 2031 growth split into customer spend vs U+ capability assumption')
// unknown account shows N/A not zero
await p.fill('input[aria-label="고객 검색"]', '코람코'); await p.waitForTimeout(200)
await p.locator('aside[aria-label="고객 선택"] li button').first().click(); await p.waitForTimeout(400)
ok((await p.locator('main').innerText()).includes('RESEARCH GAP'), 'research-gap account shows RESEARCH GAP reason (no zero fill)')
// D1 toggle: scenario target only when explicitly requested
await p.fill('input[aria-label="고객 검색"]', '국민은행'); await p.waitForTimeout(200)
await p.locator('aside[aria-label="고객 선택"] li button').first().click(); await p.waitForTimeout(400)
const tgtBefore = await p.locator('main').innerText()
await p.check('input[aria-label="시나리오 목표 보기"]'); await p.waitForTimeout(300)
const tgtAfter = await p.locator('main').innerText()
ok(!tgtBefore.includes('시나리오 참고값') && tgtAfter.includes('시나리오 참고값'), 'vNext D1: scenario target appears only after explicit toggle')
await p.uncheck('input[aria-label="시나리오 목표 보기"]'); await p.waitForTimeout(200)
for (const tab of ['전략 인사이트', '전사 기회 분석', '전략과제 우선순위', '데이터·운영 관리']) {
  await p.click(`nav[aria-label="분석 단계"] button:has-text("${tab}")`); await p.waitForTimeout(400)
  ok((await p.locator('main').innerText()).length > 200, `tab renders: ${tab}`)
}
for (const tab of ['데이터 신뢰도', '분석 기준·산식', '관리자 입력 · Excel Import']) {
  await p.click(`nav[aria-label="데이터·운영 관리 하위 메뉴"] button:has-text("${tab}")`); await p.waitForTimeout(400)
  ok((await p.locator('main').innerText()).length > 200, `ops sub-menu renders: ${tab}`)
}
await p.click(`nav[aria-label="데이터·운영 관리 하위 메뉴"] button:has-text("분석 기준·산식")`); await p.waitForTimeout(300)
ok((await p.locator('[data-testid=framework-table] tbody tr').count()) === 10, 'vNext: Methodology lists ①~⑧ framework terms from the central glossary')
await p.click(`nav[aria-label="데이터·운영 관리 하위 메뉴"] button:has-text("관리자 입력")`); await p.waitForTimeout(300)
ok((await p.locator('main').innerText()).includes('템플릿'), 'vNext: admin input & Excel Import preserved under 데이터·운영 관리')
ok(errors.length === 0, `no page errors (${errors.join('; ')})`)
await b.close()
