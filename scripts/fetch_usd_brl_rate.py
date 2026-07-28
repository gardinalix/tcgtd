from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ps_fetch import fetch_text


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_PATH = DATA_DIR / "fx_rates.json"
SOURCE_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL"


def main() -> None:
    payload = json.loads(fetch_text(SOURCE_URL, timeout_seconds=30))
    quote = payload.get("USDBRL", {})
    bid = float(quote["bid"])
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(
            {
                "usd_brl_rate": bid,
                "source": "AwesomeAPI USD-BRL bid",
                "source_url": SOURCE_URL,
                "as_of": quote.get("create_date") or quote.get("timestamp") or "",
                "fetched_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "raw": quote,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"output": str(OUTPUT_PATH), "usd_brl_rate": bid}, indent=2))


if __name__ == "__main__":
    main()
