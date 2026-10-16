# NEXT ACTIONS (우선순위순)

## A. 외부 조사 (RESEARCH GAP 29필드)
| 계정 | 결측 | 다음 시도 | 차단 요인 |
|---|---|---|---|
| KA28 코람코자산운용 | 2026/2031 TS·RAW·FPR | 가산 DC 운영위탁 단가(원/kW/월) 또는 DC 리츠 운용보고서의 운영비 계정 확보 → 용량 모델 | 단가 공개 근거 없음 |
| KA41 신협중앙회 | 2026/2031 전체 | 중앙회 경영공시 '전산비', 국감 자료, 조폐공사 DC 이전 사업비(2026-05 MOU) | 금융사는 정보보호 공시 의무 제외 |
| KA42 Fastly | 전체 | 10-K 지역 매출(APAC 약 6%)·PeeringDB 서울 POP → 한국 몫 | data.sec.gov·peeringdb 프록시 차단 |
| KA43 Valve | 전체 | Steam 국가별 다운로드 트래픽 × 국내 트랜짓 단가 | store.steampowered.com 차단, 단가 근거 없음 |
| KA32 주한미군 | 2026/2031 TS | USAspending(Korea place of performance, PSC D·telecom) obligation | api.usaspending.gov 차단 |
| KA50 키암코 도화동 DC | 2031 | 임차인·준공 시점 확정 시 용량 모델(80MW 수전) | 착공 전·주민 반대 |
→ 네트워크 허용 목록 변경 시 `docs/MCP_SOURCE_REGISTRY.md` §3 재시도 표부터 처리.

## B. 정확도 개선 (LOW → MEDIUM)
1. REVENUE_INTENSITY 7개 계정(KA02·04·05·13·24 등): MyDART 감사보고서 IT 계정 발췌 → `component_model.accounts` 화이트리스트 추가
2. 신한카드(KA04) 과소 추정 의심 — 판관비 기준 R02 이상치
3. CORP 커버리지 0.6 가정 → KISA 공시 일반기업 2~3곳으로 실증
4. KA45 메타: 최신(2024~25) 트래픽 점유율로 갱신, 실제 지급액은 사내 계약으로 대체

## C. 사내 이관 (Phase 3/4)
1. `python3 tools/make_release.py` 패키지 반입 → `docs/DEPLOYMENT_GUIDE.md` 절차
2. `docs/PHASE_STATUS.md` Phase 4 체크리스트 수행
3. 권한 분리(SSO) — 방식 C 서버 배포 시
