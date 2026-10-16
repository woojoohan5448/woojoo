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
