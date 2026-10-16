"""Phase 3A — Opportunity-to-Action (additive; strategy engine numbers and priority formula unchanged).

53 KA Opportunity → Opportunity Pool → Market / Demand Evidence → Capability Gap → Strategic Initiative → Priority → Next Action

Three evidence lenses per business area, never blended into the priority score:
  Market Evidence     — existence/size/growth of the market: market benchmark refs (verification status) + growth
                        assumption dependency (share of the 2026→2031 increase that comes from B-ALLOC assumptions).
  Demand Evidence     — customer-specific purchase / investment / budget signals with an UP direction
                        (research drivers mapped to the area, account infra investment plans).
                        NOT demand: incumbent-supplier observations, KISA spend ratios, contract categories
                        (= existing spend observed) and DOWN signals (budget cuts → reported as contradicting).
  Capture Feasibility — LG U+ supply capability, competition, entry feasibility (analyst judgment from public info;
                        internal capability / contract terms not verified).
Initiative status: ANALYSIS_HYPOTHESIS (no demand evidence) | NEEDS_VALIDATION | CANDIDATE (all lenses sufficient).
approval_status is always PROPOSED — nothing is auto-approved.
"""
from __future__ import annotations

from decimal import Decimal

D0 = Decimal(0)
FEAS = {"HIGH": 1.0, "MEDIUM": 0.6, "LOW": 0.25}
GAP = {"LOW": 1.0, "MEDIUM": 0.6, "MEDIUM–HIGH": 0.4, "MEDIUM-HIGH": 0.4, "HIGH": 0.25, "VERY HIGH": 0.1}
DIFF = {"HIGH": 8, "MEDIUM": 4, "LOW": 0}
W0 = {"size": 35, "growth": 20, "breadth": 15, "feasibility": 15, "confidence": 15}
RULES = {
    "market": {"SUFFICIENT": "시장 근거 ≥2건 중 원문 확인(VERIFIED) ≥1건, 성장 가정 의존도 ≤50%", "PARTIAL": "시장 근거 ≥1건(2차 인용 포함)", "INSUFFICIENT": "시장 근거 없음"},
    "demand": {"SUFFICIENT": "양(+) 수요 근거 고객 ≥5개사, 영역 FPR 2031 중 해당 고객 비중 ≥30%", "PARTIAL": "양(+) 수요 근거 고객 ≥1개사", "INSUFFICIENT": "양(+) 수요 근거 없음"},
    "capture": {"SUFFICIENT": "확보 가능성 점수 ≥0.75 (진입 가능성·역량 격차 평균)", "PARTIAL": "≥0.5", "INSUFFICIENT": "<0.5"},
}
OWNER = {"demand": "영업(Key Account 담당)", "market": "전략기획(시장 분석)", "capture": "사업부(상품·기술)", "internal": "AI사업제휴TF / 데이터 관리"}


def _f(x) -> float:
    return float(x) if x is not None else 0.0


def _lvl(score_ok: bool, partial_ok: bool) -> str:
    return "SUFFICIENT" if score_ok else "PARTIAL" if partial_ok else "INSUFFICIENT"


def _head(s: str | None) -> str:
    return (s or "").split("—")[0].split("(")[0].strip()


def priority_components(strat: list[dict]) -> dict[str, dict[str, float]]:
    """Exact replica of strategy_engine's score inputs (relative size/growth/breadth, feasibility, confidence, difficulty)."""
    mx = max(_f(o["FPR_2031"]) for o in strat) or 1
    mg = max((_f(o["FPR_CAGR"]) for o in strat), default=0) or 1
    nb = max(o["n_accounts"] for o in strat) or 1
    return {o["area"]: {"size": _f(o["FPR_2031"]) / mx, "growth": max(0.0, _f(o["FPR_CAGR"])) / mg, "breadth": o["n_accounts"] / nb,
                        "feasibility": FEAS.get(o.get("entry_feasibility") or "MEDIUM", 0.6), "confidence": o["demand_confidence"] / 100,
                        "difficulty": DIFF.get(o.get("difficulty") or "MEDIUM", 4)} for o in strat}


def score(c: dict, w: dict) -> float:
    return round(max(0.0, sum(w[k] * c[k] for k in W0) - c["difficulty"]), 1)


def sensitivity(strat: list[dict]) -> dict:
    comps = priority_components(strat)
    for o in strat:  # guard: the replica must reproduce the engine score exactly
        if score(comps[o["area"]], W0) != o["priority_score"]:
            raise AssertionError(f"priority replica mismatch for {o['area']}: {score(comps[o['area']], W0)} vs {o['priority_score']}")
    scen = [("BASELINE", "기준안(현행 v1 가중치)", dict(W0))]
    for k in W0:
        for f, tag in ((1.5, "+50%"), (0.5, "−50%")):
            w = dict(W0); w[k] = W0[k] * f
            scen.append((f"{k.upper()}_{'UP' if f > 1 else 'DOWN'}", f"{k} 가중치 {tag}", w))
    scen.append(("EQUAL", "균등 가중(각 20)", {k: 20 for k in W0}))
    out = []
    for sid, label, w in scen:
        sc = {a: score(c, w) for a, c in comps.items()}
        order = sorted(sc, key=lambda a: (-sc[a], a))
        out.append({"id": sid, "label": label, "weights": w, "scores": sc, "ranks": {a: i + 1 for i, a in enumerate(order)}})
    return {"weights_baseline": W0, "components": comps, "scenarios": out,
            "method": "현행 우선순위 산식(35×규모+20×성장+15×수요 고객 수+15×진입 가능성+15×수요 신뢰도−난이도)의 가중치를 하나씩 ±50% 변경하고 균등 가중을 추가해 순위 범위를 계산. 근거 수준(3관점)은 점수에 넣지 않음."}


def _demand_items(acc: dict, area: str, sigmap: dict, cats: dict) -> tuple[list[dict], list[dict]]:
    """(positive demand items, contradicting items) for one account × area."""
    pos, neg = [], []
    tmap = sigmap.get("types", {})
    for d in acc.get("_drivers") or acc.get("drivers") or []:
        areas = {cats[c]["biz_area"] for c in tmap.get(d.get("type"), [])}
        if area not in areas:
            continue
        item = {"account_id": acc["account_id"], "id": d.get("driver_id"), "type": d.get("type"), "direction": d.get("direction"),
                "amount_eok": d.get("amount") if d.get("unit") == "억원" else None, "period": d.get("period"),
                "description": (d.get("description") or "")[:140], "evidence_ids": d.get("evidence_ids", [])}
        (neg if (d.get("direction") or "").upper() in ("DOWN", "DECREASE") else pos).append(item)
    infra_areas = {cats[c]["biz_area"] for c in (sigmap.get("_infra_cats") or [])}
    for d in acc.get("infra_drivers") or []:
        if area in infra_areas:
            pos.append({"account_id": acc["account_id"], "id": d.get("driver_id"), "type": "INFRA_INVESTMENT_PLAN", "direction": "UP",
                        "amount_eok": None, "period": "2026-2031", "description": (d.get("description") or "")[:140], "evidence_ids": d.get("evidence_ids", [])})
    return pos, neg


def build(accounts: list[dict], strat: list[dict], params: dict, market: dict, sigmap: dict) -> tuple[list[dict], dict, dict]:
    cats = params["categories"]
    sigmap = dict(sigmap, _infra_cats=list((params.get("increment_allocation") or {}).get("infra", {}).keys()))
    ev = {e["evidence_id"]: e for e in market.get("evidence", [])}
    items = {i["item_id"]: i for i in market.get("items", [])}
    sens = sensitivity(strat)
    base_rank = {a: r for a, r in sens["scenarios"][0]["ranks"].items()}
    names = {a["account_id"]: a.get("original_name") for a in accounts}
    flow = {"n_accounts": len(accounts), "n_accounts_with_fpr": 0, "n_opportunities": 0, "n_areas": len(strat), "n_initiatives": 0,
            "n_approved": 0, "n_actions": 0, "status_counts": {}}
    seen_acc = set()
    out = []
    for o in strat:
        area = o["area"]
        e = o.get("evidence") or {}
        # ---- opportunity pool (account × area with FPR_2031 ≥ 1억, definition mismatch excluded — same as the engine)
        opp_accounts = []
        for a in accounts:
            if a["aggregate_class"] == "DEFINITION_MISMATCH":
                continue
            ae = (a.get("area_evidence") or {}).get(area) or {}
            f31 = ae.get("FPR_2031")
            if f31 is not None and Decimal(str(f31)) >= 1:
                opp_accounts.append((a, Decimal(str(f31))))
                seen_acc.add(a["account_id"])
        flow["n_opportunities"] += len(opp_accounts)
        tot = sum((f for _, f in opp_accounts), D0)
        # ---- market lens
        refs = o.get("evidence_refs") or []
        ver = [r for r in refs if ev.get((items.get(r) or {}).get("evidence_id"), {}).get("verification_status") == "VERIFIED"]
        dep = e.get("assumption_dependency")
        m_flags = []
        if refs and not ver:
            m_flags.append(f"시장 근거 {len(refs)}건 모두 원문 미열람(2차 인용)")
        if dep is not None and _f(dep) > 0.5:
            m_flags.append(f"성장 가정 의존도 {round(_f(dep) * 100)}% — 2031 증가분 과반이 배분 가정")
        if dep is not None and _f(dep) < 0:
            m_flags.append("성장 가정이 감소 방향(대체·효율화)")
        market_l = {"level": _lvl(len(refs) >= 2 and len(ver) >= 1 and (dep is None or _f(dep) <= 0.5), len(refs) >= 1),
                    "basis": "시장 벤치마크(MB)·브리지 가정", "refs": refs, "flags": m_flags,
                    "facts": [f"{r}: {(items.get(r) or {}).get('topic', '')} {(items.get(r) or {}).get('value', '')} {(items.get(r) or {}).get('unit', '')} ({(items.get(r) or {}).get('year', '')})".strip() for r in refs[:6]]
                    + ([f"성장 가정 의존도 {round(_f(dep) * 100)}%" if _f(dep) >= 0 else "성장 가정: 감소"] if dep is not None else [])}
        # ---- demand lens (UP purchase/investment/budget signals only)
        pos_acc, neg_acc, pos_items, neg_items, cov = set(), set(), [], [], D0
        for a, f31 in opp_accounts:
            p, n = _demand_items(a, area, sigmap, cats)
            if p:
                pos_acc.add(a["account_id"]); pos_items += p; cov += f31
            if n:
                neg_acc.add(a["account_id"]); neg_items += n
        share = (cov / tot) if tot > 0 else None
        d_flags = []
        if e.get("n_accounts_incumbent_obs"):
            d_flags.append(f"기존 공급자 관찰 {e['n_accounts_incumbent_obs']}개사 — 현행 지출 관측이며 신규 수요로 집계하지 않음")
        if e.get("n_accounts_specific_share"):
            d_flags.append(f"고객별 비중 근거 {e['n_accounts_specific_share']}개사(KISA 비율·계약 카테고리 등) — 규모 산정 근거, 신규 수요 아님")
        if neg_acc:
            d_flags.append(f"수요 감소(예산 감액) 신호 {len(neg_acc)}개사 — 반대 근거")
        demand_l = {"level": _lvl(len(pos_acc) >= 5 and share is not None and share >= Decimal("0.3"), len(pos_acc) >= 1),
                    "basis": "고객별 구매·투자·예산 신호(조사 drivers, 방향 UP) + 계정별 인프라 투자 계획", "accounts": sorted(pos_acc), "flags": d_flags,
                    "facts": [f"양(+) 수요 근거 {len(pos_acc)}개사 / 기회 보유 {len(opp_accounts)}개사" + (f" · 해당 고객 FPR 2031 비중 {round(_f(share) * 100)}%" if share is not None else ""),
                              *[f"{names.get(i['account_id'], i['account_id'])} · {i['type']} · {i['description']}" for i in pos_items[:5]]],
                    "signals": pos_items[:20], "contradicting": neg_items[:10], "n_contradicting_accounts": len(neg_acc),
                    "coverage_share": float(share) if share is not None else None}
        # ---- capture feasibility lens (analyst judgment)
        feas = FEAS.get(o.get("entry_feasibility") or "MEDIUM", 0.6)
        gap_h = _head(o.get("capability_gap"))
        gapv = GAP.get(gap_h, 0.6)
        cap = (feas + gapv) / 2
        capture_l = {"level": _lvl(cap >= 0.75, cap >= 0.5), "basis": "공개정보 기반 분석가 판단 — 사내 역량 진단·계약 조건 미검증", "score": round(cap, 3),
                     "flags": ["사내 역량·계약 조건 미검증"], "facts": [f"진입 가능성 {o.get('entry_feasibility')}", f"역량 격차 {o.get('capability_gap')}",
                                                                   f"경쟁 {o.get('competition')}", f"LG U+ 위치: {o.get('lgu_position')}"]}
        lenses = {"market": market_l, "demand": demand_l, "capture": capture_l}
        status = ("ANALYSIS_HYPOTHESIS" if demand_l["level"] == "INSUFFICIENT"
                  else "CANDIDATE" if all(l["level"] == "SUFFICIENT" for l in lenses.values())
                  else "NEEDS_VALIDATION")
        # ---- WHY / GAP / OPTION / PRIORITY / ACTION
        top = sorted(opp_accounts, key=lambda x: -x[1])[:3]
        why = [f"기회 규모: FPR 2026 {round(_f(o['FPR_2026'])):,}억 → 2031 {round(_f(o['FPR_2031'])):,}억 (CAGR {round(_f(o['FPR_CAGR']) * 100, 1)}%), 기회 보유 {len(opp_accounts)}개사",
               "상위 고객: " + ", ".join(f"{names.get(a['account_id'])}({round(_f(f) / _f(tot) * 100) if tot else 0}%)" for a, f in top),
               f"수요 근거: 양(+) {len(pos_acc)}개사" + (f", 감소 신호 {len(neg_acc)}개사" if neg_acc else "") + f" · 시장 근거 {len(refs)}건(원문 확인 {len(ver)}건)"]
        gap = [f"역량 격차: {o.get('capability_gap')} — 필요 역량 {o.get('required_capabilities')}"]
        if demand_l["level"] != "SUFFICIENT":
            gap.append("고객 수요 근거 부족" if demand_l["level"] == "INSUFFICIENT" else f"고객 수요 근거 일부({len(pos_acc)}개사)")
        gap += m_flags
        gap.append("LG U+ 확보 가능성은 분석가 판단(사내 진단 전)")
        rtype = o.get("recommendation_type")
        RT = {"EXPAND": "확장", "INVEST": "투자", "PARTNER": "제휴", "M&A_REVIEW": "인수 검토", "MAINTAIN": "유지"}
        mode = "검토 옵션" if status == "CANDIDATE" else "검토 옵션(검증 필요)" if status == "NEEDS_VALIDATION" else "분석 가설"
        option = {"type": rtype, "label": f"{RT.get(rtype, rtype)} — {mode}", "text": o.get("recommendation"), "mode": mode}
        ranks = [s["ranks"][area] for s in sens["scenarios"]]
        rmin, rmax = min(ranks), max(ranks)
        priority = {"baseline_score": o["priority_score"], "baseline_rank": base_rank[area], "rank_min": rmin, "rank_max": rmax,
                    "stability": "STABLE" if rmax - rmin <= 1 else "MODERATE" if rmax - rmin <= 2 else "SENSITIVE",
                    "note": "전략적 매력도(기존 산식). 근거 3관점과 섞지 않음"}
        acts = []
        tops = ", ".join(names.get(a["account_id"]) or a["account_id"] for a, _ in top)
        if demand_l["level"] != "SUFFICIENT":
            acts.append(("demand", f"수요 검증: 상위 고객({tops})의 구매·투자 계획·예산·RFP 확인"))
        if neg_acc:
            acts.append(("demand", f"감소 신호 {len(neg_acc)}개사 원문 확인 후 수요 판단 재검토"))
        if refs and not ver:
            acts.append(("market", "시장 근거 원문 대조(2차 인용 → 1차 보고서·공시)"))
        if not refs:
            acts.append(("market", "시장 규모·성장 근거 확보(시장 보고서·공공 통계)"))
        if dep is not None and _f(dep) > 0.5:
            acts.append(("market", "성장 가정(B-ALLOC 배분) 민감도 검증 — 가정 제외 시 기회 규모 재산정"))
        acts.append(("capture", f"LG U+ 역량·경쟁력 사내 진단({gap_h or '역량 격차'}), 계약 조건 확인"))
        acts.append(("internal", "사내 실적·파이프라인 연동 후 재평가(Phase 3B, Blocker B1·B6 해소 후)"))
        actions = [{"action_id": f"{area[:3].upper()}-A{i + 1}", "text": t, "lens": l, "owner_role": OWNER[l], "status": "PROPOSED"} for i, (l, t) in enumerate(acts)]
        case = None
        if area == "Security":
            case = {"title": "검증 사례 ① Security — 성장 가정 의존도",
                    "finding": f"기존 판정 '근거 충분'(Phase 1)이지만 2031 증가분의 {round(_f(dep) * 100)}%가 배분 가정에서 발생하고, 시장 근거 {len(refs)}건 모두 원문 미열람, 수요 신호 중 감소(예산 감액) {len(neg_acc)}개사.",
                    "implication": "인수(M&A) 검토는 확정 권고가 아님 — 가정 민감도·감소 신호·대상 기업 실사 전까지 '검증 필요'."}
        if area == "SI / Managed Services":
            case = {"title": "검증 사례 ② SI / Managed Services — 수요 근거 부족",
                    "finding": f"기존 판정 '근거 충분'은 기존 공급자 관찰 {e.get('n_accounts_incumbent_obs')}개사에 의존. 신규 수요(차세대 사업 등) 양(+) 근거는 {len(pos_acc)}개사, 해당 고객 FPR 비중 {round(_f(share) * 100) if share is not None else 0}%.",
                    "implication": "기존 지출 관측은 신규 수요가 아님 — 확정 성장 기회로 표시하지 않고 '검증 필요'."}
        out.append({"initiative_id": f"INIT-{len(out) + 1:02d}", "area": area, "status": status, "approval_status": "PROPOSED",
                    "opportunity": {"FPR_2026": o["FPR_2026"], "FPR_2031": o["FPR_2031"], "FPR_CAGR": o["FPR_CAGR"], "n_accounts": len(opp_accounts),
                                    "top_accounts": [{"account_id": a["account_id"], "FPR_2031": f} for a, f in top]},
                    "lenses": lenses, "lens_rules": RULES, "why": why, "gap": gap, "option": option, "priority": priority,
                    "actions": actions, "verification_case": case})
        flow["status_counts"][status] = flow["status_counts"].get(status, 0) + 1
        flow["n_actions"] += len(actions)
    flow["n_accounts_with_fpr"] = len(seen_acc)
    flow["n_initiatives"] = len(out)
    flow["n_approved"] = sum(1 for i in out if i["approval_status"] != "PROPOSED")
    return out, sens, flow
