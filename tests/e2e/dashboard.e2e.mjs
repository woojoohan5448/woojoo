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
// unknown account shows N/A not zero
await p.fill('input[aria-label="고객 검색"]', '농협은행'); await p.waitForTimeout(200)
await p.locator('aside[aria-label="고객 선택"] li button').first().click(); await p.waitForTimeout(400)
ok((await p.locator('main').innerText()).includes('미확인(UNKNOWN)'), 'unknown account shows UNKNOWN notice (no zero fill)')
for (const tab of ['Executive Portfolio', 'Strategic Opportunity', 'Data Quality', '관리자 입력', 'Methodology']) {
  await p.click(`nav button:has-text("${tab}")`); await p.waitForTimeout(400)
  ok((await p.locator('main').innerText()).length > 200, `tab renders: ${tab}`)
}
ok(errors.length === 0, `no page errors (${errors.join('; ')})`)
await b.close()
