export type Status = 'VERIFIED' | 'DERIVED' | 'ESTIMATED' | 'SCENARIO' | 'UNKNOWN'
export type Grade = 'ESTIMATED_HIGH' | 'ESTIMATED_MEDIUM' | 'ESTIMATED_LOW'
export type NAClass = 'VERIFIED' | 'DERIVED' | Grade | 'INTERNAL_REQUIRED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_APPLICABLE' | 'ERROR'
export type Scenario = 'low' | 'base' | 'high'
export type AddrCase = 'base' | 'expansion'
export type Category =
  | 'CONNECTIVITY' | 'DC_COLO' | 'CLOUD' | 'AI_INFRA' | 'SECURITY' | 'SI_BUILD' | 'IT_OPS' | 'SW_LICENSE' | 'HW_DEVICE' | 'INTERNAL_LABOR'

export interface Input { name: string; value: string | null; unit?: string; fiscal_year?: number; scope?: string; evidence_ids?: string[]; fact_status?: string; assumption_id?: string }
export interface MetricRec {
  value: number | null; low: number | null; high: number | null; status: Status; confidence: number
  formula: string; inputs: Input[]; evidence_ids: string[]; assumption_ids: string[]; notes: string[]; unit: string
  by_cat?: Record<Category, number> | null
  grade?: Grade
  target_source?: 'MANAGEMENT_APPROVED' | 'SCENARIO_FPR_ATTAINMENT' | null
  masked?: boolean
}
export interface Bridge { components: Record<string, number>; params: Record<string, number | string>; clamped: string[]; organic_cagr?: number }
export interface Block2031 {
  TS: MetricRec; RAW_base: MetricRec; RAW_expansion: MetricRec; FPR_base: MetricRec; FPR_expansion: MetricRec
  FPR_const_capability?: MetricRec
  TS_CAGR: MetricRec; RAW_CAGR: MetricRec; FPR_CAGR: MetricRec; bridge: Bridge | null
}
export interface Evidence {
  evidence_id: string; tier: number; source_type: string; source_title: string; publisher: string; source_url: string
  document_id?: string | null; publication_date?: string; accessed_at?: string; fiscal_period?: string; page_or_section?: string
  quoted_statement?: string; reported_value?: string; reported_unit?: string; verification_status: string; notes?: string; source_hash?: string
}
export interface Issue { account_id: string; severity: 'ERROR' | 'WARN' | 'INFO'; code: string; message: string; metric?: string | null; year?: number | null; scenario?: string | null }
export interface Fact { fact_id: string; metric: string; fiscal_year: number | null; value: number | string; unit: string; scope?: string; verification_status: string; evidence_ids: string[]; analyst_interpretation?: string }
export interface Driver { driver_id: string; type: string; description: string; amount?: number | null; unit?: string; period?: string; direction?: string; evidence_ids?: string[] }
export interface Competitive { category: string; observation: string; incumbent?: string | null; lgu_relationship?: string | null; evidence_ids?: string[] }
export interface Entity {
  legal_name_ko?: string; legal_name_en?: string; corp_code?: string | null; stock_code?: string | null; parent_group?: string
  related_key_accounts?: string[]; industry_detail?: string; is_korean_entity?: boolean; dart_available?: boolean
  economic_scope?: string; exclusions?: string; entity_status?: string; entity_notes?: string; fiscal_year_end?: string
}
export interface Account {
  account_id: string; original_name: string; segment: string; family: string; pilot: boolean
  entity: Entity; overlap_groups: string[]; research_status: string; aggregate_class: string
  evidence_basis?: { basis: string; source_level: string; definition_mismatch: boolean }
  anchor: { method: string; fiscal_year: number | null; value: number | null; fact_status: string; evidence_ids: string[]; tier: number | null; formula: string; inputs: Input[]; definition_note?: string; alternatives?: { method: string; fiscal_year: number; value: string }[]; coverage_basis?: string; note?: string }
  conf_parts: Record<string, number>; mix: Record<Category, number>; rates_2026: Record<Category, number>; caps_2026: Record<Category, number>
  sec_ratio: number | null
  m: { '2026': Record<'TS' | 'RAW' | 'FPR' | 'CR' | 'CSOW' | 'PCR' | 'UPSIDE', MetricRec>; '2031': Record<Scenario, Block2031>; target: Record<'TARGET' | 'TARGET_SOW' | 'UPSIDE_2031' | 'TARGET_INCREMENT', MetricRec> }
  narrative: Record<string, string | string[]>; issues: Issue[]; evidence: Evidence[]; facts: Fact[]; drivers: Driver[]; competitive: Competitive[]
  open_questions: string[]; override_notes: string[]; infra_drivers: unknown[];
  na_class: Record<string, { class: NAClass; reason: string }>
  conflicts?: { existing_fact_id?: string; existing_value?: unknown; new_value?: unknown; unit?: string; explanation?: string; evidence_ids?: string[] }[]
  comparables?: { peer_account_or_company?: string; metric?: string; value?: unknown; unit?: string; why_comparable?: string }[]
  estimation_inputs?: { name?: string; value?: unknown; unit?: string; basis?: string; evidence_ids?: string[] }[]
  area_evidence?: Record<string, AccountAreaEvidence>
  reconciliation?: Reconciliation | null; research_log: { step: string; target: string; result: string; detail: string }[]
}
export interface AggRow { TS: number; RAW: number; FPR: number; TARGET: number | null; n_ts: number; n_raw: number; n_fpr: number; n_mismatch: number; excluded: string[]
  TARGET_scenario?: number; n_target_approved?: number; n_target_scenario?: number }
export interface DimRow { TS_2026: number; RAW_2026: number; FPR_2026: number; TS_2031: number; RAW_2031: number; FPR_2031: number; n: number; n_est: number; conf_sum: number }
export interface StrategyRow {
  area: string; categories: Category[]; RAW_2026: number; FPR_2026: number; RAW_2031: number; FPR_2031: number; FPR_2031_expansion: number; FPR_2031_high: number
  FPR_CAGR: number | null; n_accounts: number; FPR_2031_definition_mismatch: number; mismatch_accounts: string[]; demand_confidence: number; top_accounts: { account_id: string; FPR_2031: number }[]
  lgu_position?: string; entry_feasibility?: string; competition?: string; required_capabilities?: string; capability_gap?: string
  investment_need?: string; difficulty?: string; recommendation?: string; recommendation_type?: string; evidence_refs?: string[]; caveats?: string
  priority_score: number; score_formula: string
  evidence?: AreaEvidence
}
export type EvidenceTier = 'EVIDENCE_BASED' | 'MODEL_ESTIMATED' | 'UNVERIFIED'
export interface AreaEvidence {
  n_accounts_model: number; n_accounts_signal: number; n_accounts_incumbent_obs: number; n_accounts_specific_share: number
  fpr2031_by_tier: Record<EvidenceTier, number>; accounts_by_tier: Record<EvidenceTier, string[]>
  evidence_share: number | null; evidence_level: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT'
  signals: { account_id: string; signal_id: string; type: string; description: string; period?: string; evidence_ids: string[] }[]
  assumption_dependency: number | null; assumption_dependency_note: string; recommendation_mode: 'RECOMMENDATION' | 'HYPOTHESIS'
}
export interface AccountAreaEvidence { tier: EvidenceTier; value_basis: 'ACCOUNT_SPECIFIC_SHARE' | 'MODEL_ALLOCATED'; evidence_types: string[]; observation_ids: Record<string, string[]>; FPR_2031: number | null }
export interface Dashboard {
  meta: { coverage?: { current: Coverage; baseline: Coverage | null }; contains_internal_data?: boolean; internal_layers?: Record<string, number>; data_version: string; generated_at: string; unit: string; n_accounts: number; status_counts: Record<string, number>; metric_status_2026: Record<string, Record<string, number>>; fact_status: Record<string, number>; fx_usd_krw: number; is_test_data: boolean }
  params: any; parameter_evidence: Record<string, { basis: string; refs: string[]; comment: string }>
  intensity_calibration: Record<string, { basis: string; n: number; low: number; base: number; high: number; observations: { account_id: string; ratio: number; fy: number }[] }>
  market_benchmarks: { items: { item_id: string; topic: string; metric: string; value: number | string; unit: string; year: number; scope?: string; evidence_id: string }[]; evidence: Evidence[] }
  accounts: Account[]
  portfolio: { aggregate: Record<string, AggRow>; by_segment: Record<string, DimRow>; by_family: Record<string, DimRow>; overlap_groups: { group_id: string; name: string; members: string[]; risk: string; type: string; note: string }[] }
  strategy: StrategyRow[]
  issues_summary: Record<string, number>
  recon?: Recon
  initiatives?: Initiative[]
  priority_sensitivity?: PrioritySensitivity
}

/* Phase 3A — metric ledger & official-source selection (models/recon/ledger.py) */
export interface LedgerEntry {
  key: string; value_eok: number | null; official_source: 'EXTERNAL_MODEL' | 'INTERNAL_APPROVED' | null
  base_year: number | null; data_status: string | null; approval_status: string; evidence_ids: string[]; selection_id: string | null
  source_ref?: string; replaced_external_value?: number | null; scenario_reference?: { value_eok: number | null; status: string; note: string }
}
export interface InternalRec {
  record_id: string; measure_id: string; area_level: string; area_id: string; fiscal_year: number; period_type: string; case_id: string
  value_eok: string; raw: { value: string; unit: string; formula: string | null }; status: string; definition_ref: string; synthetic: boolean
  source_id: string; as_of: string; version: number; quarantined: boolean
}
export interface ReconRow { record_id: string; account_id: string; area: string; fiscal_year: number; internal_measure: string; internal_eok: string; status: string; external_measure: string; external_eok: string | null; comparability: string; judgement: string; diff_pct?: string; synthetic: boolean }
export interface Recon {
  contract_version: string; policy_version: string; mode: string
  policy: Record<string, { default_source: string; internal_candidates: string[]; fallback: string; pending?: string }>
  switch_requirements: string[]; n_internal_records: number; n_selections: number; n_switched: number; contains_synthetic: boolean
  selection_audit: { selection_id: string; account_id: string; slot_key: string; record_id: string; applied: boolean; unmet: string[]; synthetic: boolean }[]
  issues: { code: string; severity: string; message: string; record_id: string | null }[]; quarantined: string[]
  accounts: Record<string, { engine_ref: string; source_hash: string | null; ledger: LedgerEntry[]; internal: InternalRec[]; recon_rows: ReconRow[] }>
}

/* Phase 3A — Opportunity-to-Action (models/strategy_actions.py) */
export type LensLevel = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT'
export interface Lens { level: LensLevel; basis: string; facts: string[]; flags: string[]; refs?: string[]; accounts?: string[] }
export interface Initiative {
  initiative_id: string; area: string; status: 'CANDIDATE' | 'NEEDS_VALIDATION' | 'ANALYSIS_HYPOTHESIS'; approval_status: 'PROPOSED'
  opportunity: { FPR_2026: number; FPR_2031: number; FPR_CAGR: number | null; n_accounts: number; top_accounts: { account_id: string; FPR_2031: number }[] }
  lenses: { market: Lens; demand: Lens; capture: Lens }
  why: string[]; gap: string[]; option: { type: string | null; label: string; text: string | null; mode: string }; 
  priority: { baseline_score: number; baseline_rank: number; rank_min: number; rank_max: number; stability: string; note: string }
  actions: { action_id: string; text: string; lens: string; owner_role: string; status: 'PROPOSED' }[]
  verification_case?: { title: string; finding: string; implication: string } | null
}
export interface PrioritySensitivity {
  weights_baseline: Record<string, number>; method: string
  scenarios: { id: string; label: string; weights: Record<string, number>; ranks: Record<string, number>; scores: Record<string, number> }[]
  components: Record<string, Record<string, number>>
}

export type MetricKey = 'TS' | 'RAW' | 'FPR' | 'REV'
export interface Selection {
  year: 2026 | 2031
  metric: MetricKey | 'CSOW' | 'PCR' | 'UPSIDE' | 'TARGET_SOW' | 'TS_CAGR' | 'RAW_CAGR' | 'FPR_CAGR'
  category?: Category
  bridgeComponent?: string
}

/** Extension point (§11, NOT implemented in this phase): product-level LG U+ revenue drilldown. */
export type ProductLine = 'CLOUD' | 'SI_BUILD' | 'AX_PROJECT' | 'AI_INFRA_AIDC_GPUAAS' | 'SECURITY' | 'CONNECTIVITY' | 'OTHER'
export interface ProductRevenuePoint {
  account_id: string; year: 2026 | 2031; product: ProductLine
  lgu_revenue: number | null; capture_rate: number | null; competitor_shares?: Record<string, number> | null
  status: Status; evidence_ids: string[]
}

export interface Reconciliation {
  rows: { year: number; metric: string; external: number | null; sales: number | null; diff_pct: number | null; flag: string; sales_rep?: string | null; rationale?: string | null }[]
  internal_cr: number | null; management_target: number | null; opportunity_gap: number | null; notes: string[]
}
export interface Coverage { external_fields: number; external_covered: number; external_coverage: number; external_missing: number; internal_required: number; not_applicable: number; errors: number; by_class: Record<string, number> }
