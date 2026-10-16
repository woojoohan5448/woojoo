"""FastAPI data API for the Key Account Intelligence dashboard.

Run:  cd project && uvicorn backend.app:app --port 8000
- Serves the built frontend (frontend/dist) at / when present.
- Reads model output (data/processed/dashboard.json, intel.db).
- POST /api/management-inputs persists internal CR/Target inputs to data/internal_inputs/management_inputs.csv
  and re-runs the model so validation is applied immediately. No API keys are exposed to the client.
"""
from __future__ import annotations

import csv
import os
import json
import threading
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
import sys as _sys
_sys.path.insert(0, str(ROOT))
from models.common import PROCESSED  # honours KAI_DATA_OUT sandbox
DASH = PROCESSED / "dashboard.json"
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
    # QA-I4: v1 direct-write path bypasses preview/approval/layer separation and writes a Git-tracked CSV.
    # Disabled by default; Excel import (/api/import/*) is the approved path. Opt-in only for legacy use.
    if os.environ.get("KAI_ENABLE_LEGACY_INPUT") != "1":
        raise HTTPException(410, "레거시 직접 입력 비활성화 — 관리자 입력 화면의 Excel 업로드·미리보기·승인 절차를 사용하세요 (KAI_ENABLE_LEGACY_INPUT=1 로만 재활성화)")
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


# ---------------------------------------------------------------- Phase 3: Excel import (사내 데이터)
class ApprovePayload(BaseModel):
    approver: str
    rows: list[int] | None = None


@app.get("/api/import/template")
def import_template():
    from models.internal.excel_io import make_template
    return FileResponse(make_template(), filename="KeyAccount_Internal_Input_Template.xlsx")


@app.post("/api/import/preview")
async def import_preview(file: UploadFile = File(...)):
    from models.internal.excel_io import STORE, preview
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(422, "xlsx 파일만 지원")
    up = STORE / "uploads"
    up.mkdir(parents=True, exist_ok=True)
    dest = up / f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}_{Path(file.filename).name}"
    dest.write_bytes(await file.read())
    b = preview(dest)
    return {k: b[k] for k in ("batch_id", "file", "status", "summary", "issues")} | {
        "rows": [{k: r.get(k) for k in ("row_id", "sheet", "excel_row", "layer", "mapping", "errors", "warnings", "diff", "normalized")} for r in b["rows"]]}


@app.get("/api/import/batches")
def import_batches():
    from models.internal.excel_io import status
    return status()


@app.post("/api/import/approve/{batch_id}")
def import_approve(batch_id: str, p: ApprovePayload):
    from models.internal.excel_io import approve
    try:
        with _lock:
            b = approve(batch_id, p.approver, p.rows)
            from models.build import main as build
            out = build()
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(422, str(e))
    return {"batch_id": batch_id, "applied_rows": b["applied_rows"], "data_version": out["meta"]["data_version"],
            "issues_summary": out["issues_summary"], "contains_internal_data": out["meta"].get("contains_internal_data")}


@app.post("/api/import/reject/{batch_id}")
def import_reject(batch_id: str, p: ApprovePayload):
    from models.internal.excel_io import reject
    try:
        return reject(batch_id, p.approver)
    except FileNotFoundError:
        raise HTTPException(404, "배치 없음")
    except ValueError as e:
        raise HTTPException(409, str(e))


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
