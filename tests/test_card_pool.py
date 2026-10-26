from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from card_catalog import validate_catalog, validate_package_count
import fetch_gundam_gcg_data as collector


def official_card(number="GD06-001", variant="", card_type="UNIT"):
    return {
        "detail_search_id": number + variant, "card_number": number, "card_name": "Updated official name",
        "type": card_type, "color": "Blue", "effect_text": "Draw 1.", "rarity": "R",
        "image_url": f"https://www.gundam-gcg.com/en/images/cards/card/{number}{variant}.webp",
        "package_code": "GD06", "package_label": "New set [GD06]", "where_to_get_it": "New set [GD06]",
        "variant_code": variant.removeprefix("_"), "is_parallel_variant": "TRUE" if variant else "FALSE",
    }


def snapshot(cards=None):
    cards = cards if cards is not None else [official_card()]
    return {"cards": cards, "cards_count": len(cards), "snapshot_generated_utc": "2026-10-15T12:00:00Z",
            "packages": [{"package_code": "GD06", "cards_expected": str(len(cards)), "cards_found": str(len(cards)),
                          "cards_search_url": "https://www.gundam-gcg.com/en/cards/?package=gd06"}]}


class CatalogValidationTests(unittest.TestCase):
    def test_empty_and_malformed_catalogs_are_rejected(self):
        for cards in ([], [official_card() | {"card_name": ""}], [official_card(), official_card()]):
            with self.subTest(cards=cards), self.assertRaises(ValueError):
                validate_catalog(snapshot(cards))

    def test_removing_a_printing_is_rejected_even_if_unique_card_count_is_unchanged(self):
        previous = snapshot([official_card(), official_card(variant="_p1")])
        with self.assertRaisesRegex(ValueError, "lost 1"):
            validate_catalog(snapshot(), previous)

    def test_new_printings_and_cards_are_accepted(self):
        validate_catalog(snapshot([official_card(), official_card(variant="_p1"), official_card("GD06-002")]), snapshot())

    def test_incomplete_package_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "expected 2"):
            validate_package_count("gd06", 2, ["GD06-001"])

    def test_changed_package_markup_does_not_overwrite_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            data.mkdir()
            path = data / "gundam_gcg_snapshot.json"
            path.write_text(json.dumps(snapshot()))
            before = path.read_bytes()
            with patch.object(collector, "DATA_DIR", data), patch.object(collector, "fetch_text", return_value="<html>Maintenance</html>"):
                with self.assertRaisesRegex(ValueError, "No official packages"):
                    collector.main()
            self.assertEqual(path.read_bytes(), before)


class PublicPayloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "scripts", self.root / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
        self.web = self.root / "web"
        self.web.mkdir()
        self.data = self.root / "data"
        (self.data / "competitive" / "generated").mkdir(parents=True)
        (self.data / "competitive" / "generated" / "frontend-meta.json").write_text(json.dumps({"metaEvents": [{"eventDate": "2026-10-14"}], "metaResults": [], "metaDeckCards": []}))
        self.previous = {
            "generatedAt": "2026-10-11T00:00:00Z", "cardSnapshotGeneratedAt": "2026-10-11T00:00:00Z",
            "cards": [{"cardNumber": "GD06-001", "cardName": "Old name", "cardType": "UNIT", "copyLimit": 2,
                       "restrictionNote": "Reviewed limit", "recentMetaScore": 42, "topArchetypes": [{"label": "Example, with punctuation", "count": 7}],
                       "marketPriceUsd": 12.5, "priceLastCheckedUtc": "2026-10-11", "ligaGundamLowPriceBrl": 80,
                       "printings": [{"detailSearchId": "GD06-001", "marketPriceUsd": 12.5},
                                     {"detailSearchId": "GD06-001_p1", "marketPriceUsd": 99}]}],
            "resourceCards": [], "rules": {"currentRestrictions": ["keep reviewed rules"]},
            "counts": {"main_deck_cards": 1, "resource_cards": 0, "archetypes": 4},
            "defaults": {"primary_color": "Blue"}, "filters": {"archetypes": ["Example"]},
            "archetypes": [{"id": "example"}], "templates": [{"id": "example-template"}], "colorPairs": [], "sources": [],
            "previews": [{"previewId": "keep-me"}], "products": [{"productCode": "GD06"}], "packages": [],
            "marketListings": [{"cardNumber": "GD06-001", "priceBrl": 80}], "fxRate": {"usd_brl_rate": 5},
        }
        self.path = self.web / "app-data.json"
        self.path.write_text(json.dumps(self.previous))

    def build(self, check=True):
        return subprocess.run([sys.executable, str(self.root / "scripts" / "build_gundam_web_data.py")], cwd=self.root, capture_output=True, text=True, check=check)

    def test_tracked_only_checkout_keeps_public_cards_prices_and_rules(self):
        self.build()
        current = json.loads(self.path.read_text())
        for key in ("cards", "resourceCards", "rules", "defaults", "archetypes", "templates", "previews", "products", "marketListings", "fxRate"):
            self.assertEqual(current[key], self.previous[key], key)
        self.assertEqual(current["cardSnapshotGeneratedAt"], self.previous["cardSnapshotGeneratedAt"])
        self.assertEqual(current["metaEvents"][0]["eventDate"], "2026-10-14")
        first = self.path.read_bytes()
        self.build()
        self.assertEqual(self.path.read_bytes(), first)

    def test_official_release_enters_pool_without_advisor_or_price_caches(self):
        cards = [official_card(), official_card(variant="_p1"), official_card("GD06-002"), official_card("EXR-001", card_type="RESOURCE")]
        (self.data / "gundam_gcg_snapshot.json").write_text(json.dumps(snapshot(cards)))
        self.build()
        current = json.loads(self.path.read_text())
        self.assertEqual({row["cardNumber"] for row in current["cards"]}, {"GD06-001", "GD06-002"})
        self.assertEqual(current["resourceCards"][0]["cardNumber"], "EXR-001")
        updated = next(row for row in current["cards"] if row["cardNumber"] == "GD06-001")
        self.assertEqual(updated["cardName"], "Updated official name")
        for key in ("recentMetaScore", "topArchetypes", "copyLimit", "restrictionNote", "marketPriceUsd", "priceLastCheckedUtc", "ligaGundamLowPriceBrl"):
            self.assertEqual(updated[key], self.previous["cards"][0][key], key)
        self.assertEqual([row["marketPriceUsd"] for row in updated["printings"]], [12.5, 99])
        new = next(row for row in current["cards"] if row["cardNumber"] == "GD06-002")
        self.assertIsNone(new["marketPriceUsd"])
        self.assertEqual(current["packages"][0]["resultCount"], 4)
        self.assertEqual(current["packages"][0]["detailCount"], 4)
        self.assertTrue(current["packages"][0]["packageUrl"].startswith("https://"))
        self.assertEqual(current["counts"]["main_deck_cards"], 2)
        self.assertEqual(current["rules"], self.previous["rules"])

    def test_failed_catalog_rebuild_preserves_both_public_files(self):
        (self.web / "app-data.js").write_text("previous JS")
        (self.data / "gundam_gcg_snapshot.json").write_text(json.dumps(snapshot()))
        before = self.path.read_bytes()
        result = self.build(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual((self.web / "app-data.js").read_text(), "previous JS")

    def test_official_identity_overrides_stale_advisor(self):
        (self.data / "gundam_gcg_snapshot.json").write_text(json.dumps(snapshot([official_card(), official_card(variant="_p1"), official_card("GD06-002")])))
        (self.data / "gundam_deck_advisor_snapshot.json").write_text(json.dumps({"card_advisor_rows": [{"card_number": "GD06-001", "card_name": "Stale", "recent_meta_score": 55}]}))
        self.build()
        cards = json.loads(self.path.read_text())["cards"]
        self.assertEqual(len(cards), 2)
        updated = next(row for row in cards if row["cardNumber"] == "GD06-001")
        self.assertEqual(updated["cardName"], "Updated official name")
        self.assertEqual(updated["recentMetaScore"], 55)

    def test_skip_fetch_requires_a_real_snapshot(self):
        before = self.path.read_bytes()
        result = subprocess.run([sys.executable, str(self.root / "scripts" / "refresh_card_pool.py"), "--skip-fetch"], cwd=self.root, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(json.loads((self.data / "latest_card_pool_report.json").read_text())["status"], "failed")

    def test_card_only_command_reports_new_cards_and_printings(self):
        cards = [official_card(), official_card(variant="_p1"), official_card("GD06-002")]
        (self.data / "gundam_gcg_snapshot.json").write_text(json.dumps(snapshot(cards)))
        subprocess.run(["node", str(self.root / "scripts" / "run-python.mjs"), "scripts/refresh_card_pool.py", "--skip-fetch"], cwd=self.root, capture_output=True, text=True, check=True)
        report = json.loads((self.data / "latest_card_pool_report.json").read_text())
        self.assertEqual(report["status"], "ok")
        self.assertEqual(report["new_card_numbers"], ["GD06-002"])
        self.assertEqual(report["new_printing_ids"], ["GD06-002"])
        self.assertEqual(report["total_printings"], 3)


if __name__ == "__main__":
    unittest.main()
