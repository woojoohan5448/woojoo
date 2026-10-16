"""FastAPI data API for the Key Account Intelligence dashboard.

Run:  cd project && uvicorn backend.app:app --port 8000
- Serves the built frontend (frontend/dist) at / when present.
- Reads model output (data/processed/dashboard.json, intel.db).
- POST /api/management-inputs persists internal CR/Target inputs to data/internal_inputs/management_inputs.csv
  and re-runs the model so validation is applied immediately. No API keys are exposed to the client.
"""
from __future__ import annotations

import csv
import json
import threading
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
DASH = ROOT / "data" / "processed" / "dashboard.json"
MGMT = ROOT / "data" / "internal_inputs" / "management_inputs.csv"
DIST = ROOT / "frontend" / "dist"
FIELDS = ["account_id", "original_name", "cr_2026_ytd_eok", "cr_2026_ytd_asof", "cr_2026_forecast_eok", "cr_basis",
          "target_revenue_2031_eok", "target_basis", "updated_by", "updated_at"]
_lock = threading.Lock()

app = FastAPI(title="LG U+ Key Account Intelligence API", version="1.0.0")


def _dash() -> dict:
    if not DASH.exists():
        raise HTTPException(503, "모델 결과 없음 — `python3 -m models.build` 실행 필요")
    return json.loads(DASH.read_text(encoding="utf-8"))


@app.get("/api/health")
def health():
    d = _dash()
    return {"status": "ok", "data_version": d["meta"]["data_version"], "accounts": d["meta"]["n_accounts"]}


@app.get("/api/dashboard")
def dashboard():
    return JSONResponse(_dash())


@app.get("/api/accounts")
def accounts():
    d = _dash()
    return [{"account_id": a["account_id"], "original_name": a["original_name"], "segment": a["segment"], "research_status": a["research_status"],
             "ts_2026": a["m"]["2026"]["TS"]["value"], "fpr_2026": a["m"]["2026"]["FPR"]["value"], "confidence": a["m"]["2026"]["TS"]["confidence"]}
            for a in d["accounts"]]


@app.get("/api/accounts/{account_id}")
def account(account_id: str):
    for a in _dash()["accounts"]:
        if a["account_id"] == account_id:
            return a
    raise HTTPException(404, f"{account_id} 없음")


@app.get("/api/evidence/{evidence_id}")
def evidence(evidence_id: str):
    for a in _dash()["accounts"]:
        for e in a["evidence"]:
            if e["evidence_id"] == evidence_id:
                return e
    raise HTTPException(404, "evidence 없음")


@app.get("/api/issues")
def issues(severity: str | None = None):
    out = [i for a in _dash()["accounts"] for i in a["issues"]]
    return [i for i in out if not severity or i["severity"] == severity]


class MgmtRow(BaseModel):
    account_id: str
    cr_2026_ytd_eok: str = ""
    cr_2026_ytd_asof: str = ""
    cr_2026_forecast_eok: str = ""
    cr_basis: str = ""
    target_revenue_2031_eok: str = ""
    target_basis: str = ""
    updated_by: str = ""


class MgmtPayload(BaseModel):
    rows: list[MgmtRow]


def _num(s: str, field: str, aid: str):
    if s.strip() == "":
        return ""
    try:
        v = Decimal(s.replace(",", ""))
    except InvalidOperation:
        raise HTTPException(422, f"{aid} {field}: 숫자가 아님 ({s})")
    if v < 0:
        raise HTTPException(422, f"{aid} {field}: 음수 불가")
    return str(v)


@app.post("/api/management-inputs")
def save_inputs(p: MgmtPayload):
    with _lock:
        existing = {}
        if MGMT.exists():
            with open(MGMT, encoding="utf-8-sig") as f:
                existing = {r["account_id"]: r for r in csv.DictReader(f)}
        valid = {r["account_id"] for r in _dash()["accounts"]}
        now = datetime.now(timezone.utc).isoformat()
        for r in p.rows:
            if r.account_id not in valid:
                raise HTTPException(422, f"알 수 없는 account_id {r.account_id}")
            if r.cr_2026_forecast_eok.strip() and not r.cr_basis.strip():
                raise HTTPException(422, f"{r.account_id}: CR 입력 근거(cr_basis) 필수")
            row = existing.get(r.account_id, {k: "" for k in FIELDS})
            row.update({"account_id": r.account_id, "cr_2026_ytd_eok": _num(r.cr_2026_ytd_eok, "cr_2026_ytd_eok", r.account_id),
                        "cr_2026_ytd_asof": r.cr_2026_ytd_asof, "cr_2026_forecast_eok": _num(r.cr_2026_forecast_eok, "cr_2026_forecast_eok", r.account_id),
                        "cr_basis": r.cr_basis, "target_revenue_2031_eok": _num(r.target_revenue_2031_eok, "target_revenue_2031_eok", r.account_id),
                        "target_basis": r.target_basis, "updated_by": r.updated_by, "updated_at": now})
            existing[r.account_id] = row
        MGMT.parent.mkdir(parents=True, exist_ok=True)
        with open(MGMT, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
            w.writeheader()
            for k in sorted(existing):
                w.writerow(existing[k])
        from models.build import main as build  # re-run model → validation applied
        out = build()
    return {"saved": len(p.rows), "data_version": out["meta"]["data_version"], "issues_summary": out["issues_summary"]}


@app.get("/api/export/xlsx")
def export_xlsx():
    from models.export_xlsx import export
    path = export()
    return FileResponse(path, filename="key_account_intelligence.xlsx")


@app.get("/api/export/csv")
def export_csv():
    path = ROOT / "data" / "exports" / "account_metrics.csv"
    if not path.exists():
        raise HTTPException(404, "export 없음")
    return FileResponse(path, filename="account_metrics.csv")


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
