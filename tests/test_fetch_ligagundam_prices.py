import contextlib
import csv
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_ligagundam_prices as liga

VALID = '<html><form action="?view=cards/search"></form>{}</html>'
LISTING = '<div class="mtg-single"><a href="?view=cards/card&amp;num=GD01-001">Gundam</a><div class="mtg-numeric-code">(GD01-001)</div><div class="price-min">R$ 20,00</div>'


class LigaCollectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for key, name in [("DATA_DIR", ""), ("LISTINGS_CSV_PATH", "listings.csv"),
                          ("OUTPUT_CSV_PATH", "comparison.csv"), ("SNAPSHOT_JSON_PATH", "snapshot.json"),
                          ("SCAN_REPORT_PATH", "report.json")]:
            self.enterContext(patch.object(liga, key, root / name))
        with liga.LISTINGS_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=liga.LISTING_COLUMNS)
            writer.writeheader()
            for number in ["GD01-001", "GD01-002"]:
                writer.writerow({"card_number": number, "listing_id": number, "title": "Old price", "price_brl": "10.00",
                                 "url": f"https://www.ligagundam.com.br/?view=cards/card&num={number}", "fetched_at_utc": "2026-11-13T12:00:00Z"})
        liga.OUTPUT_CSV_PATH.write_text("card_number,price_last_checked_utc\nGD01-001,2026-11-13\nGD01-002,2026-11-13\n")
        liga.SNAPSHOT_JSON_PATH.write_text('{"generated_at_utc":"2026-11-13"}')
        self.enterContext(patch.object(liga, "read_tcg_reference", return_value={"GD01-001": {"reference_brl": 5}, "GD01-002": {"reference_brl": 5}}))

    def run_scan(self, args, responses):
        with patch.object(sys, "argv", ["fetch", "--sleep-seconds", "0", *args]), patch.object(liga, "fetch_search", side_effect=responses) as fetch, contextlib.redirect_stdout(io.StringIO()):
            result = liga.main()
        return result, fetch.call_count

    def test_cloudflare_is_an_error_even_when_http_returns_html(self):
        with patch.object(liga, "fetch_text", return_value='<html><title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/"></script></html>'):
            with self.assertRaises(liga.SearchBlockedError):
                liga.fetch_search("Gundam")
        with self.assertRaises(ValueError):
            liga.validate_search_page("<html>Maintenance</html>")

    def test_blocked_scan_preserves_all_price_files_and_stops_after_one_request(self):
        paths = [liga.LISTINGS_CSV_PATH, liga.OUTPUT_CSV_PATH, liga.SNAPSHOT_JSON_PATH]
        before = [p.read_bytes() for p in paths]
        result, calls = self.run_scan(["--terms", "Gundam", "Pilot", "--fresh"], [liga.SearchBlockedError("Cloudflare")])
        self.assertEqual((result, calls), (1, 1))
        self.assertEqual([p.read_bytes() for p in paths], before)
        report = json.loads(liga.SCAN_REPORT_PATH.read_text())
        self.assertEqual(report["status"], "blocked")
        self.assertEqual(report["last_observation_utc"], "2026-11-13T12:00:00Z")

    def test_partial_scan_preserves_timestamps_for_unobserved_listings(self):
        result, calls = self.run_scan(["--terms", "Gundam", "Pilot", "--fresh"], [VALID.format(LISTING), liga.SearchBlockedError("Cloudflare")])
        self.assertEqual(result, 1)
        with liga.OUTPUT_CSV_PATH.open(encoding="utf-8-sig") as handle:
            rows = {row["card_number"]: row for row in csv.DictReader(handle)}
        self.assertEqual(rows["GD01-001"]["ligagundam_low_price_brl"], "20.00")
        self.assertNotEqual(rows["GD01-001"]["price_last_checked_utc"], "2026-11-13T12:00:00Z")
        self.assertEqual(rows["GD01-002"]["price_last_checked_utc"], "2026-11-13T12:00:00Z")

    def test_successful_empty_exact_search_retires_the_old_listing(self):
        result, calls = self.run_scan(["--terms", "GD01-001"], [VALID.format("No results")])
        self.assertEqual(result, 0)
        self.assertEqual({item["card_number"] for item in liga.load_existing_rows().values()}, {"GD01-002"})

    def test_valid_search_prices_still_parse(self):
        liga.validate_search_page(VALID.format(LISTING))
        self.assertEqual(liga.parse_search_cards(VALID.format(LISTING))[0]["low"], 20)

    def test_browser_import_validates_source_and_does_not_use_http(self):
        path = liga.DATA_DIR / "browser.json"
        snapshot = {"source_url": "https://www.ligagundam.com.br/?view=cards/search&card=Gundam",
                    "observed_at_utc": "2026-11-19T12:00:00Z", "listings": [{
                        "listing_id": "GD01-001", "title": "Gundam", "low": 20,
                        "url": "https://www.ligagundam.com.br/?view=cards/card&num=GD01-001"}]}
        path.write_text(json.dumps(snapshot))
        result, calls = self.run_scan(["--browser-snapshot", str(path)], [])
        self.assertEqual((result, calls), (0, 0))
        self.assertEqual(json.loads(liga.SCAN_REPORT_PATH.read_text())["status"], "partial")
        snapshot["listings"][0]["url"] = "https://evil.example/?view=cards/card&num=GD01-001"
        path.write_text(json.dumps(snapshot))
        with self.assertRaises(ValueError):
            liga.read_browser_snapshot(path)


if __name__ == "__main__":
    unittest.main()
