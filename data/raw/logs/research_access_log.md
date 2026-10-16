# Research access log (2026-10-16)

| 대상 | 방법 | 결과 | 원인 | 재시도 가능 |
|---|---|---|---|---|
| opendart.fss.or.kr / dart.fss.or.kr | curl | 실패 | egress proxy connect_rejected | 네트워크 정책 변경 시 |
| isds.kisa.or.kr (정보보호 공시 포털) | WebFetch | 실패 | DNS ENOTFOUND | 정책 변경 시 |
| 언론사(ddaily 등), wikipedia | WebFetch | 실패 | DNS ENOTFOUND | 정책 변경 시 |
| api.usaspending.gov | WebFetch | 실패 | proxy 403 | 정책 변경 시 |
| PlayMCP OpenDART | MCP | 성공 | — | — |
| WebSearch | 검색 | 부분 성공 | 턴당 200회 한도 소진(병렬 8개 배치) | 후속 메시지에서 재개 가능 |
| DART_API_KEY | env | 없음 | 미설정 | 키 발급 후 research/collectors/dart_collector.py |

고객별 상세 실패 로그는 각 `data/raw/research/KAxx.json`의 `research_log` 참조.
