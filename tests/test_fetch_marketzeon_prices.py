from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

SPEC = importlib.util.spec_from_file_location(
    "fetch_marketzeon_prices", SCRIPTS_DIR / "fetch_marketzeon_prices.py"
)
assert SPEC and SPEC.loader
marketzeon = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(marketzeon)


class MarketZeonPriceImportTests(unittest.TestCase):
    def test_preserves_existing_cache_when_the_public_bundle_disappears(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            listings = directory / "marketzeon_listings.csv"
            comparison = directory / "marketzeon_price_comparison.csv"
            snapshot = directory / "marketzeon_prices.json"
            for path in (listings, comparison, snapshot):
                path.write_text("complete-cache", encoding="utf-8")

            output = io.StringIO()
            with patch.object(marketzeon, "LISTINGS_CSV_PATH", listings), patch.object(
                marketzeon, "COMPARISON_CSV_PATH", comparison
            ), patch.object(marketzeon, "SNAPSHOT_JSON_PATH", snapshot), patch.object(
                marketzeon, "fetch_marketzeon_bundle_url", side_effect=RuntimeError("bundle missing")
            ), patch.object(sys, "argv", ["fetch_marketzeon_prices.py"]), contextlib.redirect_stdout(output):
                marketzeon.main()

            result = json.loads(output.getvalue())
            self.assertEqual(result["status"], "cached")
            self.assertEqual(listings.read_text(encoding="utf-8"), "complete-cache")
            self.assertEqual(comparison.read_text(encoding="utf-8"), "complete-cache")
            self.assertEqual(snapshot.read_text(encoding="utf-8"), "complete-cache")


if __name__ == "__main__":
    unittest.main()
