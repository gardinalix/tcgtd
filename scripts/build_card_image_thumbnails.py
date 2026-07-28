from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CARD_IMAGE_DIR = ROOT / "web" / "assets" / "card-images"
THUMBNAIL_DIR = ROOT / ".scratch" / "card-thumbnails"
MANIFEST_PATH = ROOT / "data" / "gundam_card_thumbnail_cache.json"

MAX_SIZE = (108, 150)
JPEG_QUALITY = 76


def main() -> None:
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str | int]] = []
    created = 0
    reused = 0
    failed = 0

    for source_path in sorted(CARD_IMAGE_DIR.glob("*.*")):
        if source_path.suffix.lower() not in {".webp", ".png", ".jpg", ".jpeg"}:
            continue

        target_path = THUMBNAIL_DIR / f"{source_path.stem}.jpg"
        if (
            target_path.exists()
            and target_path.stat().st_mtime >= source_path.stat().st_mtime
            and thumbnail_is_current(target_path)
        ):
            reused += 1
            status = "reused"
        else:
            try:
                create_thumbnail(source_path, target_path)
                created += 1
                status = "created"
            except Exception as exc:  # noqa: BLE001 - keep the batch resilient.
                failed += 1
                rows.append(
                    {
                        "card_number": source_path.stem,
                        "source_path": str(source_path.relative_to(ROOT)),
                        "thumbnail_path": "",
                        "status": "failed",
                        "error": str(exc),
                    }
                )
                continue

        rows.append(
            {
                "card_number": source_path.stem,
                "source_path": str(source_path.relative_to(ROOT)),
                "thumbnail_path": str(target_path.relative_to(ROOT)),
                "status": status,
                "bytes": target_path.stat().st_size if target_path.exists() else 0,
            }
        )

    MANIFEST_PATH.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        json.dumps(
            {
                "thumbnail_dir": str(THUMBNAIL_DIR),
                "manifest": str(MANIFEST_PATH),
                "created": created,
                "reused": reused,
                "failed": failed,
                "total": len(rows),
            },
            ensure_ascii=False,
        )
    )


def create_thumbnail(source_path: Path, target_path: Path) -> None:
    with Image.open(source_path) as image:
        image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", MAX_SIZE, "white")
        image = image.convert("RGBA")
        x = (MAX_SIZE[0] - image.width) // 2
        y = (MAX_SIZE[1] - image.height) // 2
        canvas.paste(image, (x, y), image)
        canvas.save(target_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)


def thumbnail_is_current(target_path: Path) -> bool:
    try:
        with Image.open(target_path) as image:
            return image.size == MAX_SIZE
    except Exception:
        return False


if __name__ == "__main__":
    main()
