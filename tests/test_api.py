"""Backend API tests (read endpoints + input validation; does not persist inputs)."""
from fastapi.testclient import TestClient

from backend.app import app

c = TestClient(app)


def test_health_and_accounts():
    assert c.get("/api/health").json()["accounts"] == 53
    rows = c.get("/api/accounts").json()
    assert len(rows) == 53 and rows[0]["account_id"] == "KA01"


def test_account_and_evidence_lookup():
    a = c.get("/api/accounts/KA03").json()
    assert a["original_name"] == "국민은행"
    eid = a["m"]["2026"]["TS"]["evidence_ids"][0]
    assert c.get(f"/api/evidence/{eid}").json()["evidence_id"] == eid
    assert c.get("/api/accounts/NOPE").status_code == 404


def test_legacy_direct_input_disabled_by_default(monkeypatch):
    monkeypatch.delenv("KAI_ENABLE_LEGACY_INPUT", raising=False)
    r = c.post("/api/management-inputs", json={"rows": [{"account_id": "KA03", "cr_2026_forecast_eok": "10", "cr_basis": "x"}]})
    assert r.status_code == 410  # approval workflow cannot be bypassed


def test_management_input_validation_rejects_bad_values(monkeypatch):
    monkeypatch.setenv("KAI_ENABLE_LEGACY_INPUT", "1")
    assert c.post("/api/management-inputs", json={"rows": [{"account_id": "KA03", "cr_2026_forecast_eok": "-5", "cr_basis": "x"}]}).status_code == 422
    assert c.post("/api/management-inputs", json={"rows": [{"account_id": "KA03", "cr_2026_forecast_eok": "abc", "cr_basis": "x"}]}).status_code == 422
    assert c.post("/api/management-inputs", json={"rows": [{"account_id": "KA03", "cr_2026_forecast_eok": "10"}]}).status_code == 422  # basis required
    assert c.post("/api/management-inputs", json={"rows": [{"account_id": "ZZ99", "cr_2026_forecast_eok": "10", "cr_basis": "x"}]}).status_code == 422


def test_issue_filter():
    errs = c.get("/api/issues", params={"severity": "ERROR"}).json()
    assert errs == []
