-- LG U+ Enterprise Key Account Intelligence — SQLite schema (DATA_DICTIONARY.md 참조)
CREATE TABLE accounts (account_id TEXT PRIMARY KEY, original_name TEXT NOT NULL, segment TEXT, family TEXT,
  research_status TEXT, aggregate_class TEXT, overlap_groups TEXT, data_version TEXT);
CREATE TABLE account_entities (account_id TEXT PRIMARY KEY REFERENCES accounts, legal_name_ko TEXT, legal_name_en TEXT,
  corp_code TEXT, stock_code TEXT, business_reg_no TEXT, parent_group TEXT, industry_detail TEXT, is_korean_entity INTEGER,
  dart_available INTEGER, economic_scope TEXT, exclusions TEXT, entity_status TEXT, entity_notes TEXT);
CREATE TABLE financial_facts (fact_id TEXT, account_id TEXT REFERENCES accounts, metric TEXT, fiscal_year INTEGER,
  value TEXT, unit TEXT, scope TEXT, verification_status TEXT, evidence_ids TEXT, analyst_interpretation TEXT);
CREATE TABLE it_spending_components (account_id TEXT, year INTEGER, scenario TEXT, category TEXT,
  ts_value TEXT, raw_value TEXT, fpr_value TEXT, PRIMARY KEY (account_id, year, scenario, category));
-- monetary values stored as TEXT decimal strings to avoid float error; unit in column
CREATE TABLE account_metrics (account_id TEXT, metric TEXT, year INTEGER, scenario TEXT, addr_case TEXT,
  value TEXT, low TEXT, high TEXT, unit TEXT, status TEXT CHECK (status IN ('VERIFIED','DERIVED','ESTIMATED','SCENARIO','UNKNOWN')),
  confidence INTEGER, formula TEXT, evidence_ids TEXT, assumption_ids TEXT, data_version TEXT,
  PRIMARY KEY (account_id, metric, year, scenario, addr_case, data_version));
CREATE TABLE forecast_assumptions (driver_id TEXT, account_id TEXT, type TEXT, description TEXT, amount TEXT, unit TEXT,
  period TEXT, evidence_ids TEXT);
CREATE TABLE competitive_assumptions (account_id TEXT, category TEXT, observation TEXT, incumbent TEXT, lgu_relationship TEXT,
  evidence_ids TEXT);
CREATE TABLE evidence_sources (evidence_id TEXT, account_id TEXT, tier INTEGER, source_type TEXT, source_title TEXT,
  publisher TEXT, source_url TEXT, document_id TEXT, publication_date TEXT, accessed_at TEXT, fiscal_period TEXT,
  page_or_section TEXT, quoted_statement TEXT, reported_value TEXT, reported_unit TEXT, verification_status TEXT,
  notes TEXT, source_hash TEXT, data_version TEXT);
CREATE TABLE metric_evidence_links (account_id TEXT, metric TEXT, year INTEGER, scenario TEXT, evidence_id TEXT, data_version TEXT);
CREATE TABLE data_quality_issues (account_id TEXT, severity TEXT, code TEXT, message TEXT, metric TEXT, year INTEGER,
  scenario TEXT, data_version TEXT);
CREATE TABLE management_inputs (account_id TEXT PRIMARY KEY, cr_2026_ytd_eok TEXT, cr_2026_forecast_eok TEXT, cr_basis TEXT,
  target_revenue_2031_eok TEXT, target_basis TEXT, updated_at TEXT);
CREATE TABLE strategic_opportunities (area TEXT, fpr_2026 TEXT, fpr_2031 TEXT, fpr_cagr TEXT, n_accounts INTEGER,
  priority_score REAL, recommendation_type TEXT, recommendation TEXT, data_version TEXT);
CREATE TABLE research_runs (data_version TEXT PRIMARY KEY, run_at TEXT, summary TEXT);
