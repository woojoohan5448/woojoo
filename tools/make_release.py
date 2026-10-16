"""Build a migration package for the internal cloud PC.

python3 tools/make_release.py [--include-internal]
- Default: EXTERNAL-ONLY package (no data/internal_store, no uploaded Excel, management_inputs reset check).
- Refuses to package if internal data is detected unless --include-internal is passed explicitly.
Output: dist_release/KeyAccountIntel_<version>.zip + MANIFEST.json (sha256 per file)
"""
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".pytest_cache", ".venv", "dist_release", "dist-single"}
INTERNAL = [ROOT / "data" / "internal_store", ROOT / "data" / "internal_inputs" / "uploads"]


def internal_present():
    hits = [str(p) for d in INTERNAL if d.exists() for p in d.rglob("*") if p.is_file()]
    import csv
    mi = ROOT / "data" / "internal_inputs" / "management_inputs.csv"
    if mi.exists():
        for r in csv.DictReader(open(mi, encoding="utf-8-sig")):
            if any((r.get(k) or "").strip() for k in ("cr_2026_ytd_eok", "cr_2026_forecast_eok", "target_revenue_2031_eok")):
                hits.append(f"{mi} (row {r['account_id']})")
    d = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))
    if d["meta"].get("contains_internal_data"):
        hits.append("data/processed/dashboard.json (contains_internal_data=true)")
    return hits


def main():
    include_internal = "--include-internal" in sys.argv
    hits = internal_present()
    if hits and not include_internal:
        print("[BLOCKED] 사내 데이터 감지 — 외부 반출 패키지 생성 중단:\n  " + "\n  ".join(hits[:20]))
        sys.exit(2)
    d = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))
    ver = d["meta"]["data_version"]
    out = ROOT / "dist_release"; out.mkdir(exist_ok=True)
    zp = out / f"KeyAccountIntel_{ver}{'_INTERNAL' if include_internal else ''}.zip"
    manifest = {"data_version": ver, "built_at": datetime.now(timezone.utc).isoformat(), "include_internal": include_internal, "files": {}}
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(ROOT.rglob("*")):
            rel = p.relative_to(ROOT)
            if p.is_dir() or any(part in EXCLUDE_DIRS for part in rel.parts):
                continue
            if not include_internal and any(str(p).startswith(str(i)) for i in INTERNAL):
                continue
            if p.suffix in (".zip",) and "dist_release" not in rel.parts:
                continue
            z.write(p, rel.as_posix())
            manifest["files"][rel.as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
        z.writestr("MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"[OK] {zp} ({len(manifest['files'])} files)")


if __name__ == "__main__":
    main()
