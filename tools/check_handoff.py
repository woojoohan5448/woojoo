"""Inspect KA_Dashboard_Phase3A_Handoff.zip: required files, forbidden content, secrets, internal data, baseline facts.

python3 tools/check_handoff.py [zip] [out.json]   → exit 1 on any problem
"""
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    # frontend
    "frontend/package.json", "frontend/package-lock.json", "frontend/vite.config.ts", "frontend/tsconfig.json", "frontend/index.html",
    "frontend/src/App.tsx", "frontend/src/main.tsx", "frontend/src/data/dashboard.json", "frontend/dist/index.html",
    "frontend/src/components/ReconPanel.tsx", "frontend/src/components/PortfolioTrajectory.tsx", "frontend/src/lib/portfolioTrajectory.ts",
    # engine & API
    "backend/app.py", "models/build.py", "models/common.py", "models/spending/ts.py", "models/addressability/raw.py", "models/capture/fpr.py",
    "models/forecasting/bridge.py", "models/strategy_actions.py",
    # import & reconciliation
    "models/internal/excel_io.py", "models/recon/contract.py", "models/recon/ledger.py", "tools/contract_validate.py",
    "data/internal_inputs/templates/KeyAccount_Internal_Input_Template.xlsx",
    # data, evidence & registries
    "config/model_parameters.json", "config/account_overrides.json", "config/official_source_policy.json", "config/demand_signal_map.json",
    "docs/ACCOUNT_MASTER.csv", "docs/MCP_SOURCE_REGISTRY.md", "data/processed/dashboard.json", "data/processed/intel.db",
    # contract & docs
    "contracts/phase3a_data_contract.v0.json", "docs/vnext/phase3a/DATA_CONTRACT.md", "docs/vnext/phase3a/PHASE3A_REPORT.md",
    "docs/vnext/phase3a/PHASE3A_READINESS.md", "docs/vnext/phase3a/SCREEN_VERIFICATION.md", "docs/INTERNAL_EXCEL_SPEC.md",
    "CLAUDE.md", "docs/HANDOFF.md", "INTERNAL_SETUP.md", "INTERNAL_INTEGRATION_HANDOFF.md", "README.md",
    # static build & results
    "Key_Account_Dashboard.html", "docs/vnext/phase3a/qa/phase3a_e2e_api.json", "docs/vnext/phase3a/qa/phase3a_e2e_static.json",
    # tests
    "tests/test_vnext_baseline.py", "tests/fixtures/vnext_baseline.json", "tests/test_phase3a_contract.py", "tests/test_phase3a_ledger.py",
    "tests/test_phase3a_actions.py", "frontend/src/__tests__/core.test.ts", "frontend/src/__tests__/phase3a.test.ts", "tests/e2e/phase3a.e2e.mjs",
    # scripts, deps, env
    "requirements.txt", ".env.example", "setup_windows.bat", "run_dashboard.bat", "import_excel.bat", "tools/make_handoff.py",
    "HANDOFF_BUILD_INFO.json", "MANIFEST.json",
]
FORBIDDEN_PARTS = {"node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", ".git", "dist_release", "dist-single"}
FORBIDDEN_PREFIX = ("data/internal_store/", "data/internal_inputs/uploads/", "data/raw/dart/")
SECRET_RX = [rb"-----BEGIN [A-Z ]*PRIVATE KEY-----", rb"AKIA[0-9A-Z]{16}", rb"\bsk-[A-Za-z0-9]{20,}", rb"ghp_[A-Za-z0-9]{30,}",
             rb"crtfc_key=[0-9a-f]{40}", rb"DART_API_KEY\s*=\s*[0-9a-f]{40}", rb"(?i)password\s*[:=]\s*['\"][^'\"]{6,}['\"]"]


def main():
    zp = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "KA_Dashboard_Phase3A_Handoff.zip"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    z = zipfile.ZipFile(zp)
    names = z.namelist()
    nameset = set(names)
    problems = []
    missing = [r for r in REQUIRED if r not in nameset]
    if missing:
        problems.append(f"필수 파일 누락 {missing}")
    forb = [n for n in names if FORBIDDEN_PARTS & set(Path(n).parts) or n.startswith(FORBIDDEN_PREFIX)
            or Path(n).name == ".env" or Path(n).suffix.lower() in (".pem", ".key", ".p12", ".pfx", ".pyc", ".zip")]
    if forb:
        problems.append(f"제외 대상 포함 {forb[:8]}")
    logs = [n for n in names if n.endswith(".log") and not n.startswith("docs/")]
    if logs:
        problems.append(f"로그 포함 {logs[:5]}")
    secrets = []
    for n in names:
        if z.getinfo(n).file_size > 20_000_000 or n.endswith((".whl", ".png", ".xlsx", ".db")):
            continue
        b = z.read(n)
        for rx in SECRET_RX:
            if re.search(rx, b):
                secrets.append(f"{n}: {rx.decode()[:30]}")
    if secrets:
        problems.append(f"비밀정보 의심 {secrets[:5]}")
    internal = [n for n in names if n.endswith((".json", ".html", ".js")) and re.search(rb'"contains_internal_data"\s*:\s*true', z.read(n))]
    if internal:
        problems.append(f"사내 데이터 플래그 {internal}")
    info = json.loads(z.read("HANDOFF_BUILD_INFO.json"))
    dash = json.loads(z.read("data/processed/dashboard.json"))
    base = info["baseline"]
    if base["initiatives"] != 8 or base["initiatives_approved"] != 0 or base["recon_switched"] != 0 or base["recon_internal_records"] != 0:
        problems.append(f"기준선 불일치 {base}")
    big = sorted(((z.getinfo(n).file_size, n) for n in names), reverse=True)[:5]
    top = {}
    for n in names:
        k = n.split("/")[0] if "/" in n else "(root)"
        top[k] = top.get(k, 0) + 1
    res = {"zip": zp.name, "files": len(names), "size_mb": round(zp.stat().st_size / 1e6, 1), "required": f"{len(REQUIRED) - len(missing)}/{len(REQUIRED)}",
           "missing": missing, "forbidden": forb[:20], "logs_outside_docs": logs, "secret_hits": secrets, "internal_data_flags": internal,
           "accounts": len(dash["accounts"]), "contains_internal_data": dash["meta"].get("contains_internal_data"),
           "git": info["git"], "data_version": info["data_version"], "baseline": base, "by_top_dir": dict(sorted(top.items())),
           "largest_files": [{"path": n, "mb": round(s / 1e6, 2)} for s, n in big], "problems": problems}
    txt = json.dumps(res, ensure_ascii=False, indent=1)
    if out:
        out.write_text(txt, encoding="utf-8")
    print(txt)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
