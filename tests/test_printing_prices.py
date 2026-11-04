import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_gundam_web_data import build_printings, pick_tcgplayer_printing_price


def product(group="GD06", rarity="Legend Rare", price="5", product_id="base"):
    return {"tcgplayer_group_abbreviation": group, "tcgplayer_rarity": rarity,
            "tcgplayer_product_name": "Gundam GP01Fb", "market_price_usd": price,
            "tcgplayer_product_id": product_id, "price_status": "ok"}


class PrintingPriceIdentityTests(unittest.TestCase):
    def test_unlisted_parallel_has_no_base_price_or_product_link(self):
        printings = build_printings("GD06-001", [{"detail_search_id": "GD06-001_p1",
            "package_code": "GD06", "rarity": "LR +", "is_parallel_variant": "TRUE"}],
            tcgplayer_printing_price_groups={"GD06-001": [product()]}, fx_rate={"usd_brl_rate": 5})
        self.assertEqual(printings[0]["priceStatus"], "variant_not_mapped")
        self.assertNotIn("marketPriceUsd", printings[0])
        self.assertNotIn("tcgplayerProductId", printings[0])

    def test_reprint_does_not_inherit_original_set_price(self):
        self.assertIsNone(pick_tcgplayer_printing_price("GD02-129",
            {"packageCode": "GD06", "rarity": "LR"}, {"GD02-129": [product(group="GD02")]}))

    def test_matching_parallel_is_selected_even_if_base_is_cheaper(self):
        alternate = product(rarity="LR+", price="120", product_id="parallel")
        selected = pick_tcgplayer_printing_price("GD06-001", {"packageCode": "GD06", "rarity": "LR +"},
            {"GD06-001": [product(), product(group="GD05", rarity="LR+", price="1"), alternate]})
        self.assertIs(selected, alternate)

    def test_booster_group_suffix_still_matches_official_set(self):
        booster = product(group="GD06_B")
        self.assertIs(pick_tcgplayer_printing_price("GD06-001", {"packageCode": "GD06", "rarity": "LR"},
            {"GD06-001": [booster]}), booster)


if __name__ == "__main__":
    unittest.main()
