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
// vNext correction: first screen = ① 고객별 사업기회 (AS-IS); AS-IS/TO-BE groups in the menu
ok((await p.locator('[data-testid=tab-purpose]').innerText()).includes('① 고객별 사업기회'), 'vNext-C: first screen is ① 고객별 사업기회 with purpose line')
ok(await p.locator('nav[aria-label="분석 단계"] [role=group][aria-label^="AS-IS"] button').count() === 2 && await p.locator('nav[aria-label="분석 단계"] [role=group][aria-label^="TO-BE"] button').count() === 2, 'vNext-C: menu groups AS-IS (①②) and TO-BE (③④)')
const order = (await p.locator('nav[aria-label="분석 단계"] button').allInnerTexts()).map(t => t.replace(/\s+/g, ''))
ok(order.join('|') === '①고객별사업기회|②전사기회분석|③전략과제도출|④전략적시사점|⑤데이터·운영관리', `vNext-C: menu order ${order.join('|')}`)
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
for (const tab of ['전사 기회 분석', '전략과제 도출', '전략적 시사점', '데이터·운영 관리']) {
  await p.click(`nav[aria-label="분석 단계"] button:has-text("${tab}")`); await p.waitForTimeout(400)
  ok((await p.locator('main').innerText()).length > 200, `tab renders: ${tab}`)
}
await p.click('nav[aria-label="분석 단계"] button:has-text("전략과제 도출")'); await p.waitForTimeout(300)
ok((await p.locator('[data-testid=derivation-flow]').innerText()).includes('Demand Evidence'), 'vNext-C: ③ shows Opportunity Pool → Demand Evidence → Capability Gap → Strategic Initiative')
await p.click('nav[aria-label="분석 단계"] button:has-text("전략적 시사점")'); await p.waitForTimeout(400)
ok(await p.locator('[data-testid=overview]').count() === 1, 'vNext-C: former Strategic Overview lives in ④ 전략적 시사점')
ok((await p.locator('[data-testid=kpi-target]').innerText()).includes('사내 목표 미입력'), 'vNext D1: Target KPI shows 사내 목표 미입력 without approved targets')
ok((await p.locator('[data-testid=kpi-coverage]').innerText()).includes('53 /'), 'vNext: analysed (53) vs valid-data accounts shown separately')
ok(await p.locator('[data-testid=area-table] tbody tr').count() === 8, 'vNext: business-area table shows evidence level separate from score')
ok(await p.locator('[data-testid=decisions] li').count() >= 4, 'vNext-C: ④ lists management decisions required')
await p.locator('button[data-term="RAW"]').first().focus(); await p.waitForTimeout(150)
ok((await p.locator('[role=tooltip]').first().innerText()).includes('LGU+ 공략 가능 시장'), 'vNext: glossary tooltip opens on keyboard focus')
await p.keyboard.press('Escape')
await p.click('nav[aria-label="분석 단계"] button:has-text("데이터·운영 관리")'); await p.waitForTimeout(300)
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
