import type { MetricRec, Status } from '../types'

/**
 * Display precision follows evidential strength — never show estimated numbers more precisely than they are.
 * VERIFIED/DERIVED: 1억 단위. ESTIMATED/SCENARIO: 유효숫자 2자리.
 */
export function roundForStatus(v: number, status: Status): number {
  if (status === 'VERIFIED' || status === 'DERIVED') return Math.round(v)
  if (v === 0) return 0
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1)
  return Math.round(v / mag) * mag
}

export function eok(v: number | null | undefined, status: Status = 'VERIFIED', opts: { approx?: boolean } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A'
  const r = roundForStatus(v, status)
  const approx = opts.approx !== false && (status === 'ESTIMATED' || status === 'SCENARIO') ? '≈' : ''
  if (Math.abs(r) >= 10000) return `${approx}${(r / 10000).toLocaleString('ko-KR', { maximumFractionDigits: r % 10000 === 0 ? 0 : 2 })}조원`
  return `${approx}${r.toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(r) < 10 ? 1 : 0 })}억원`
}

export function fmtRec(r: MetricRec | undefined | null): string {
  if (!r || r.value === null) return 'N/A'
  if (r.unit === '%') return pct(r.value)
  return eok(r.value, r.status)
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A'
  return `${(v * 100).toFixed(digits)}%`
}

export function signedEok(v: number | null | undefined, status: Status = 'ESTIMATED'): string {
  if (v === null || v === undefined) return 'N/A'
  return (v >= 0 ? '+' : '−') + eok(Math.abs(v), status, { approx: false })
}

export const STATUS_LABEL: Record<Status, string> = {
  VERIFIED: '실측', DERIVED: '파생', ESTIMATED: '추정', SCENARIO: '시나리오', UNKNOWN: '미확인',
}

export const CAT_LABEL: Record<string, string> = {
  CONNECTIVITY: 'Connectivity', DC_COLO: 'Data Center/IDC', CLOUD: 'Cloud', AI_INFRA: 'AI Infra', SECURITY: 'Security',
  SI_BUILD: 'SI/AX 구축', IT_OPS: 'IT 운영', SW_LICENSE: 'SW/License', HW_DEVICE: 'HW/Device', INTERNAL_LABOR: '내부 IT 인건비',
}

export const SEGMENT_LABEL: Record<string, string> = {
  BANK: '은행', CARD: '카드', SECURITIES: '증권', INSURANCE: '보험', FIN_INFRA: '금융 인프라', FIN_COOP: '상호금융',
  FINTECH: '핀테크', IT_SERVICE: 'IT서비스/SI', DEFENSE_ICT: '방산 ICT', INTERNET_PLATFORM: '인터넷 플랫폼',
  CLOUD_DOMESTIC: '국내 클라우드/IDC', HYPERSCALER: '하이퍼스케일러', GLOBAL_TECH: '글로벌 테크', GLOBAL_CARRIER: '글로벌 통신사',
  MANUFACTURING: '제조', AUTO_IMPORT: '수입차', RETAIL: '유통', SECURITY_SERVICES: '보안서비스', PUBLIC_UTILITY: '공공(에너지)',
  DEFENSE_SPECIAL: '국방(특수)', RE_FUND: '부동산·DC 펀드',
}

export const RESEARCH_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: '미착수', ENTITY_RESOLVED: '법인 식별', SOURCES_COLLECTED: '자료 수집', MODEL_ESTIMATED: '모델 추정',
  EVIDENCE_VERIFIED: 'IT지출 원문 확인', INPUTS_VERIFIED: '입력 재무항목 원문 확인(TS는 추정)', QUALITY_APPROVED: '품질 승인', NEEDS_REVIEW: '검토 필요',
}

/** What the 2026 TS actually rests on (QA-01): a verified input is not a verified IT-spending figure. */
export const EVIDENCE_BASIS_LABEL: Record<string, string> = {
  DIRECT_IT_DISCLOSURE: 'IT지출 공시값', RECONSTRUCTED_FINANCIALS: '재무항목 재구성 추정', INDUSTRY_AVERAGE: '산업 평균 적용 추정',
  SCENARIO: '시나리오', CONTRACT_DIRECT_RAW: '계약 기반(RAW만)', NONE: '근거 없음',
}
export const SOURCE_LEVEL_LABEL: Record<string, string> = {
  PRIMARY: '원문 확인', SECONDARY_PRESS: 'KISA 공시값 언론 인용 — 원문 대조 전', PRIMARY_INPUTS: '입력 항목 원문 확인', SECONDARY_INPUTS: '입력 항목 2차 출처',
  BENCHMARK: '벤치마크', MIXED: '혼합', SECONDARY: '2차 출처', '-': '',
}

/** English metric names come from the central glossary (판서자 원문, e.g. "Realistical"). Keys unchanged. */
export const METRIC_LABEL: Record<string, string> = {
  TS: `${GLOSSARY.TS.en} (${GLOSSARY.TS.ko})`, RAW: `${GLOSSARY.RAW.en} (${GLOSSARY.RAW.ko})`, FPR: `${GLOSSARY.FPR.en} (${GLOSSARY.FPR.ko})`,
  CR: `${GLOSSARY.CR.en} (${GLOSSARY.CR.ko})`, TARGET: `${GLOSSARY.TARGET.en} (${GLOSSARY.TARGET.ko})`, REV: 'Revenue',
  CSOW: `${GLOSSARY.CSOW.en} (${GLOSSARY.CSOW.ko})`, PCR: `${GLOSSARY.PCR.en} (${GLOSSARY.PCR.ko})`,
  UPSIDE: `${GLOSSARY.UPSIDE.en} (${GLOSSARY.UPSIDE.ko})`, TARGET_SOW: `${GLOSSARY.TARGET_SOW.en} (${GLOSSARY.TARGET_SOW.ko})`,
  TS_CAGR: 'TS CAGR', RAW_CAGR: 'RAW CAGR', FPR_CAGR: 'FPR CAGR',
}

import type { Account, NAClass, Selection } from '../types'
import { GLOSSARY } from './glossary'

export const NA_LABEL: Record<string, string> = {
  INTERNAL_REQUIRED: 'INTERNAL INPUT REQUIRED', INSUFFICIENT_EVIDENCE: 'RESEARCH GAP', NOT_APPLICABLE: 'NOT APPLICABLE', ERROR: 'VALIDATION ERROR',
}
export const NA_KO: Record<string, string> = {
  INTERNAL_REQUIRED: '사내 데이터 입력 대기', INSUFFICIENT_EVIDENCE: '근거 부족(조사 공백)', NOT_APPLICABLE: '지표 비적용', ERROR: '검증 오류',
}
export const GRADE_LABEL: Record<string, string> = {
  ESTIMATED_HIGH: 'HIGH', ESTIMATED_MEDIUM: 'MEDIUM', ESTIMATED_LOW: 'LOW CONFIDENCE', VERIFIED: 'VERIFIED', DERIVED: 'DERIVED',
}

/** na_class key for a selection (CR↔REV 2026, TARGET↔REV 2031). */
export function naKey(sel: Pick<Selection, 'year' | 'metric'>): string {
  const m = sel.metric === 'REV' ? (sel.year === 2026 ? 'CR' : 'TARGET') : sel.metric
  return `${sel.year}|${m}`
}
export function naInfo(a: Account, sel: Pick<Selection, 'year' | 'metric'>): { class: NAClass; reason: string } | null {
  return a.na_class?.[naKey(sel)] ?? null
}
/** Text for a missing value: never a bare N/A — always the reason class. */
export function missingText(a: Account, sel: Pick<Selection, 'year' | 'metric'>, fallback = 'N/A'): string {
  const n = naInfo(a, sel)
  return n && NA_LABEL[n.class] ? NA_LABEL[n.class] : fallback
}

export const TIER_LABEL: Record<string, string> = { EVIDENCE_BASED: 'Evidence-based (근거 확인)', MODEL_ESTIMATED: 'Model-estimated (모델 추정)', UNVERIFIED: 'Unverified (검증 근거 부족)' }
export const LEVEL_LABEL: Record<string, string> = { SUFFICIENT: '근거 충분', PARTIAL: '근거 일부', INSUFFICIENT: '근거 부족' }
