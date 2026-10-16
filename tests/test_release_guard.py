"""Release packager must refuse to bundle internal data by default."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("make_release", ROOT / "tools" / "make_release.py")
mr = importlib.util.module_from_spec(spec); spec.loader.exec_module(mr)


def test_detects_internal_store(tmp_path):
    store = tmp_path / "internal_store"; store.mkdir()
    (store / "INTERNAL_ACTUAL.json").write_text("{}", encoding="utf-8")
    mr.INTERNAL = [store]
    assert any("INTERNAL_ACTUAL.json" in h for h in mr.internal_present())


def test_clean_tree_has_no_internal(tmp_path):
    mr.INTERNAL = [tmp_path / "nothing"]
    assert mr.internal_present() == []


def _fake_root(tmp_path):
    (tmp_path / "data" / "processed").mkdir(parents=True)
    (tmp_path / "data" / "processed" / "dashboard.json").write_text('{"meta": {"contains_internal_data": false}}', encoding="utf-8")
    return tmp_path


def test_stray_spreadsheet_blocks_packaging(tmp_path, monkeypatch):
    root = _fake_root(tmp_path)
    (root / "고객매출_2026.xlsx").write_bytes(b"PK")  # internal Excel dropped outside the allowed folders
    monkeypatch.setattr(mr, "ROOT", root); monkeypatch.setattr(mr, "INTERNAL", [root / "nothing"])
    assert any("고객매출_2026.xlsx" in h for h in mr.internal_present())


def test_bundled_dashboard_with_internal_flag_blocks(tmp_path, monkeypatch):
    root = _fake_root(tmp_path)
    (root / "Key_Account_Dashboard.html").write_text('<script>{"meta":{"contains_internal_data": true}}</script>', encoding="utf-8")
    monkeypatch.setattr(mr, "ROOT", root); monkeypatch.setattr(mr, "INTERNAL", [root / "nothing"])
    assert any("Key_Account_Dashboard.html" in h for h in mr.internal_present())


def test_secrets_are_never_packaged():
    assert mr._skip(Path(".env")) and mr._skip(Path("certs/server.pem")) and not mr._skip(Path(".env.example"))
