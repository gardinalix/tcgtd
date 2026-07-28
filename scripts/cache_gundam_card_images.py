from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from build_gundam_web_data import group_printing_rows, normalize_text
from ps_fetch import download_file as ps_download_file


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
WEB_DIR = ROOT / "web"
GCG_PATH = DATA_DIR / "gundam_gcg_snapshot.json"
CARD_IMAGE_DIR = WEB_DIR / "assets" / "card-images"
MANIFEST_PATH = DATA_DIR / "gundam_card_image_cache.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)
REFERER = "https://www.gundam-gcg.com/en/cards/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cache official Gundam card images locally for the web app.")
    parser.add_argument("--card-number", default="", help="Optional exact card number to cache, including variants.")
    parser.add_argument("--variants-only", action="store_true", help="Only cache parallel/variant printings.")
    parser.add_argument("--limit", type=int, default=0, help="Optional max number of images to download.")
    parser.add_argument("--refresh", action="store_true", help="Re-download files even if they already exist.")
    parser.add_argument("--pause-ms", type=int, default=120, help="Delay between requests in milliseconds.")
    return parser.parse_args()


def parse_image_extension(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix else ".webp"


def build_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": REFERER,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
    )


def download_bytes(url: str) -> bytes:
    context = ssl.create_default_context()
    with urllib.request.urlopen(build_request(url), context=context, timeout=30) as response:
        return response.read()


def main() -> None:
    args = parse_args()
    CARD_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    snapshot = json.loads(GCG_PATH.read_text(encoding="utf-8"))
    printing_rows = group_printing_rows(snapshot.get("cards", []))

    manifest_rows: list[dict] = []
    downloaded = 0
    reused = 0
    failed = 0

    items: list[tuple[str, dict]] = []
    for card_number, rows in sorted(printing_rows.items(), key=lambda item: item[0]):
        if args.card_number and card_number.upper() != args.card_number.strip().upper():
            continue
        for row in rows:
            if args.variants_only and normalize_text(row.get("variant_code")) == "":
                continue
            detail_search_id = normalize_text(row.get("detail_search_id")) or card_number
            items.append((detail_search_id, row))
    if args.limit > 0:
        items = items[: args.limit]

    for index, (image_key, row) in enumerate(items, start=1):
        card_number = normalize_text(row.get("card_number")) or image_key
        remote_url = normalize_text(row.get("image_url"))
        if not remote_url:
            continue

        extension = parse_image_extension(remote_url)
        local_file = CARD_IMAGE_DIR / f"{image_key}{extension}"
        status = "reused"
        error_message = ""

        if local_file.exists() and not args.refresh:
            reused += 1
        else:
            try:
                if sys.platform.startswith("win"):
                    ps_download_file(remote_url, local_file, user_agent=USER_AGENT, timeout_seconds=30)
                else:
                    image_bytes = download_bytes(remote_url)
                    local_file.write_bytes(image_bytes)
                downloaded += 1
                status = "downloaded"
                time.sleep(max(0, args.pause_ms) / 1000)
            except urllib.error.URLError as error:
                failed += 1
                status = "failed"
                error_message = str(error.reason)
            except Exception as error:  # noqa: BLE001
                failed += 1
                status = "failed"
                error_message = str(error)

        manifest_rows.append(
            {
                "card_number": card_number,
                "detail_search_id": image_key,
                "card_name": normalize_text(row.get("card_name")),
                "remote_url": remote_url,
                "local_path": str(local_file.relative_to(ROOT)) if local_file.exists() else "",
                "status": status,
                "error": error_message,
            }
        )

        if index % 100 == 0:
            print(
                json.dumps(
                    {
                        "processed": index,
                        "downloaded": downloaded,
                        "reused": reused,
                        "failed": failed,
                    }
                )
            )

    manifest = {
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_snapshot_utc": snapshot.get("snapshot_generated_utc"),
        "downloaded": downloaded,
        "reused": reused,
        "failed": failed,
        "rows": manifest_rows,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "output_dir": str(CARD_IMAGE_DIR),
                "manifest": str(MANIFEST_PATH),
                "downloaded": downloaded,
                "reused": reused,
                "failed": failed,
                "total": len(manifest_rows),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
