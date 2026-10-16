"""Build the final internal handoff package: KA_Dashboard_Phase3A_Handoff.zip (project root).

python3 tools/make_handoff.py
- External-only: refuses if internal data is detected (same guard as make_release.py).
- Excludes venvs, caches, node_modules, logs (except QA evidence under docs/), temp outputs, archives, secrets.
- Adds HANDOFF_BUILD_INFO.json (branch / commit / tag / data_version) and MANIFEST.json (sha256 + size per file).
"""
import hashlib
import json
import platform
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.make_release import SECRET_NAMES, SECRET_SUFFIXES, internal_present  # noqa: E402

OUT = ROOT / "KA_Dashboard_Phase3A_Handoff.zip"
EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".pytest_cache", ".venv", "venv", "dist_release", "dist-single", ".vite", ".cache"}
EXCLUDE_PREFIX = ("data/internal_store/", "data/internal_inputs/uploads/", "data/raw/dart/")
EXCLUDE_SUFFIX = {".zip", ".pyc", ".pyo", ".tmp", ".bak", ".swp"}
EXCLUDE_NAMES = {".DS_Store", "Thumbs.db"}


def git(*a):
    return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout.strip()


def included(rel: Path) -> bool:
    s = rel.as_posix()
    if any(p in EXCLUDE_DIRS for p in rel.parts) or s.startswith(EXCLUDE_PREFIX):
        return False
    if rel.name in SECRET_NAMES or rel.name in EXCLUDE_NAMES or rel.suffix.lower() in SECRET_SUFFIXES | EXCLUDE_SUFFIX:
        return False
    if rel.suffix.lower() == ".log" and not s.startswith("docs/"):
        return False
    if len(rel.parts) == 2 and rel.parts[0] == "frontend" and rel.suffix.lower() == ".png":  # stale root screenshots
        return False
    return True


def main():
    hits = internal_present()
    if hits:
        print("[BLOCKED] 사내 데이터 감지:\n  " + "\n  ".join(hits[:20])); sys.exit(2)
    dash = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))
    head = git("rev-parse", "HEAD")
    info = {"package": OUT.name, "built_at": datetime.now(timezone.utc).isoformat(),
            "git": {"branch": git("rev-parse", "--abbrev-ref", "HEAD"), "commit": head, "commit_short": head[:7],
                    "tags_at_commit": git("tag", "--points-at", "HEAD").split(), "preserved_tags": [t for t in git("tag").split() if t.startswith("v")],
                    "tracked_changes": git("status", "--porcelain", "--untracked-files=no")},
            "data_version": dash["meta"]["data_version"], "contains_internal_data": dash["meta"].get("contains_internal_data"),
            "baseline": {"accounts": len(dash["accounts"]), "initiatives": len(dash.get("initiatives", [])),
                         "initiatives_approved": sum(1 for i in dash.get("initiatives", []) if i["approval_status"] != "PROPOSED"),
                         "priority_scores": {s["area"]: s["priority_score"] for s in dash["strategy"]},
                         "recon_switched": dash["recon"]["n_switched"], "recon_internal_records": dash["recon"]["n_internal_records"]},
            "built_with": {"python": platform.python_version(), "node": subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip()},
            "external_only": True}
    manifest = {"package": OUT.name, "commit": head, "files": {}}
    files = [p for p in sorted(ROOT.rglob("*")) if p.is_file() and included(p.relative_to(ROOT))]
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files:
            rel = p.relative_to(ROOT).as_posix()
            b = p.read_bytes()
            zi = zipfile.ZipInfo(rel, date_time=datetime.fromtimestamp(p.stat().st_mtime).timetuple()[:6])
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16  # rw-r--r-- on extraction
            z.writestr(zi, b)
            manifest["files"][rel] = {"sha256": hashlib.sha256(b).hexdigest(), "bytes": len(b)}
        info["n_files"] = len(files) + 2
        z.writestr("HANDOFF_BUILD_INFO.json", json.dumps(info, ensure_ascii=False, indent=1))
        z.writestr("MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"[OK] {OUT} ({info['n_files']} files, {OUT.stat().st_size / 1e6:.1f} MB) commit {head[:7]} tags {info['git']['tags_at_commit']}")


if __name__ == "__main__":
    main()
