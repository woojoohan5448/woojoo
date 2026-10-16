"""Inspect the newest dist_release/*.zip and write data/qa/package_check.json (used by the Windows checklist).

python3 tools/check_release.py   → exit 1 if a blocking problem is found
"""
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ["setup_windows.bat", "run_dashboard.bat", "import_excel.bat", "requirements.txt", "backend/app.py", "models/build.py",
            "models/internal/excel_io.py", "config/model_parameters.json", "config/account_overrides.json", "data/processed/dashboard.json",
            "data/processed/intel.db", "frontend/dist/index.html", "Key_Account_Dashboard.html", "docs/DEPLOYMENT_GUIDE.md",
            "data/internal_inputs/templates/KeyAccount_Internal_Input_Template.xlsx", "tools/make_release.py", ".env.example"]


def main():
    zips = sorted((ROOT / "dist_release").glob("KeyAccountIntel_*.zip"), key=lambda p: p.stat().st_mtime)
    if not zips:
        print("no package"); sys.exit(1)
    zp = zips[-1]
    z = zipfile.ZipFile(zp)
    names = set(z.namelist())
    problems = []
    missing = [r for r in REQUIRED if r not in names]
    if missing:
        problems.append(f"missing {missing}")
    bad = [n for n in names if n.startswith(("data/internal_store/", "data/internal_inputs/uploads/")) or Path(n).name == ".env"
           or Path(n).suffix.lower() in (".pem", ".key", ".p12", ".pfx")]
    if bad:
        problems.append(f"forbidden {bad[:5]}")
    internal_flag = [n for n in names if n.endswith((".json", ".html", ".js")) and n.startswith(("data/processed/", "frontend/", "Key_Account"))
                     and re.search(rb'"contains_internal_data"\s*:\s*true', z.read(n))]
    if internal_flag:
        problems.append(f"internal flag in {internal_flag}")
    import csv
    import io
    mi = list(csv.DictReader(io.StringIO(z.read("data/internal_inputs/management_inputs.csv").decode("utf-8-sig")))) \
        if "data/internal_inputs/management_inputs.csv" in names else []
    mi_vals = [r["account_id"] for r in mi if any((r.get(k) or "").strip() for k in ("cr_2026_ytd_eok", "cr_2026_forecast_eok", "target_revenue_2031_eok"))]
    if mi_vals:
        problems.append(f"management_inputs values {mi_vals[:5]}")
    wheels = sorted(n for n in names if n.startswith("wheels/") and n.endswith(".whl"))
    cps = sorted({m.group(1) for w in wheels for m in [re.search(r"-(cp3\d+)-cp3\d+-win_amd64", w)] if m})
    bats = {b: (b"\r\n" in z.read(b) and b"\n" not in z.read(b).replace(b"\r\n", b""), b"chcp 65001" in z.read(b))
            for b in ("setup_windows.bat", "run_dashboard.bat", "import_excel.bat") if b in names}
    if not all(c and u for c, u in bats.values()):
        problems.append(f"bat line endings/codepage {bats}")
    manifest = json.loads(z.read("MANIFEST.json"))
    out = {"zip": zp.relative_to(ROOT).as_posix(), "files": len(names), "size_mb": round(zp.stat().st_size / 1e6, 1),
           "internal_check": "사내 데이터 0건 (internal_store·uploads 없음, management_inputs 값 0행, 번들 내 contains_internal_data=true 0건)" if not (bad or internal_flag or mi_vals) else "문제 발견",
           "secrets": ".env·키 파일 0건 (.env.example만 포함)" if not bad else "문제 발견",
           "required": f"{len(REQUIRED) - len(missing)}/{len(REQUIRED)} 포함" + (f" (누락 {missing})" if missing else ""),
           "wheels": f"{len(wheels)}개, pydantic_core {', '.join(cps) or '없음'} win_amd64",
           "bat": "3종 모두 CRLF + chcp 65001" if all(c and u for c, u in bats.values()) else str(bats),
           "manifest_include_internal": manifest.get("include_internal"), "data_version": manifest.get("data_version"),
           "problems": problems}
    (ROOT / "data" / "qa").mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "qa" / "package_check.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=1))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
