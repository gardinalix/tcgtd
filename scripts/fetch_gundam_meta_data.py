from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, unquote, urljoin, urlparse
from urllib.request import Request, urlopen

from ps_fetch import fetch_text as ps_fetch_text
from minihtml import Node, find_all, find_first, parse_html


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SCRATCH_DIR = ROOT / ".scratch" / "gundam_meta"
EGMAN_DIR = SCRATCH_DIR / "egman"
LIMITLESS_DIR = SCRATCH_DIR / "limitless"

META_SNAPSHOT_PATH = DATA_DIR / "gundam_meta_snapshot.json"
CARD_SNAPSHOT_PATH = DATA_DIR / "gundam_gcg_snapshot.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)
if sys.platform.startswith("win"):
    SSL_CONTEXT = None
else:
    SSL_CONTEXT = ssl._create_unverified_context()
FETCH_TIMEOUT = 45
FETCH_RETRIES = 3
MAX_WORKERS = 12
COMPETITIVE_CUT_LIMIT = 16

EGMAN_BASE_URL = "https://egmanevents.com/"
EGMAN_FORMAT_URL_TEMPLATE = "https://egmanevents.com/gundam-gd{number:02d}-format"
FALLBACK_EGMAN_FORMAT_NUMBERS = (1, 2, 3)
LIMITLESS_BASE_URL = "https://play.limitlesstcg.com/"
LIMITLESS_COMPLETED_URL = "https://play.limitlesstcg.com/tournaments/completed?game=GUNDAM"

DECK_LINE_RE = re.compile(r"^(\d+)\s+(.+?)\s+\(([A-Z0-9-]+)\)$")
EGMAN_DECK_URL_RE = re.compile(r"deckbuilder\.egmanevents\.com", re.IGNORECASE)
LIMITLESS_TOURNAMENT_RE = re.compile(r"/tournament/([^/]+)/standings$")
LIMITLESS_PLAYER_RE = re.compile(r"/tournament/([^/]+)/player/([^/]+)$")


@dataclass(frozen=True)
class LimitlessTournament:
    tournament_id: str
    standings_url: str
    event_name: str
    event_date: str
    organizer: str
    player_count: int | None


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


def direct_children(node: Node, tag: str) -> list[Node]:
    tag = tag.lower()
    return [child for child in node.children if child.tag == tag]


def first_text(root: Node, tag: str) -> str:
    node = find_first(root, tag=tag.lower())
    return normalize_space(node.text_content()) if node is not None else ""


def first_attr_contains(root: Node, tag: str, attr: str, needle: str) -> Node | None:
    return find_first(root, tag=tag.lower(), attr_exists=attr.lower(), predicate=lambda n: needle in n.get(attr))


def truncate_text(value: str, limit: int = 280) -> str:
    text = normalize_space(value)
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def resolve_url(relative_or_absolute: str, base_url: str) -> str:
    return urljoin(base_url, relative_or_absolute)


def slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return slug[:80] or "page"


def make_hash(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


def fetch_text(url: str, target_path: Path) -> str:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            if sys.platform.startswith("win"):
                text = ps_fetch_text(url, user_agent=USER_AGENT, timeout_seconds=FETCH_TIMEOUT)
            else:
                request = Request(
                    url,
                    headers={
                        "User-Agent": USER_AGENT,
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                )
                with urlopen(request, timeout=FETCH_TIMEOUT, context=SSL_CONTEXT) as response:
                    raw = response.read()
                text = raw.decode("utf-8", errors="replace")
            target_path.write_text(text, encoding="utf-8")
            return text
        except Exception as exc:  # pragma: no cover - best effort network retry
            last_error = exc
            if attempt == FETCH_RETRIES:
                break
            time.sleep(1.5 * attempt)
    if target_path.exists():
        print(
            f"WARNING: Failed to fetch {url}; using cached copy at {target_path}: {last_error}",
            file=sys.stderr,
        )
        return target_path.read_text(encoding="utf-8")
    raise RuntimeError(f"Failed to fetch {url}: {last_error}") from last_error


def parse_date_text(value: str) -> str:
    cleaned = normalize_space(value)
    if not cleaned:
        return ""
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%m/%d/%y",
        "%m/%d/%Y",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d/%m/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
    ):
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return cleaned


def parse_placing_rank(label: str) -> int | None:
    cleaned = normalize_space(label).lower()
    if not cleaned:
        return None
    if cleaned in {"winner", "champion"}:
        return 1
    match = re.search(r"(\d+)", cleaned)
    if match:
        return int(match.group(1))
    return None


def load_card_lookup() -> dict[str, dict]:
    if not CARD_SNAPSHOT_PATH.exists():
        return {}

    snapshot = json.loads(CARD_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    lookup: dict[str, dict] = {}
    for row in snapshot.get("cards", []):
        card_number = str(row.get("card_number", "")).strip().upper()
        if not card_number or card_number in lookup:
            continue
        lookup[card_number] = {
            "card_name": str(row.get("card_name", "")).strip(),
            "color": str(row.get("color", "")).strip(),
            "type": str(row.get("type", "")).strip(),
            "package_code": str(row.get("package_code", "")).strip(),
            "package_label": str(row.get("package_label", "")).strip(),
        }
    return lookup


def discover_egman_format_urls() -> list[str]:
    """Build the Egman format queue from the local official card snapshot.

    The previous fixed GD01–GD03 list stopped discovering current tournament
    pages as soon as a new booster released. A package only enters the official
    snapshot once Bandai exposes it in the catalog, which makes it a safer
    discovery boundary than guessing future Egman URLs.
    """
    numbers: set[int] = set()
    if CARD_SNAPSHOT_PATH.exists():
        try:
            snapshot = json.loads(CARD_SNAPSHOT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            snapshot = {}
        for package in snapshot.get("packages", []):
            match = re.fullmatch(r"GD(\d+)", normalize_space(package.get("package_code", "")).upper())
            if match:
                numbers.add(int(match.group(1)))

    if not numbers:
        numbers.update(FALLBACK_EGMAN_FORMAT_NUMBERS)
    return [EGMAN_FORMAT_URL_TEMPLATE.format(number=number) for number in sorted(numbers)]


def parse_egman_format_pages() -> tuple[list[str], list[dict]]:
    sources: list[dict] = []
    table_urls: set[str] = set()

    for format_url in discover_egman_format_urls():
        slug = urlparse(format_url).path.strip("/").replace("/", "_") or "format"
        cache_path = EGMAN_DIR / "formats" / f"{slug}.html"
        try:
            page_html = fetch_text(format_url, cache_path)
        except RuntimeError:
            # A catalog package can appear before a third-party format archive
            # exists. Preserve the rest of the refresh rather than failing all
            # current event coverage for one not-yet-published page.
            sources.append(
                {
                    "record_type": "egman_format_page_unavailable",
                    "record_id": slug,
                    "source_url": format_url,
                    "cache_file": "",
                }
            )
            continue
        tree = parse_html(page_html)
        for anchor in find_all(tree, tag="a", attr_exists="href"):
            href = normalize_space(anchor.get("href"))
            if "tournament-deck-lists" not in href:
                continue
            table_urls.add(resolve_url(href, format_url))

        sources.append(
            {
                "record_type": "egman_format_page",
                "record_id": slug,
                "source_url": format_url,
                "cache_file": str(cache_path.relative_to(ROOT)),
            }
        )

    return sorted(table_urls), sources


def parse_egman_deck(deck_url: str, card_lookup: dict[str, dict]) -> list[dict]:
    query = parse_qs(urlparse(deck_url).query)
    deck_param = query.get("deck", [""])[0]
    if not deck_param:
        return []

    cards: list[dict] = []
    for raw_entry in deck_param.split(","):
        entry = unquote(raw_entry)
        if ":" not in entry:
            continue
        card_number, quantity_text = entry.split(":", 1)
        card_number = normalize_space(card_number).upper()
        quantity_text = normalize_space(quantity_text)
        if not card_number or not quantity_text.isdigit():
            continue
        card_info = card_lookup.get(card_number, {})
        cards.append(
            {
                "card_number": card_number,
                "card_name": card_info.get("card_name", ""),
                "quantity": int(quantity_text),
                "color": card_info.get("color", ""),
                "card_type": card_info.get("type", ""),
                "package_code": card_info.get("package_code", ""),
                "package_label": card_info.get("package_label", ""),
            }
        )

    return cards


def parse_egman_table_page(
    table_url: str,
    page_html: str,
    card_lookup: dict[str, dict],
) -> tuple[list[dict], list[dict], list[dict]]:
    tree = parse_html(page_html)
    page_title = first_text(tree, "h1") or first_text(tree, "title")

    events_by_id: dict[str, dict] = {}
    results: list[dict] = []
    deck_cards: list[dict] = []
    event_instance_counters: dict[tuple[str, str, str, str], int] = {}
    last_base_event_key: tuple[str, str, str, str] | None = None

    for row in find_all(tree, tag="tr"):
        cells = direct_children(row, "td")
        if len(cells) < 8:
            continue
        cell_texts = [normalize_space(cell.text_content()) for cell in cells]
        if not any(cell_texts):
            continue

        deck_anchor = None
        for anchor in find_all(row, tag="a", attr_exists="href"):
            href = normalize_space(anchor.get("href"))
            if EGMAN_DECK_URL_RE.search(href):
                deck_anchor = anchor
                break
        if deck_anchor is None:
            continue

        deck_url = resolve_url(normalize_space(deck_anchor.get("href")), table_url)
        archetype = normalize_space(deck_anchor.text_content()) or (
            cell_texts[2] if len(cell_texts) > 2 else ""
        )
        color_combination = cell_texts[0]
        player_name = cell_texts[3] if len(cell_texts) > 3 else ""
        placing_label = cell_texts[4] if len(cell_texts) > 4 else ""
        format_name = cell_texts[5] if len(cell_texts) > 5 else ""
        event_type = cell_texts[6] if len(cell_texts) > 6 else ""
        event_text = cell_texts[7] if len(cell_texts) > 7 else ""
        date_text = parse_date_text(cell_texts[8] if len(cell_texts) > 8 else "")

        player_count_match = re.search(r"\((\d+)\)", event_text)
        player_count = int(player_count_match.group(1)) if player_count_match else None
        event_name = re.sub(r"\(\d+\)", "", event_text).strip()
        placing_rank = parse_placing_rank(placing_label)

        base_event_key = (event_name, date_text, format_name, event_type)
        if base_event_key not in event_instance_counters:
            event_instance_counters[base_event_key] = 1
        elif base_event_key == last_base_event_key and placing_rank == 1:
            event_instance_counters[base_event_key] += 1
        elif base_event_key != last_base_event_key and placing_rank == 1:
            event_instance_counters[base_event_key] += 1
        event_instance = event_instance_counters[base_event_key]
        last_base_event_key = base_event_key

        event_id = make_hash(
            "egman",
            event_name,
            date_text,
            format_name,
            event_type,
            str(event_instance),
        )
        deck_id = make_hash("egman", event_id, player_name, placing_label, archetype, deck_url)
        result_id = make_hash("egman", deck_id, table_url)

        events_by_id.setdefault(
            event_id,
            {
                "event_id": event_id,
                "source_name": "Egman Events",
                "event_name": event_name,
                "event_date": date_text,
                "format_name": format_name,
                "event_type": event_type,
                "player_count": player_count,
                "organizer": "",
                "source_url": table_url,
                "source_page_title": page_title,
                "event_instance": event_instance,
            },
        )

        results.append(
            {
                "result_id": result_id,
                "deck_id": deck_id,
                "event_id": event_id,
                "source_name": "Egman Events",
                "event_name": event_name,
                "event_date": date_text,
                "format_name": format_name,
                "event_type": event_type,
                "player_count": player_count,
                "player_name": player_name,
                "placing_label": placing_label,
                "placing_rank": placing_rank,
                "archetype": archetype,
                "color_combination": color_combination,
                "leader_name": "",
                "deck_url": deck_url,
                "source_url": table_url,
                "has_decklist": "TRUE",
            }
        )

        for item in parse_egman_deck(deck_url, card_lookup):
            deck_cards.append(
                {
                    "deck_card_id": make_hash("egman", deck_id, item["card_number"]),
                    "deck_id": deck_id,
                    "event_id": event_id,
                    "source_name": "Egman Events",
                    "event_name": event_name,
                    "event_date": date_text,
                    "player_name": player_name,
                    "placing_label": placing_label,
                    "placing_rank": placing_rank,
                    "archetype": archetype,
                    "color_combination": color_combination,
                    "card_number": item["card_number"],
                    "card_name": item["card_name"],
                    "quantity": item["quantity"],
                    "card_type": item["card_type"],
                    "card_color": item["color"],
                    "package_code": item["package_code"],
                    "package_label": item["package_label"],
                }
            )

    events = sorted(events_by_id.values(), key=lambda row: (row["event_date"], row["event_name"]))
    return events, results, deck_cards


def extract_limitless_date(tree, page_text: str, event_name: str) -> str:
    for node in find_all(tree, tag="time", attr_exists="datetime"):
        normalized = normalize_space(node.get("datetime"))
        if not normalized:
            continue
        if "T" in normalized:
            normalized = normalized.split("T", 1)[0]
        parsed = parse_date_text(normalized)
        if parsed:
            return parsed

    for candidate in re.findall(r"\b\d{4}-\d{2}-\d{2}\b", page_text):
        parsed = parse_date_text(candidate)
        if parsed:
            return parsed

    for candidate in re.findall(r"\b\d{2}/\d{2}/\d{4}\b", f"{event_name} {page_text}"):
        parsed = parse_date_text(candidate)
        if parsed:
            return parsed

    return ""


def parse_limitless_completed(page_html: str) -> list[LimitlessTournament]:
    tree = parse_html(page_html)
    tournaments: dict[str, LimitlessTournament] = {}

    tables = find_all(tree, tag="table", attr_contains=("class", "completed-tournaments"))
    for table in tables:
        for row in find_all(table, tag="tr", attr_exists="data-name"):
            anchor = first_attr_contains(row, "a", "href", "/standings")
            if anchor is None:
                continue
            href = normalize_space(anchor.get("href"))
            absolute = resolve_url(href, LIMITLESS_COMPLETED_URL)
            match = LIMITLESS_TOURNAMENT_RE.search(urlparse(absolute).path)
            if not match:
                continue
            event_name = normalize_space(row.get("data-name")) or normalize_space(anchor.text_content())
            if not event_name:
                continue
            tournament_id = match.group(1)
            event_date = parse_date_text(normalize_space(row.get("data-date")))
            organizer = normalize_space(row.get("data-organizer"))
            players_raw = normalize_space(row.get("data-players"))
            player_count = int(players_raw) if players_raw.isdigit() else None
            tournaments[absolute] = LimitlessTournament(
                tournament_id=tournament_id,
                standings_url=absolute,
                event_name=event_name,
                event_date=event_date,
                organizer=organizer,
                player_count=player_count,
            )

    return sorted(tournaments.values(), key=lambda item: item.event_name)


def parse_limitless_decklist(
    decklist_url: str,
    page_html: str,
    card_lookup: dict[str, dict],
    deck_context: dict,
) -> list[dict]:
    tree = parse_html(page_html)
    deck_cards: list[dict] = []
    seen_card_numbers: set[str] = set()

    decklist_containers = find_all(tree, tag="div", attr_contains=("class", "decklist"))
    card_lines: list[str] = []
    for container in decklist_containers:
        for anchor in find_all(container, tag="a"):
            text = normalize_space(anchor.text_content())
            if text:
                card_lines.append(text)

    if not card_lines:
        export_input = find_first(tree, tag="input", attr_eq=("name", "input"))
        if export_input is not None:
            raw = export_input.get("value")
            card_lines = [
                normalize_space(line.replace("  ", " "))
                for line in (raw or "").splitlines()
                if normalize_space(line)
            ]

    for line in card_lines:
        match = DECK_LINE_RE.match(line)
        if not match:
            continue
        quantity = int(match.group(1))
        card_name = normalize_space(match.group(2))
        card_number = normalize_space(match.group(3)).upper()
        if not card_number or card_number in seen_card_numbers:
            continue
        card_info = card_lookup.get(card_number, {})
        deck_cards.append(
            {
                "deck_card_id": make_hash("limitless", deck_context["deck_id"], card_number),
                "deck_id": deck_context["deck_id"],
                "event_id": deck_context["event_id"],
                "source_name": "Limitless",
                "event_name": deck_context["event_name"],
                "event_date": deck_context["event_date"],
                "player_name": deck_context["player_name"],
                "placing_label": deck_context["placing_label"],
                "placing_rank": deck_context["placing_rank"],
                "archetype": deck_context["archetype"],
                "color_combination": "",
                "card_number": card_number,
                "card_name": card_name or card_info.get("card_name", ""),
                "quantity": quantity,
                "card_type": card_info.get("type", ""),
                "card_color": card_info.get("color", ""),
                "package_code": card_info.get("package_code", ""),
                "package_label": card_info.get("package_label", ""),
            }
        )
        seen_card_numbers.add(card_number)

    return deck_cards


def extract_limitless_deck_metadata(page_html: str) -> tuple[bool, str]:
    tree = parse_html(page_html)
    page_text = clean_multiline_text(tree.text_content()).lower()
    has_decklist = "did not submit a decklist" not in page_text
    archetype_node = find_first(tree, tag="div", attr_contains=("class", "deck-name"))
    archetype = normalize_space(archetype_node.text_content()) if archetype_node is not None else ""
    return has_decklist, archetype


def parse_limitless_tournament_details(
    tournament: LimitlessTournament,
    page_html: str,
    card_lookup: dict[str, dict],
) -> tuple[dict, list[dict], list[dict], list[tuple[str, Path, dict]]]:
    tree = parse_html(page_html)
    page_text = clean_multiline_text(tree.text_content())

    event_name = first_text(tree, "h1") or tournament.event_name
    event_date = tournament.event_date or extract_limitless_date(tree, page_text, event_name)
    organizer = tournament.organizer
    if not organizer:
        organizer_match = re.search(r"Tournament by\s+(.+?)(?:\n|$)", page_text, re.IGNORECASE)
        organizer = normalize_space(organizer_match.group(1)) if organizer_match else ""
    player_count = tournament.player_count
    if player_count is None:
        players_match = re.search(r"(\d+)\s+players", page_text, re.IGNORECASE)
        player_count = int(players_match.group(1)) if players_match else None

    event_id = make_hash("limitless", tournament.tournament_id, event_name, event_date)
    event_row = {
        "event_id": event_id,
        "source_name": "Limitless",
        "event_name": event_name,
        "event_date": event_date,
        "format_name": "",
        "event_type": "Public Tournament",
        "player_count": player_count,
        "organizer": organizer,
        "source_url": tournament.standings_url,
        "source_page_title": event_name,
    }

    results: list[dict] = []
    deck_cards: list[dict] = []
    deck_fetch_jobs: list[tuple[str, Path, dict]] = []

    for row in find_all(tree, tag="tr"):
        if first_attr_contains(row, "a", "href", "/player/") is None:
            continue
        cells = direct_children(row, "td")
        cell_texts = [normalize_space(cell.text_content()) for cell in cells]
        if not cell_texts:
            continue
        placing_label = cell_texts[0] if cell_texts else ""
        placing_rank = parse_placing_rank(placing_label)
        if placing_rank is None or placing_rank > COMPETITIVE_CUT_LIMIT:
            continue

        player_anchor = first_attr_contains(row, "a", "href", "/player/")
        if player_anchor is None:
            continue
        player_name = normalize_space(player_anchor.text_content())
        player_url = resolve_url(normalize_space(player_anchor.get("href")), tournament.standings_url)
        archetype_anchor = first_attr_contains(row, "a", "href", "/metagame/")
        archetype = normalize_space(archetype_anchor.text_content()) if archetype_anchor else ""

        deck_id = make_hash(
            "limitless",
            tournament.tournament_id,
            player_name,
            placing_label,
            archetype,
        )
        result_id = make_hash("limitless", deck_id, tournament.standings_url)
        decklist_url = player_url.rstrip("/") + "/decklist"
        deck_context = {
            "deck_id": deck_id,
            "event_id": event_id,
            "event_name": event_name,
            "event_date": event_date,
            "player_name": player_name,
            "placing_label": placing_label,
            "placing_rank": placing_rank,
            "archetype": archetype,
            "decklist_url": decklist_url,
        }

        results.append(
            {
                "result_id": result_id,
                "deck_id": deck_id,
                "event_id": event_id,
                "source_name": "Limitless",
                "event_name": event_name,
                "event_date": event_date,
                "format_name": "",
                "event_type": "Public Tournament",
                "player_count": player_count,
                "player_name": player_name,
                "placing_label": placing_label,
                "placing_rank": placing_rank,
                "archetype": archetype,
                "color_combination": "",
                "leader_name": "",
                "deck_url": decklist_url,
                "source_url": tournament.standings_url,
                "has_decklist": "TRUE",
            }
        )

        cache_path = LIMITLESS_DIR / "decklists" / f"{tournament.tournament_id}_{slugify(player_name)}.html"
        deck_fetch_jobs.append((decklist_url, cache_path, deck_context))

    return event_row, results, deck_cards, deck_fetch_jobs


def fetch_limitless_data(card_lookup: dict[str, dict]) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    completed_cache_path = LIMITLESS_DIR / "completed.html"
    completed_html = fetch_text(LIMITLESS_COMPLETED_URL, completed_cache_path)
    tournaments = parse_limitless_completed(completed_html)
    sources: list[dict] = [
        {
            "record_type": "limitless_completed_page",
            "record_id": "completed_gundam",
            "source_url": LIMITLESS_COMPLETED_URL,
            "cache_file": str(completed_cache_path.relative_to(ROOT)),
        }
    ]

    event_rows: list[dict] = []
    result_rows: list[dict] = []
    deck_card_rows: list[dict] = []
    deck_fetch_jobs: list[tuple[str, Path, dict]] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {}
        for tournament in tournaments:
            cache_path = LIMITLESS_DIR / "standings" / f"{tournament.tournament_id}.html"
            future = pool.submit(fetch_text, tournament.standings_url, cache_path)
            future_map[future] = (tournament, cache_path)

        for future in as_completed(future_map):
            tournament, cache_path = future_map[future]
            page_html = future.result()
            event_row, results, _, jobs = parse_limitless_tournament_details(
                tournament,
                page_html,
                card_lookup,
            )
            event_rows.append(event_row)
            result_rows.extend(results)
            deck_fetch_jobs.extend(jobs)
            sources.append(
                {
                    "record_type": "limitless_standings_page",
                    "record_id": tournament.tournament_id,
                    "source_url": tournament.standings_url,
                    "cache_file": str(cache_path.relative_to(ROOT)),
                }
            )

    result_lookup = {row["deck_id"]: row for row in result_rows}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {}
        for decklist_url, cache_path, deck_context in deck_fetch_jobs:
            future = pool.submit(fetch_text, decklist_url, cache_path)
            future_map[future] = (decklist_url, cache_path, deck_context)

        for future in as_completed(future_map):
            decklist_url, cache_path, deck_context = future_map[future]
            try:
                page_html = future.result()
            except Exception:
                continue
            has_decklist, archetype_hint = extract_limitless_deck_metadata(page_html)
            result_row = result_lookup.get(deck_context["deck_id"])
            if result_row is not None:
                if not has_decklist:
                    result_row["has_decklist"] = "FALSE"
                if archetype_hint and not normalize_space(result_row.get("archetype", "")):
                    result_row["archetype"] = archetype_hint
            if archetype_hint and not normalize_space(deck_context.get("archetype", "")):
                deck_context["archetype"] = archetype_hint
            deck_card_rows.extend(
                parse_limitless_decklist(decklist_url, page_html, card_lookup, deck_context)
            )
            sources.append(
                {
                    "record_type": "limitless_decklist_page",
                    "record_id": deck_context["deck_id"],
                    "source_url": decklist_url,
                    "cache_file": str(cache_path.relative_to(ROOT)),
                }
            )

    return event_rows, result_rows, deck_card_rows, sources


def build_source_coverage() -> list[dict]:
    return [
        {
            "source_name": "Egman Events",
            "status": "active",
            "coverage_level": "event_results_and_decklists",
            "notes": "Primary structured source for Gundam topping decklists, archetypes, placings, and public deckbuilder links.",
            "source_url": "https://egmanevents.com/gundam-gd03-format",
        },
        {
            "source_name": "Limitless",
            "status": "active",
            "coverage_level": "public_tournament_results_and_decklists",
            "notes": "Useful secondary source for recent public Gundam tournaments with standings and submitted decklists.",
            "source_url": LIMITLESS_COMPLETED_URL,
        },
        {
            "source_name": "GUNDECK.AI",
            "status": "tracked_methodology_only",
            "coverage_level": "ranked_game_trend_reference",
            "notes": "Its MSA game-log methodology is useful for trend and consistency ideas. No inferred GUNDECK.AI game is merged into verified tournament standings or full decklists without a permitted structured source.",
            "source_url": "https://gundeck.ai/",
        },
        {
            "source_name": "ExBurst Gundam",
            "status": "tracked_manual_review",
            "coverage_level": "community_card_and_public_deck_reference",
            "notes": "Useful for early community card discovery and public deck imports. Reported card signals remain outside the official catalog until Bandai confirms the card number.",
            "source_url": "https://exburst.dev/gundam",
        },
        {
            "source_name": "Gundam GCG Meta Decks (@GundamTCGmeta)",
            "status": "tracked_manual_review",
            "coverage_level": "jp_meta_deck_aggregator",
            "notes": "Community X profile focused on JP Gundam meta deck posts. Valuable for discovery and manual curation, but not treated as a stable automated decklist feed.",
            "source_url": "https://x.com/GundamTCGmeta",
        },
        {
            "source_name": "TCG Top Decks",
            "status": "tracked_inactive",
            "coverage_level": "not_confirmed_for_gundam",
            "notes": "Tracked as a possible source, but no stable public Gundam event/deck index was confirmed during this build.",
            "source_url": "https://tcgtopdecks.com/",
        },
        {
            "source_name": "TopDeck.gg",
            "status": "tracked_metadata_only",
            "coverage_level": "event_discovery_only",
            "notes": "Public Gundam event hub exists, but no consistent public decklist/result feed was confirmed for this workbook.",
            "source_url": "https://topdeck.gg/gundam",
        },
        {
            "source_name": "RK9.gg",
            "status": "tracked_metadata_only",
            "coverage_level": "registration_only",
            "notes": "Useful for registration/event detail pages, but not currently a reliable public decklist source for meta statistics.",
            "source_url": "https://rk9.gg/",
        },
    ]


def write_csv(path: Path, rows: list[dict], fieldnames: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(fieldnames))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EGMAN_DIR.mkdir(parents=True, exist_ok=True)
    LIMITLESS_DIR.mkdir(parents=True, exist_ok=True)

    card_lookup = load_card_lookup()
    snapshot_utc = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    egman_table_urls, egman_source_rows = parse_egman_format_pages()
    source_rows = list(egman_source_rows)

    egman_events: list[dict] = []
    egman_results: list[dict] = []
    egman_deck_cards: list[dict] = []
    for table_url in egman_table_urls:
        slug = urlparse(table_url).path.strip("/").replace("/", "_") or "table"
        cache_path = EGMAN_DIR / "tables" / f"{slug}.html"
        page_html = fetch_text(table_url, cache_path)
        events, results, deck_cards = parse_egman_table_page(table_url, page_html, card_lookup)
        egman_events.extend(events)
        egman_results.extend(results)
        egman_deck_cards.extend(deck_cards)
        source_rows.append(
            {
                "record_type": "egman_table_page",
                "record_id": slug,
                "source_url": table_url,
                "cache_file": str(cache_path.relative_to(ROOT)),
            }
        )

    limitless_events, limitless_results, limitless_deck_cards, limitless_source_rows = (
        fetch_limitless_data(card_lookup)
    )
    source_rows.extend(limitless_source_rows)

    events_by_id = {row["event_id"]: row for row in egman_events + limitless_events}
    results_by_id = {row["result_id"]: row for row in egman_results + limitless_results}
    deck_cards_by_id = {row["deck_card_id"]: row for row in egman_deck_cards + limitless_deck_cards}

    events = sorted(events_by_id.values(), key=lambda row: (row["event_date"], row["event_name"], row["source_name"]))
    results = sorted(
        results_by_id.values(),
        key=lambda row: (
            row["event_date"],
            row["event_name"],
            row["placing_rank"] if row["placing_rank"] is not None else 999,
            row["player_name"],
        ),
    )
    deck_cards = sorted(
        deck_cards_by_id.values(),
        key=lambda row: (
            row["event_date"],
            row["event_name"],
            row["placing_rank"] if row["placing_rank"] is not None else 999,
            row["player_name"],
            row["card_number"],
        ),
    )
    source_rows.sort(key=lambda row: (row["record_type"], row["record_id"]))

    source_coverage = build_source_coverage()
    winner_count = sum(1 for row in results if row.get("placing_rank") == 1)
    top8_count = sum(
        1
        for row in results
        if isinstance(row.get("placing_rank"), int) and int(row["placing_rank"]) <= 8
    )
    top16_count = sum(
        1
        for row in results
        if isinstance(row.get("placing_rank"), int) and int(row["placing_rank"]) <= COMPETITIVE_CUT_LIMIT
    )

    snapshot = {
        "snapshot_generated_utc": snapshot_utc,
        "events_count": len(events),
        "results_count": len(results),
        "deck_cards_count": len(deck_cards),
        "winner_decks_count": winner_count,
        "top8_results_count": top8_count,
        "top16_results_count": top16_count,
        "competitive_cut_limit": COMPETITIVE_CUT_LIMIT,
        "source_coverage_count": len(source_coverage),
        "events": events,
        "results": results,
        "deck_cards": deck_cards,
        "source_coverage": source_coverage,
        "sources": source_rows,
    }
    META_SNAPSHOT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")

    write_csv(
        DATA_DIR / "meta_events.csv",
        events,
        [
            "event_id",
            "source_name",
            "event_name",
            "event_date",
            "format_name",
            "event_type",
            "player_count",
            "organizer",
            "source_url",
            "source_page_title",
            "event_instance",
        ],
    )
    write_csv(
        DATA_DIR / "meta_results.csv",
        results,
        [
            "result_id",
            "deck_id",
            "event_id",
            "source_name",
            "event_name",
            "event_date",
            "format_name",
            "event_type",
            "player_count",
            "player_name",
            "placing_label",
            "placing_rank",
            "archetype",
            "color_combination",
            "leader_name",
            "deck_url",
            "source_url",
            "has_decklist",
        ],
    )
    write_csv(
        DATA_DIR / "meta_deck_cards.csv",
        deck_cards,
        [
            "deck_card_id",
            "deck_id",
            "event_id",
            "source_name",
            "event_name",
            "event_date",
            "player_name",
            "placing_label",
            "placing_rank",
            "archetype",
            "color_combination",
            "card_number",
            "card_name",
            "quantity",
            "card_type",
            "card_color",
            "package_code",
            "package_label",
        ],
    )
    write_csv(
        DATA_DIR / "meta_source_coverage.csv",
        source_coverage,
        [
            "source_name",
            "status",
            "coverage_level",
            "notes",
            "source_url",
        ],
    )
    write_csv(
        DATA_DIR / "meta_sources.csv",
        source_rows,
        ["record_type", "record_id", "source_url", "cache_file"],
    )

    print(
        json.dumps(
            {
                "snapshot_generated_utc": snapshot_utc,
                "events_count": len(events),
                "results_count": len(results),
                "deck_cards_count": len(deck_cards),
                "winner_decks_count": winner_count,
                "top8_results_count": top8_count,
                "top16_results_count": top16_count,
                "competitive_cut_limit": COMPETITIVE_CUT_LIMIT,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
