"""CLI wrapper — the contract validator lives in models/recon/contract.py.

python3 tools/contract_validate.py <records.json> [--mode test|production] [--out report.json]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from models.recon.contract import *  # noqa: F401,F403  (re-export for tests/tools)
from models.recon.contract import main

if __name__ == "__main__":
    sys.exit(main())
