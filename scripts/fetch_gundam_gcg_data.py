from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html import unescape
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import Request, urlopen

from lxml import html

from ps_fetch import fetch_text as ps_fetch_text


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SCRATCH_DIR = ROOT / ".scratch" / "official_html"
CARDS_DIR = SCRATCH_DIR / "cards"
CARD_DETAILS_DIR = CARDS_DIR / "details"
PRODUCTS_DIR = SCRATCH_DIR / "products"
PRODUCT_DETAILS_DIR = PRODUCTS_DIR / "details"
NEWS_DIR = SCRATCH_DIR / "news"
NEWS_DETAILS_DIR = NEWS_DIR / "details"

BASE_SITE_URL = "https://www.gundam-gcg.com"
BASE_EN_URL = f"{BASE_SITE_URL}/en/"
CARDS_INDEX_URL = urljoin(BASE_EN_URL, "cards/")
PRODUCTS_LIST_URL = urljoin(BASE_EN_URL, "products/list.php")
NEWS_INDEX_URL = urljoin(BASE_EN_URL, "news/")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)
if sys.platform.startswith("win"):
    SSL_CONTEXT = None
else:
    import ssl

    SSL_CONTEXT = ssl._create_unverified_context()
FETCH_RETRIES = 3
FETCH_TIMEOUT = 45
MAX_WORKERS = 8
IMAGE_EXTENSIONS = (".webp", ".png", ".jpg", ".jpeg")
CARD_NUMBER_HINT_RE = re.compile(r"([A-Z]{1,6}\d{0,2}-\d{3})", re.IGNORECASE)
MONTH_NAME_RE = (
    r"January|February|March|April|May|June|July|August|September|October|November|December"
)
DATE_IN_TEXT_RE = re.compile(rf"({MONTH_NAME_RE})\s+\d{{1,2}},\s*\d{{4}}")
PREVIEW_KEYWORDS = (
    "early reveal",
    "featured cards",
    "preview",
    "first look",
    "bonus pack",
    "sample card",
    "sample cards",
    "revealed during the stream",
)
SKIP_IMAGE_HINTS = (
    "logo",
    "icon",
    "share",
    "sns",
    "facebook",
    "twitter",
    "x_logo",
    "youtube",
    "ytimg",
    "button",
    "btn",
    "comingsoon",
    "pagetop",
    "arrow",
    "bnid",
)


@dataclass(frozen=True)
class PackageInfo:
    package_id: str
    package_label: str
    package_code: str
    package_kind: str
    cards_search_url: str


@dataclass(frozen=True)
class NewsPageInfo:
    record_id: str
    news_url: str
    news_title: str


def normalize_space(value: str | None) -> str:
    if value is None:
        return ""
    text = value.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_multiline_text(value: str | None) -> str:
    if value is None:
        return ""
    value = value.replace("\r", "")
    lines = [normalize_space(line) for line in value.split("\n")]
    return "\n".join(line for line in lines if line)


def extract_text(node) -> str:
    return clean_multiline_text(node.text_content() if node is not None else "")


def extract_html_lines(node) -> str:
    if node is None:
        return ""

    parts: list[str] = []

    def walk(current) -> None:
        if current.text:
            parts.append(current.text)
        for child in current:
            if child.tag == "br":
                parts.append("\n")
            walk(child)
            if child.tail:
                parts.append(child.tail)

    walk(node)
    text = unescape("".join(parts))
    return clean_multiline_text(text)


def fetch_text(url: str, target_path: Path) -> str:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            request = Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            if sys.platform.startswith("win"):
                try:
                    text = ps_fetch_text(url, user_agent=USER_AGENT, timeout_seconds=FETCH_TIMEOUT)
                except Exception:
                    urlopen_kwargs = {"timeout": FETCH_TIMEOUT}
                    if SSL_CONTEXT is not None:
                        urlopen_kwargs["context"] = SSL_CONTEXT
                    with urlopen(request, **urlopen_kwargs) as response:
                        raw = response.read()
                    text = raw.decode("utf-8", errors="replace")
            else:
                urlopen_kwargs = {"timeout": FETCH_TIMEOUT}
                if SSL_CONTEXT is not None:
                    urlopen_kwargs["context"] = SSL_CONTEXT
                with urlopen(request, **urlopen_kwargs) as response:
                    raw = response.read()
                text = raw.decode("utf-8", errors="replace")
            target_path.write_text(text, encoding="utf-8")
            return text
        except Exception as exc:  # pragma: no cover - best effort network retry
            last_error = exc
            if attempt == FETCH_RETRIES:
                break
            time.sleep(1.5 * attempt)
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def infer_package_code(label: str) -> str:
    match = re.search(r"\[([A-Z0-9\-]+)\]", label)
    return match.group(1) if match else ""


def infer_package_kind(label: str, code: str) -> str:
    if code.startswith("GD"):
        return "Booster Pack"
    if code.startswith("ST"):
        return "Starter Deck"
    if code.startswith("EB"):
        return "Extra Booster"
    if code.startswith("SC"):
        return "Special/Side Product"
    if code.startswith("EVX"):
        return "Accessory Set"

    lowered = label.lower()
    if "edition beta" in lowered:
        return "Edition Beta"
    if "basic cards" in lowered:
        return "Basic Cards"
    if "promotion card" in lowered:
        return "Promotion Card"
    if "other product card" in lowered:
        return "Other Product Card"
    return "Other"


def resolve_url(relative_or_absolute: str, base_url: str = BASE_EN_URL) -> str:
    return urljoin(base_url, relative_or_absolute)


def slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return slug[:80] or "page"


def parse_human_date(value: str | None) -> date | None:
    cleaned = normalize_space(value)
    if not cleaned:
        return None
    for fmt in ("%B %d, %Y", "%B %d,%Y", "%b %d, %Y", "%b %d,%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def format_human_date(value: date | None) -> str:
    if value is None:
        return ""
    return value.strftime("%B %d, %Y").replace(" 0", " ")


def extract_first_date_text(value: str) -> str:
    match = DATE_IN_TEXT_RE.search(value or "")
    if not match:
        return ""
    return format_human_date(parse_human_date(match.group(0)))


def is_image_asset_url(url: str) -> bool:
    return urlparse(url).path.lower().endswith(IMAGE_EXTENSIONS)


def should_skip_image_url(url: str) -> bool:
    lowered = url.lower()
    if any(hint in lowered for hint in SKIP_IMAGE_HINTS):
        return True
    return not is_image_asset_url(url)


def extract_card_number_hint(*values: str) -> str:
    for value in values:
        match = CARD_NUMBER_HINT_RE.search((value or "").upper())
        if match:
            return match.group(1).upper()
    return ""


def truncate_text(value: str, limit: int = 420) -> str:
    value = normalize_space(value)
    if len(value) <= limit:
        return value
    return value[: limit - 3].rstrip() + "..."


def get_related_product_code(
    page_text: str,
    known_product_codes: set[str],
    preferred_codes: Iterable[str] | None = None,
) -> str:
    candidates = [code for code in (preferred_codes or []) if code]
    candidates.extend(sorted(known_product_codes, key=len, reverse=True))
    upper_text = (page_text or "").upper()
    for code in candidates:
        upper_code = code.upper()
        if f"[{upper_code}]" in upper_text:
            return upper_code
        if re.search(rf"\b{re.escape(upper_code)}\b", upper_text):
            return upper_code
    return ""


def nearest_preceding_heading(node) -> str:
    headings = node.xpath(
        "preceding::*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5][normalize-space()]"
    )
    return extract_text(headings[-1]) if headings else ""


def collect_neighbor_text(node) -> str:
    previous_nodes = node.xpath(
        "preceding::*[(self::p or self::li or self::h3 or self::h4 or self::h5) and normalize-space()]"
    )
    next_nodes = node.xpath(
        "following::*[(self::p or self::li) and normalize-space()]"
    )
    chunks: list[str] = []
    for item in previous_nodes[-2:]:
        text = extract_text(item)
        if text and text not in chunks:
            chunks.append(text)
    for item in next_nodes[:2]:
        text = extract_text(item)
        if text and text not in chunks:
            chunks.append(text)
    return truncate_text(" ".join(chunks))


def derive_card_name_hint(section_heading: str, context_text: str) -> str:
    combined = f"{section_heading} {context_text}".strip()
    patterns = [
        r"early look at the (.+?) resource card",
        r"the (.+?) resource card was shared",
        r"preview of the (.+?) resource card",
    ]
    lowered = combined.lower()
    for pattern in patterns:
        match = re.search(pattern, lowered, re.IGNORECASE)
        if match:
            value = normalize_space(match.group(1))
            return value.title() if value.islower() else value
    return ""


def normalize_card_name_hint(value: str) -> str:
    cleaned = normalize_space(value)
    if cleaned.lower() in {"card", "image", "sample", "preview"}:
        return ""
    return cleaned


def is_preview_candidate(
    image_url: str,
    section_heading: str,
    context_text: str,
    source_type: str,
) -> bool:
    if should_skip_image_url(image_url):
        return False

    lowered_url = image_url.lower()
    if extract_card_number_hint(image_url):
        return True
    if "dummy_sample" in lowered_url:
        return True

    combined = f"{section_heading} {context_text}".lower()
    if source_type == "product_page_featured_card":
        return "featured cards" in combined or "card" in section_heading.lower()

    heading_lower = section_heading.lower()
    return any(keyword in heading_lower for keyword in PREVIEW_KEYWORDS)


def build_preview_record(
    *,
    classification: str,
    source_type: str,
    source_title: str,
    source_date: str,
    section_heading: str,
    context_text: str,
    card_number_hint: str,
    card_name_hint: str,
    product: dict | None,
    product_code: str,
    product_name: str,
    product_release_date: str,
    product_url: str,
    source_url: str,
    image_url: str,
    released_card_counts: dict[str, int],
) -> dict:
    matched_released_printings = released_card_counts.get(card_number_hint, 0) if card_number_hint else 0
    preview_status = "released_match_found" if matched_released_printings else "preview_only"
    preview_id = hashlib.sha1(f"{source_url}|{image_url}|{card_number_hint}".encode("utf-8")).hexdigest()[:16]
    return {
        "preview_id": preview_id,
        "classification": classification,
        "preview_status": preview_status,
        "confidence": "high",
        "source_type": source_type,
        "source_title": source_title,
        "source_date": source_date,
        "section_heading": section_heading,
        "card_number_hint": card_number_hint,
        "card_name_hint": normalize_card_name_hint(card_name_hint),
        "product_code": product_code or (product.get("product_code", "") if product else ""),
        "product_name": product_name or (product.get("product_name", "") if product else ""),
        "product_release_date": product_release_date or (product.get("release_date", "") if product else ""),
        "matched_released_card": "TRUE" if matched_released_printings else "FALSE",
        "matched_released_printings": matched_released_printings,
        "context_text": context_text,
        "source_url": source_url,
        "product_url": product_url or (product.get("product_url", "") if product else ""),
        "image_url": image_url,
    }


def parse_cards_index(cards_index_html: str) -> list[PackageInfo]:
    tree = html.fromstring(cards_index_html)
    seen_ids: set[str] = set()
    packages: list[PackageInfo] = []
    for anchor in tree.xpath("//a[contains(@class, 'js-selectBtn-package')]"):
        package_id = normalize_space(anchor.get("data-val"))
        if not package_id or package_id in seen_ids:
            continue
        label = extract_text(anchor)
        code = infer_package_code(label)
        packages.append(
            PackageInfo(
                package_id=package_id,
                package_label=label,
                package_code=code,
                package_kind=infer_package_kind(label, code),
                cards_search_url=f"{CARDS_INDEX_URL}?package={package_id}",
            )
        )
        seen_ids.add(package_id)

    packages.sort(key=lambda item: (item.package_kind, item.package_code or item.package_label))
    return packages


def parse_detail_ids(package_html: str) -> tuple[int, list[str]]:
    tree = html.fromstring(package_html)
    result_count_text = tree.xpath("string(//div[contains(@class, 'resultTxt')]/span[@class='num'])")
    result_count = int(normalize_space(result_count_text) or "0")

    detail_ids: list[str] = []
    seen: set[str] = set()
    for anchor in tree.xpath("//a[contains(@class, 'cardStr')]"):
        data_src = anchor.get("data-src", "")
        match = re.search(r"detailSearch=([^&]+)", data_src)
        if not match:
            continue
        detail_id = match.group(1)
        if detail_id in seen:
            continue
        detail_ids.append(detail_id)
        seen.add(detail_id)
    return result_count, detail_ids


def parse_card_detail(detail_id: str, package_info: PackageInfo, detail_html: str) -> tuple[dict, list[dict]]:
    tree = html.fromstring(detail_html)

    detail_page_url = resolve_url(f"cards/detail.php?detailSearch={detail_id}")
    card_number = normalize_space(tree.xpath("string(//div[@class='cardNo'])"))
    rarity = normalize_space(tree.xpath("string(//div[@class='rarity'])"))
    block_icon = normalize_space(tree.xpath("string(//div[@class='blockIcon'])"))
    card_name = normalize_space(tree.xpath("string(//h1[contains(@class, 'cardName')])"))
    image_src = normalize_space(tree.xpath("string(//div[contains(@class, 'cardImage')]//img/@src)"))
    overview_node = tree.xpath("//div[contains(@class, 'cardDataRow') and contains(@class, 'overview')]//div[contains(@class, 'dataTxt')]")
    overview_text = extract_html_lines(overview_node[0]) if overview_node else ""

    data_map: dict[str, str] = {}
    for box in tree.xpath("//div[contains(@class, 'cardData')]//dl[contains(@class, 'dataBox')]"):
        key = normalize_space(box.xpath("string(./dt)"))
        value = extract_text(box.xpath("./dd")[0]) if box.xpath("./dd") else ""
        if key:
            data_map[key] = value

    cards_link = ""
    product_link = ""
    for anchor in tree.xpath("//div[contains(@class, 'btnCol')]//a"):
        label = normalize_space(anchor.text_content()).upper()
        href = normalize_space(anchor.get("href"))
        if label == "CARDS":
            cards_link = resolve_url(href, detail_page_url)
        elif label == "PRODUCTS":
            product_link = resolve_url(href, detail_page_url)

    package_id_from_detail = ""
    if cards_link:
        package_id_from_detail = parse_qs(urlparse(cards_link).query).get("package", [""])[0]

    variant_match = re.match(rf"^{re.escape(card_number)}(?:_(.+))?$", detail_id)
    variant_code = (variant_match.group(1) if variant_match else "") or ""

    card_record = {
        "detail_search_id": detail_id,
        "card_number": card_number,
        "variant_code": variant_code,
        "is_parallel_variant": "TRUE" if bool(variant_code) else "FALSE",
        "card_name": card_name,
        "rarity": rarity,
        "block_icon": block_icon,
        "level": data_map.get("Lv.", ""),
        "cost": data_map.get("COST", ""),
        "color": data_map.get("COLOR", ""),
        "type": data_map.get("TYPE", ""),
        "effect_text": overview_text,
        "zone": data_map.get("Zone", ""),
        "trait": data_map.get("Trait", ""),
        "link": data_map.get("Link", ""),
        "ap": data_map.get("AP", ""),
        "hp": data_map.get("HP", ""),
        "source_title": data_map.get("Source Title", ""),
        "where_to_get_it": data_map.get("Where to get it", ""),
        "package_id": package_id_from_detail or package_info.package_id,
        "package_label": package_info.package_label,
        "package_code": package_info.package_code,
        "package_kind": package_info.package_kind,
        "detail_url": detail_page_url,
        "cards_search_url": cards_link or package_info.cards_search_url,
        "product_url": product_link,
        "image_url": resolve_url(image_src, detail_page_url) if image_src else "",
    }

    faq_records: list[dict] = []
    for qa in tree.xpath("//div[contains(@class, 'qaCol')]"):
        faq_number = normalize_space(qa.xpath("string(.//h3[contains(@class, 'qaColNum')])"))
        updated_date = normalize_space(qa.xpath("string(.//p[contains(@class, 'qaColDate')]/span)"))
        question = normalize_space(qa.xpath("string(.//dt[contains(@class, 'qaColQuestion')])"))
        answer = clean_multiline_text(
            "\n".join(
                normalize_space(part.text_content())
                for part in qa.xpath(".//dd[contains(@class, 'qaColAnswer')]//*")
                if normalize_space(part.text_content())
            )
        )
        faq_records.append(
            {
                "detail_search_id": detail_id,
                "card_number": card_number,
                "card_name": card_name,
                "faq_number": faq_number,
                "faq_updated_date": updated_date,
                "question": question,
                "answer": answer,
                "detail_url": detail_page_url,
            }
        )

    return card_record, faq_records


def parse_product_cards(page_number: int, page_html: str) -> tuple[int, list[dict]]:
    tree = html.fromstring(page_html)
    page_numbers = []
    for node in tree.xpath("//a[contains(@class, 'pageBtn')]"):
        value = normalize_space(node.text_content())
        if value.isdigit():
            page_numbers.append(int(value))
    total_pages = max(page_numbers) if page_numbers else page_number

    products: list[dict] = []
    for product_node in tree.xpath("//div[contains(@class, 'productsDetail')]"):
        anchor = product_node.xpath(".//a[contains(@class, 'productsDetailInner')]")
        if not anchor:
            continue
        anchor = anchor[0]
        info_map: dict[str, str] = {}
        for dt in product_node.xpath(".//div[contains(@class, 'cardInfo')]//dt"):
            key = extract_text(dt)
            value = extract_text(dt.getnext()) if dt.getnext() is not None else ""
            if key:
                info_map[key] = value

        title = extract_text(anchor.xpath(".//div[contains(@class, 'cardTit')]")[0])
        href = normalize_space(anchor.get("href"))
        image_src = normalize_space(anchor.xpath("string(.//div[contains(@class, 'cardThumb')]//img/@src)"))
        category = normalize_space(product_node.get("data-tags")) or normalize_space(
            product_node.xpath("string(.//span[contains(@class, 'cardCategory')])")
        )
        product_code = infer_package_code(title)

        products.append(
            {
                "list_page": str(page_number),
                "category": category,
                "product_name": title,
                "product_code": product_code,
                "product_kind": infer_package_kind(title, product_code),
                "release_date": info_map.get("Release Date", ""),
                "msrp": info_map.get("MSRP", ""),
                "product_url": resolve_url(href, PRODUCTS_LIST_URL),
                "image_url": resolve_url(image_src, PRODUCTS_LIST_URL) if image_src else "",
            }
        )

    return total_pages, products


def parse_news_index(page_number: int, page_html: str) -> tuple[int, list[NewsPageInfo]]:
    tree = html.fromstring(page_html)
    page_numbers = []
    for node in tree.xpath("//a[contains(@class, 'pageBtn')]"):
        value = normalize_space(node.text_content())
        if value.isdigit():
            page_numbers.append(int(value))
    total_pages = max(page_numbers) if page_numbers else page_number

    entries: list[NewsPageInfo] = []
    seen_urls: set[str] = set()
    for anchor in tree.xpath("//a[@href]"):
        href = normalize_space(anchor.get("href"))
        if not href:
            continue
        news_url = resolve_url(href, NEWS_INDEX_URL)
        parsed = urlparse(news_url)
        if parsed.path.rstrip("/") == "/en/news":
            continue
        if not parsed.path.startswith("/en/news/"):
            continue
        if not parsed.path.endswith((".html", ".php")):
            continue
        anchor_text = normalize_space(anchor.text_content())
        if "LEARN MORE" not in anchor_text.upper():
            continue
        if news_url in seen_urls:
            continue
        title = re.sub(r"\bLEARN MORE\b", "", anchor_text, flags=re.IGNORECASE)
        title = re.sub(DATE_IN_TEXT_RE.pattern, "", title).strip()
        record_id = Path(parsed.path).name
        entries.append(
            NewsPageInfo(
                record_id=record_id,
                news_url=news_url,
                news_title=title,
            )
        )
        seen_urls.add(news_url)

    entries.sort(key=lambda item: (item.news_url, item.news_title))
    return total_pages, entries


def parse_product_page_previews(
    product: dict,
    product_html: str,
    snapshot_date: date,
    released_card_counts: dict[str, int],
) -> list[dict]:
    release_date = parse_human_date(product.get("release_date", ""))
    if release_date is None or release_date <= snapshot_date:
        return []

    tree = html.fromstring(product_html)
    product_url = str(product.get("product_url", "")).strip()
    source_title = normalize_space(
        tree.xpath("string((//h1 | //h2)[1])")
    ) or str(product.get("product_name", "")).strip()

    previews: list[dict] = []
    seen_image_urls: set[str] = set()
    for anchor in tree.xpath("//a[@href]"):
        href = normalize_space(anchor.get("href"))
        if not href:
            continue
        image_url = resolve_url(href, product_url)
        section_heading = nearest_preceding_heading(anchor)
        context_text = collect_neighbor_text(anchor)
        if not is_preview_candidate(
            image_url=image_url,
            section_heading=section_heading,
            context_text=context_text,
            source_type="product_page_featured_card",
        ):
            continue
        if image_url in seen_image_urls:
            continue

        card_number_hint = extract_card_number_hint(
            image_url,
            normalize_space(anchor.xpath("string(.//img/@alt)")),
        )
        card_name_hint = normalize_space(anchor.xpath("string(.//img/@alt)"))
        previews.append(
            build_preview_record(
                classification="official_pre_release_reveal",
                source_type="product_page_featured_card",
                source_title=source_title,
                source_date="",
                section_heading=section_heading,
                context_text=context_text,
                card_number_hint=card_number_hint,
                card_name_hint=card_name_hint,
                product=product,
                product_code=str(product.get("product_code", "")).strip().upper(),
                product_name=str(product.get("product_name", "")).strip(),
                product_release_date=str(product.get("release_date", "")).strip(),
                product_url=product_url,
                source_url=product_url,
                image_url=image_url,
                released_card_counts=released_card_counts,
            )
        )
        seen_image_urls.add(image_url)

    return previews


def parse_news_page_previews(
    news_page: NewsPageInfo,
    news_html: str,
    products_by_code: dict[str, dict],
    products_by_url: dict[str, dict],
    released_card_counts: dict[str, int],
    snapshot_date: date,
) -> list[dict]:
    tree = html.fromstring(news_html)
    source_title = normalize_space(tree.xpath("string((//h1 | //h2)[1])")) or news_page.news_title
    page_text = clean_multiline_text(tree.text_content())
    source_date = extract_first_date_text(page_text)
    source_date_value = parse_human_date(source_date)

    related_products: list[dict] = []
    seen_product_urls: set[str] = set()
    for anchor in tree.xpath("//a[@href]"):
        href = normalize_space(anchor.get("href"))
        if not href:
            continue
        absolute_url = resolve_url(href, news_page.news_url)
        product = products_by_url.get(absolute_url)
        if product and absolute_url not in seen_product_urls:
            related_products.append(product)
            seen_product_urls.add(absolute_url)

    known_product_codes = set(products_by_code)
    previews: list[dict] = []
    seen_image_urls: set[str] = set()
    for node in tree.xpath("//a[@href] | //img[@src]"):
        if node.tag == "a":
            image_url = resolve_url(normalize_space(node.get("href")), news_page.news_url)
        else:
            image_url = resolve_url(normalize_space(node.get("src")), news_page.news_url)
        if not image_url or image_url in seen_image_urls:
            continue

        section_heading = nearest_preceding_heading(node)
        context_text = collect_neighbor_text(node)
        card_number_hint = extract_card_number_hint(image_url, context_text, section_heading)
        if not is_preview_candidate(
            image_url=image_url,
            section_heading=section_heading,
            context_text=context_text,
            source_type="news_page_card_reveal",
        ):
            continue

        preferred_codes = []
        if card_number_hint:
            preferred_codes.append(card_number_hint.split("-", 1)[0])
        for product in related_products:
            product_code = str(product.get("product_code", "")).strip().upper()
            if product_code:
                preferred_codes.append(product_code)

        combined_context = " ".join(part for part in [section_heading, context_text, page_text] if part)
        related_product_code = get_related_product_code(combined_context, known_product_codes, preferred_codes)
        related_product = products_by_code.get(related_product_code)
        if related_product is None and len(related_products) == 1:
            related_product = related_products[0]

        related_release_date = parse_human_date(
            related_product.get("release_date", "") if related_product else ""
        )
        is_pre_release_reveal = False
        combined_lower = f"{section_heading} {context_text}".lower()
        if related_release_date and source_date_value and source_date_value < related_release_date:
            is_pre_release_reveal = True
        elif related_release_date and related_release_date > snapshot_date:
            is_pre_release_reveal = True
        elif any(keyword in combined_lower for keyword in PREVIEW_KEYWORDS):
            is_pre_release_reveal = True

        if not is_pre_release_reveal:
            continue

        previews.append(
            build_preview_record(
                classification="official_pre_release_reveal",
                source_type="news_page_card_reveal",
                source_title=source_title,
                source_date=source_date,
                section_heading=section_heading,
                context_text=context_text,
                card_number_hint=card_number_hint,
                card_name_hint=derive_card_name_hint(section_heading, context_text),
                product=related_product,
                product_code=related_product_code,
                product_name=str(related_product.get("product_name", "")).strip() if related_product else "",
                product_release_date=str(related_product.get("release_date", "")).strip() if related_product else "",
                product_url=str(related_product.get("product_url", "")).strip() if related_product else "",
                source_url=news_page.news_url,
                image_url=image_url,
                released_card_counts=released_card_counts,
            )
        )
        seen_image_urls.add(image_url)

    return previews


def card_sort_key(card: dict) -> tuple:
    number = card.get("card_number", "")
    variant = card.get("variant_code", "")
    match = re.match(r"^([A-Z0-9]+)-(\d+)$", number)
    if match:
        base_key = (match.group(1), int(match.group(2)))
    else:
        base_key = (number, 0)

    variant_match = re.match(r"p(\d+)", variant)
    variant_num = int(variant_match.group(1)) if variant_match else 0
    return (*base_key, variant_num, card.get("detail_search_id", ""))


def product_sort_key(product: dict) -> tuple:
    release = product.get("release_date", "")
    title = product.get("product_name", "")
    return (release, title)


def write_csv(path: Path, rows: list[dict], fieldnames: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(fieldnames))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def fetch_all_card_details(detail_jobs: list[tuple[str, PackageInfo]]) -> tuple[list[dict], list[dict], list[dict]]:
    cards: list[dict] = []
    faqs: list[dict] = []
    sources: list[dict] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {}
        for detail_id, package_info in detail_jobs:
            url = resolve_url(f"cards/detail.php?detailSearch={detail_id}")
            cache_path = CARD_DETAILS_DIR / f"{detail_id}.html"
            future = pool.submit(fetch_text, url, cache_path)
            future_map[future] = (detail_id, package_info, url, cache_path)

        for future in as_completed(future_map):
            detail_id, package_info, url, cache_path = future_map[future]
            detail_html = future.result()
            card_record, faq_records = parse_card_detail(detail_id, package_info, detail_html)
            cards.append(card_record)
            faqs.extend(faq_records)
            sources.append(
                {
                    "record_type": "card_detail",
                    "record_id": detail_id,
                    "source_url": url,
                    "cache_file": str(cache_path.relative_to(ROOT)),
                }
            )

    cards.sort(key=card_sort_key)
    faqs.sort(key=lambda row: (row["card_number"], row["faq_number"], row["detail_search_id"]))
    sources.sort(key=lambda row: (row["record_type"], row["record_id"]))
    return cards, faqs, sources


def fetch_product_detail_pages(
    products: list[dict],
    snapshot_date: date,
    released_card_counts: dict[str, int],
) -> tuple[list[dict], list[dict]]:
    previews: list[dict] = []
    sources: list[dict] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {}
        for product in products:
            product_url = str(product.get("product_url", "")).strip()
            if not product_url:
                continue
            product_code = str(product.get("product_code", "")).strip() or slugify(
                str(product.get("product_name", "")).strip()
            )
            cache_path = PRODUCT_DETAILS_DIR / f"{product_code}.html"
            future = pool.submit(fetch_text, product_url, cache_path)
            future_map[future] = (product, product_url, cache_path)

        for future in as_completed(future_map):
            product, product_url, cache_path = future_map[future]
            product_html = future.result()
            previews.extend(
                parse_product_page_previews(product, product_html, snapshot_date, released_card_counts)
            )
            sources.append(
                {
                    "record_type": "product_detail_page",
                    "record_id": str(product.get("product_code", "")).strip()
                    or slugify(str(product.get("product_name", "")).strip()),
                    "source_url": product_url,
                    "cache_file": str(cache_path.relative_to(ROOT)),
                }
            )

    return previews, sources


def fetch_news_previews(
    products: list[dict],
    snapshot_date: date,
    released_card_counts: dict[str, int],
) -> tuple[list[dict], list[dict]]:
    first_news_page_path = NEWS_DIR / "index_page_1.html"
    first_news_page_html = fetch_text(NEWS_INDEX_URL, first_news_page_path)
    total_news_pages, first_page_entries = parse_news_index(1, first_news_page_html)
    sources: list[dict] = [
        {
            "record_type": "news_index_page",
            "record_id": "1",
            "source_url": NEWS_INDEX_URL,
            "cache_file": str(first_news_page_path.relative_to(ROOT)),
        }
    ]

    news_pages = list(first_page_entries)
    for page_number in range(2, total_news_pages + 1):
        page_url = f"{NEWS_INDEX_URL}?page={page_number}"
        page_cache_path = NEWS_DIR / f"index_page_{page_number}.html"
        page_html = fetch_text(page_url, page_cache_path)
        _, page_entries = parse_news_index(page_number, page_html)
        news_pages.extend(page_entries)
        sources.append(
            {
                "record_type": "news_index_page",
                "record_id": str(page_number),
                "source_url": page_url,
                "cache_file": str(page_cache_path.relative_to(ROOT)),
            }
        )

    products_by_code = {
        str(product.get("product_code", "")).strip().upper(): product
        for product in products
        if str(product.get("product_code", "")).strip()
    }
    products_by_url = {
        str(product.get("product_url", "")).strip(): product
        for product in products
        if str(product.get("product_url", "")).strip()
    }

    previews: list[dict] = []
    seen_news_urls: set[str] = set()
    unique_news_pages = [page for page in news_pages if page.news_url not in seen_news_urls and not seen_news_urls.add(page.news_url)]

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {}
        for news_page in unique_news_pages:
            cache_name = news_page.record_id or slugify(news_page.news_title)
            cache_path = NEWS_DETAILS_DIR / cache_name
            future = pool.submit(fetch_text, news_page.news_url, cache_path)
            future_map[future] = (news_page, cache_path)

        for future in as_completed(future_map):
            news_page, cache_path = future_map[future]
            news_html = future.result()
            previews.extend(
                parse_news_page_previews(
                    news_page,
                    news_html,
                    products_by_code,
                    products_by_url,
                    released_card_counts,
                    snapshot_date,
                )
            )
            sources.append(
                {
                    "record_type": "news_detail_page",
                    "record_id": news_page.record_id,
                    "source_url": news_page.news_url,
                    "cache_file": str(cache_path.relative_to(ROOT)),
                }
            )

    return previews, sources


def preview_sort_key(preview: dict) -> tuple:
    source_date = parse_human_date(preview.get("source_date", ""))
    product_release_date = parse_human_date(preview.get("product_release_date", ""))
    return (
        format_human_date(source_date or product_release_date),
        preview.get("product_code", ""),
        preview.get("card_number_hint", ""),
        preview.get("source_type", ""),
        preview.get("source_title", ""),
        preview.get("image_url", ""),
    )


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CARD_DETAILS_DIR.mkdir(parents=True, exist_ok=True)
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    PRODUCT_DETAILS_DIR.mkdir(parents=True, exist_ok=True)
    NEWS_DIR.mkdir(parents=True, exist_ok=True)
    NEWS_DETAILS_DIR.mkdir(parents=True, exist_ok=True)

    snapshot_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    snapshot_date = datetime.fromisoformat(snapshot_utc.replace("Z", "+00:00")).date()

    cards_index_path = CARDS_DIR / "index.html"
    cards_index_html = fetch_text(CARDS_INDEX_URL, cards_index_path)
    packages = parse_cards_index(cards_index_html)

    package_rows: list[dict] = []
    detail_jobs: list[tuple[str, PackageInfo]] = []
    source_rows: list[dict] = [
        {
            "record_type": "cards_index",
            "record_id": "cards_index",
            "source_url": CARDS_INDEX_URL,
            "cache_file": str(cards_index_path.relative_to(ROOT)),
        }
    ]

    for package in packages:
        package_url = f"{CARDS_INDEX_URL}?package={package.package_id}"
        package_cache_path = CARDS_DIR / f"package_{package.package_id}.html"
        package_html = fetch_text(package_url, package_cache_path)
        result_count, detail_ids = parse_detail_ids(package_html)
        package_rows.append(
            {
                "package_id": package.package_id,
                "package_label": package.package_label,
                "package_code": package.package_code,
                "package_kind": package.package_kind,
                "cards_expected": str(result_count),
                "cards_found": str(len(detail_ids)),
                "cards_search_url": package_url,
            }
        )
        detail_jobs.extend((detail_id, package) for detail_id in detail_ids)
        source_rows.append(
            {
                "record_type": "card_package_page",
                "record_id": package.package_id,
                "source_url": package_url,
                "cache_file": str(package_cache_path.relative_to(ROOT)),
            }
        )

    cards, faqs, card_detail_source_rows = fetch_all_card_details(detail_jobs)
    source_rows.extend(card_detail_source_rows)
    released_card_counts: dict[str, int] = {}
    for card in cards:
        card_number = str(card.get("card_number", "")).strip().upper()
        if card_number:
            released_card_counts[card_number] = released_card_counts.get(card_number, 0) + 1

    first_products_page_path = PRODUCTS_DIR / "list_page_1.html"
    first_products_page_html = fetch_text(PRODUCTS_LIST_URL, first_products_page_path)
    total_product_pages, first_page_products = parse_product_cards(1, first_products_page_html)
    source_rows.append(
        {
            "record_type": "products_list_page",
            "record_id": "1",
            "source_url": PRODUCTS_LIST_URL,
            "cache_file": str(first_products_page_path.relative_to(ROOT)),
        }
    )

    products = list(first_page_products)
    for page_number in range(2, total_product_pages + 1):
        page_url = f"{PRODUCTS_LIST_URL}?page={page_number}"
        page_cache_path = PRODUCTS_DIR / f"list_page_{page_number}.html"
        page_html = fetch_text(page_url, page_cache_path)
        _, page_products = parse_product_cards(page_number, page_html)
        products.extend(page_products)
        source_rows.append(
            {
                "record_type": "products_list_page",
                "record_id": str(page_number),
                "source_url": page_url,
                "cache_file": str(page_cache_path.relative_to(ROOT)),
            }
        )

    products.sort(key=product_sort_key)
    product_previews, product_detail_source_rows = fetch_product_detail_pages(
        products,
        snapshot_date,
        released_card_counts,
    )
    news_previews, news_source_rows = fetch_news_previews(
        products,
        snapshot_date,
        released_card_counts,
    )
    previews_by_id: dict[str, dict] = {}
    for preview in product_previews + news_previews:
        previews_by_id[preview["preview_id"]] = preview
    previews = sorted(previews_by_id.values(), key=preview_sort_key)

    source_rows.extend(product_detail_source_rows)
    source_rows.extend(news_source_rows)
    package_rows.sort(key=lambda row: (row["package_kind"], row["package_code"] or row["package_label"]))
    source_rows.sort(key=lambda row: (row["record_type"], row["record_id"]))

    card_count = len(cards)
    unique_card_numbers = len({row["card_number"] for row in cards})
    product_count = len(products)
    faq_count = len(faqs)
    preview_count = len(previews)

    snapshot = {
        "snapshot_generated_utc": snapshot_utc,
        "source_region": "English (US)",
        "source_root": BASE_EN_URL,
        "cards_count": card_count,
        "unique_card_numbers": unique_card_numbers,
        "package_count": len(package_rows),
        "product_count": product_count,
        "faq_count": faq_count,
        "preview_count": preview_count,
        "packages": package_rows,
        "cards": cards,
        "products": products,
        "faqs": faqs,
        "previews": previews,
        "sources": source_rows,
    }

    (DATA_DIR / "gundam_gcg_snapshot.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    write_csv(
        DATA_DIR / "packages.csv",
        package_rows,
        [
            "package_id",
            "package_label",
            "package_code",
            "package_kind",
            "cards_expected",
            "cards_found",
            "cards_search_url",
        ],
    )
    write_csv(
        DATA_DIR / "cards.csv",
        cards,
        [
            "detail_search_id",
            "card_number",
            "variant_code",
            "is_parallel_variant",
            "card_name",
            "rarity",
            "block_icon",
            "level",
            "cost",
            "color",
            "type",
            "effect_text",
            "zone",
            "trait",
            "link",
            "ap",
            "hp",
            "source_title",
            "where_to_get_it",
            "package_id",
            "package_label",
            "package_code",
            "package_kind",
            "detail_url",
            "cards_search_url",
            "product_url",
            "image_url",
        ],
    )
    write_csv(
        DATA_DIR / "products.csv",
        products,
        [
            "list_page",
            "category",
            "product_name",
            "product_code",
            "product_kind",
            "release_date",
            "msrp",
            "product_url",
            "image_url",
        ],
    )
    write_csv(
        DATA_DIR / "card_faqs.csv",
        faqs,
        [
            "detail_search_id",
            "card_number",
            "card_name",
            "faq_number",
            "faq_updated_date",
            "question",
            "answer",
            "detail_url",
        ],
    )
    write_csv(
        DATA_DIR / "previews.csv",
        previews,
        [
            "preview_id",
            "classification",
            "preview_status",
            "confidence",
            "source_type",
            "source_title",
            "source_date",
            "section_heading",
            "card_number_hint",
            "card_name_hint",
            "product_code",
            "product_name",
            "product_release_date",
            "matched_released_card",
            "matched_released_printings",
            "context_text",
            "source_url",
            "product_url",
            "image_url",
        ],
    )
    write_csv(
        DATA_DIR / "sources.csv",
        source_rows,
        ["record_type", "record_id", "source_url", "cache_file"],
    )

    print(
        json.dumps(
            {
                "snapshot_generated_utc": snapshot_utc,
                "cards_count": card_count,
                "unique_card_numbers": unique_card_numbers,
                "package_count": len(package_rows),
                "product_count": product_count,
                "faq_count": faq_count,
                "preview_count": preview_count,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
