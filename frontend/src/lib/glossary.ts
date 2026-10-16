/**
 * Central glossary (vNext §7.5) — single source for KPI labels, tooltips, Methodology and the Inspector.
 * The ①~⑧ English terms are the author's (판서자) original wording and are preserved verbatim
 * (incl. "Realistical"). Korean meanings are added alongside. Data field / API keys are NOT renamed:
 * `fieldKeys` documents which existing keys each term maps to.
 */
export interface Term {
  code: string
  no?: string            // ①~⑧ numbering (framework terms only)
  en: string             // preserved English name
  abbr?: string          // short label for narrow legends
  ko: string             // Korean meaning (병기)
  definition: string     // plain-language definition
  purpose: string        // why the metric exists
  formula?: string       // formula or decision rule
  caution?: string       // how not to misread it
  fieldKeys?: string[]   // existing data keys (unchanged)
}

export const FRAMEWORK: Term[] = [
  { code: 'TS', no: '①', en: 'Customer Total IT Spending', abbr: 'TS', ko: '고객 전체 IT 지출액',
    definition: '고객의 전체 IT/ICT 지출 규모. LGU+가 판매할 수 없는 영역(내부 IT 인건비 등)도 포함합니다.',
    purpose: '고객의 전체 시장 규모를 파악하는 출발점입니다.',
    formula: '공시 IT 투자액, 감사보고서 IT 비용 재구성, 산업 평균 IT 집약도 중 근거가 가장 강한 방법으로 산정(고객별 근거 유형 표시)',
    caution: '대부분 추정치입니다. IT 지출을 1차 원문에서 직접 확인한 고객은 현재 없으며, 근거 유형 배지를 함께 확인하세요.',
    fieldKeys: ['m.2026.TS', 'm.2031.<scenario>.TS'] },
  { code: 'RAW', no: '②', en: 'Realistical Addressable Wallet', abbr: 'RAW', ko: 'LGU+ 공략 가능 시장',
    definition: '고객 TS 중 LGU+가 현재 또는 향후 역량으로 현실적으로 공략할 수 있는 영역(Connectivity, IDC, Cloud, Security, AI 등).',
    purpose: '판매할 수 없는 영역(내부 개발, Captive SI, 구조적으로 판매 불가한 HW/SW)을 걸러 실제 경쟁 무대를 정의합니다.',
    formula: 'RAW = Σ(카테고리별 TS × 접근 가능률) · RAW ≤ TS',
    caution: '"Realistical"은 판서자 원문 표기입니다. 카테고리 비중은 대부분 업종 기본 가정(A-MIX)이며 고객별 근거로 확인된 비중은 일부입니다.',
    fieldKeys: ['m.2026.RAW', 'm.2031.<scenario>.RAW_base', 'm.2031.<scenario>.RAW_expansion'] },
  { code: 'FPR', no: '③', en: 'U+ Full Potential Revenue', abbr: 'FPR', ko: '최대 확보 가능 매출',
    definition: 'RAW 중 경쟁사·기존 공급자·계약 구조·고객 관계·LGU+ 경쟁력을 고려할 때 LGU+가 현실적으로 최대 확보할 수 있는 매출.',
    purpose: '"얼마까지 가져올 수 있는가"의 상한을 제시합니다.',
    formula: 'FPR = Σ(카테고리별 RAW × 현실적 포획 상한) · FPR ≤ RAW',
    caution: '목표가 아니라 상한입니다. 포획 상한은 이중망·멀티벤더 관행을 반영한 기본값입니다.',
    fieldKeys: ['m.2026.FPR', 'm.2031.<scenario>.FPR_base', 'm.2031.<scenario>.FPR_expansion'] },
  { code: 'CR', no: '④', en: 'Current Revenue', abbr: 'CR', ko: '현재 매출',
    definition: '해당 고객으로부터 LGU+가 현재 확보하고 있는 매출(사내 실적 기준).',
    purpose: '현재 위치를 확인하는 기준점입니다.',
    formula: '사내 실적(승인된 INTERNAL_ACTUAL 레이어). 실제 매출 데이터가 없으면 N/A',
    caution: '추정값으로 대체하지 않습니다. 미입력은 0이 아니라 사내 입력 필요(INTERNAL_REQUIRED)입니다.',
    fieldKeys: ['m.2026.CR'] },
  { code: 'CSOW', no: '⑤-1', en: 'Current Share of Wallet', abbr: 'C-SOW', ko: '현재 시장 점유율',
    definition: '공략 가능 시장(RAW) 중 현재 확보한 비중.',
    purpose: '공략 가능 시장에서의 현재 점유 수준을 봅니다.',
    formula: 'C-SOW = Current Revenue / RAW',
    caution: 'CR이 없거나 RAW가 0·미확인이면 산출하지 않습니다.', fieldKeys: ['m.2026.CSOW'] },
  { code: 'PCR', no: '⑤-2', en: 'Potential Capture Rate', abbr: 'PCR', ko: '최대 잠재매출 대비 현재 확보율',
    definition: '최대 확보 가능 매출(FPR) 대비 현재 매출의 비율.',
    purpose: '현실적 상한 대비 얼마나 확보했는지 봅니다.',
    formula: 'Potential Capture Rate = Current Revenue / FPR',
    caution: '분모가 0이거나 미확인이면 산출하지 않습니다.', fieldKeys: ['m.2026.PCR'] },
  { code: 'UPSIDE', no: '⑥', en: 'Upside Potential Revenue', abbr: 'Upside', ko: '추가 확보 가능 매출',
    definition: 'FPR에서 현재 매출을 뺀 추가 확보 여지.',
    purpose: '성장 여력의 크기를 보여줍니다.',
    formula: 'Upside = FPR − Current Revenue (같은 기준 연도)',
    caution: '음수이면 0으로 바꾸지 않습니다 — 데이터 정의나 FPR 가정을 검증해야 한다는 신호입니다.', fieldKeys: ['m.2026.UPSIDE', 'm.target.UPSIDE_2031'] },
  { code: 'Y2031', no: '⑦', en: '2031 TS / RAW / FPR', abbr: '2031', ko: '2031년 시장 및 매출 잠재력 전망',
    definition: '2031년 고객 전체 IT 지출, LGU+ 공략 가능 시장, 최대 확보 가능 매출 전망.',
    purpose: '5년 뒤 기회의 크기와 성장 동인을 봅니다.',
    formula: 'TS_2031 = TS_2026 + 자연성장 + 클라우드 + AI + 인프라 + 규제 − 효율화 − 대체 (Low/Base/High) → RAW·FPR 동일 방식',
    caution: '전망치입니다. 성장분 일부는 배분 가정(B-ALLOC)에 의존하며, 2026 추정 오차가 2031로 그대로 전파됩니다.',
    fieldKeys: ['m.2031.<scenario>.*'] },
  { code: 'TARGET', no: '⑧', en: '2031 Target Revenue', abbr: 'Target', ko: '2031년 목표 매출',
    definition: 'Account Plan에서 실제로 달성하기로 설정·승인된 2031년 매출 목표.',
    purpose: '경영 목표와 잠재력(FPR)의 관계를 봅니다.',
    formula: '경영진 승인 목표(MANAGEMENT_TARGET 레이어) · 2031 Target ≤ 2031 FPR',
    caution: '승인된 목표가 없으면 사내 입력 필요(INTERNAL_REQUIRED)입니다. FPR×50% 시나리오 값은 참고용이며 공식 KPI·합계에 포함하지 않습니다. 2026 CR과 한 시계열로 보지 마세요.',
    fieldKeys: ['m.target.TARGET'] },
  { code: 'TARGET_SOW', no: '⑧', en: '2031 Target SOW', abbr: 'Target SOW', ko: '2031년 목표 시장 점유율',
    definition: '2031 공략 가능 시장(RAW) 대비 목표 매출의 비중.',
    purpose: '목표가 현재보다 점유를 높이는 방향인지 확인합니다.',
    formula: 'Target SOW = 2031 Target Revenue / 2031 RAW · 전략 방향: Target SOW > Current C-SOW',
    caution: 'Target SOW ≤ C-SOW는 데이터 오류가 아니라 목표 적정성 검토 사항입니다.', fieldKeys: ['m.target.TARGET_SOW'] },
]

/** Supporting terms (not part of ①~⑧ but used across screens). */
export const SUPPORT: Term[] = [
  { code: 'EVIDENCE_TIER', en: 'Evidence Tier', ko: '사업기회 근거 수준',
    definition: '고객×사업영역 기회의 근거 성격. 금액(모델 산출값)과 별개로 표시합니다.',
    purpose: '어느 기회가 고객별 원천 근거로 뒷받침되는지 구분합니다.',
    formula: 'Evidence-based: 해당 영역의 고객별 관측(수요 신호·고객별 비중·기존 공급자 관찰) 1건 이상 → Model-estimated: 관측은 없지만 고객 TS가 자체 근거(공시·재무) 기반 → Unverified: 그 외(산업 평균·시나리오·계약만)',
    caution: 'Evidence-based도 금액은 모델 추정치입니다. "근거가 있다"는 수요의 존재가 관측됐다는 뜻이지 금액이 확인됐다는 뜻이 아닙니다.' },
  { code: 'EVIDENCE_LEVEL', en: 'Evidence Level', ko: '영역 근거 충분성',
    definition: '사업영역 FPR 2031 중 Evidence-based 비중과 근거 고객 수로 판정한 근거 충분성.',
    purpose: '전략 점수(매력도)와 분리된 "근거가 충분한가" 지표입니다.',
    formula: '충분: 비중 ≥ 50% 그리고 근거 고객 ≥ 5 · 일부: 비중 ≥ 25% · 부족: 그 외',
    caution: '근거가 충분하지 않은 영역의 권고는 "검토 가설"로만 표시합니다(확정 투자 권고 아님).' },
  { code: 'ASSUMPTION_DEP', en: 'Assumption Dependency', ko: '가정 의존도',
    definition: '2026→2031 TS 증가분 중 브리지 배분 가정(B-ALLOC)에서 생긴 비중.',
    purpose: '성장 전망이 고객 수요가 아닌 가정에서 얼마나 나오는지 보여줍니다.',
    formula: '(TS_2031 − TS_2026×(1+자연성장률)^5 − 계정별 인프라 동인) ÷ (TS_2031 − TS_2026)',
    caution: '값이 높을수록 민감도 분석·고객 수요 검증 전까지 우선순위를 확정하지 말아야 합니다. 음수는 가정이 감소 방향(효율화·대체)이라는 뜻입니다.' },
  { code: 'PRIORITY_SCORE', en: 'Priority Score (v1 기준안)', ko: '전략 매력도 점수',
    definition: '기존 Strategic Opportunity Engine 점수(0~100).',
    purpose: '사업영역의 상대적 매력도를 비교합니다.',
    formula: '35×규모 + 20×성장률 + 15×수요 고객 수 + 15×진입 가능성 + 15×수요 신뢰도 − 실행 난이도',
    caution: '높은 점수가 충분한 근거를 뜻하지 않습니다. 근거 수준·가정 의존도를 함께 보세요. 가중치 확정은 경영진 의사결정 사항입니다.' },
  { code: 'DEMAND_ACCOUNTS', en: 'Demand Accounts (model vs observed)', ko: '수요 고객 수(모델 vs 관측)',
    definition: '모델 수요 고객 = 해당 영역 FPR 2031이 1억 이상인 고객(업종 믹스가 모든 고객에 적용되어 대부분 포함). 관측 수요 고객 = 고객별 수요 신호(투자·차세대·규제 등)가 기록된 고객.',
    purpose: '"모델상 존재하는 수요"와 "실제로 관측된 수요"를 구분합니다.',
    caution: '수요 신호가 없다고 기회가 0인 것은 아닙니다(관측되지 않았을 뿐).' },
  { code: 'GRADE', en: 'Estimate Grade', ko: '추정 등급',
    definition: 'HIGH / MEDIUM / LOW CONFIDENCE — 추정 근거의 강도.',
    purpose: '추정값을 확인값처럼 읽지 않도록 합니다.',
    formula: 'HIGH: FY2024+ 공시·예산 직접 보고 · MEDIUM: 재무항목 재구성·자사 비율 · LOW: 산업 평균·시나리오. RAW/FPR은 한 단계, 2031은 추가 한 단계 낮춤',
    caution: 'VERIFIED는 원천 재무 사실에만 사용합니다.' },
  { code: 'PARTIAL_SUM', en: 'Partial Sum', ko: '부분합',
    definition: '근거가 있는 고객만 더한 합계. 정의가 다른 5개사(하이퍼스케일러·망 이용대가 환산)와 미산출 고객은 제외됩니다.',
    purpose: '합계가 53개사 전체가 아님을 명시합니다.',
    caution: '확정된 전사 목표나 시장 규모로 인용하지 마세요.' },
]

export const GLOSSARY: Record<string, Term> = Object.fromEntries([...FRAMEWORK, ...SUPPORT].map(t => [t.code, t]))

/** Label variants (§7.2): full = concept screens, kpi = KPI cards, short = narrow legends. */
export function termLabel(code: string, variant: 'full' | 'kpi' | 'short' = 'kpi'): string {
  const t = GLOSSARY[code]
  if (!t) return code
  if (variant === 'short') return t.abbr ?? t.code
  if (variant === 'kpi') return `${t.abbr ?? t.code} (${t.ko})`
  return `${t.no ? t.no + ' ' : ''}${t.en}${t.abbr ? ` (${t.abbr})` : ''} (${t.ko})`
}
