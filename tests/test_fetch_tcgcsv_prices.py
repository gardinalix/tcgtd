from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

SPEC = importlib.util.spec_from_file_location(
    "fetch_tcgcsv_prices", SCRIPTS_DIR / "fetch_tcgcsv_prices.py"
)
assert SPEC and SPEC.loader
tcgcsv = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tcgcsv)


class TcgcsvPriceImportTests(unittest.TestCase):
    def test_user_agent_keeps_semicolon_in_a_valid_comment(self) -> None:
        self.assertEqual(
            tcgcsv.USER_AGENT,
            "Mozilla/5.0 (Codex Gundam Card DB; non-commercial community price cache)",
        )

    def test_fetch_json_retries_a_transient_request_failure(self) -> None:
        with patch.object(
            tcgcsv,
            "ps_fetch_text",
            side_effect=[RuntimeError("connection reset"), '{"success": true, "results": []}'],
        ) as fetch_text, patch.object(tcgcsv.time, "sleep") as sleep:
            payload = tcgcsv.fetch_json(
                "https://example.test/tcgplayer/86/groups",
                retries=1,
                retry_backoff_seconds=0.25,
            )

        self.assertEqual(payload, {"success": True, "results": []})
        self.assertEqual(fetch_text.call_count, 2)
        sleep.assert_called_once_with(0.25)


if __name__ == "__main__":
    unittest.main()
