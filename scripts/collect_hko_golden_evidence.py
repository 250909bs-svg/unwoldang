"""Collect minimal, reproducible HKO calendar evidence for golden fixture dates.

The script never calls the Unwoldang engine. It downloads official HKO
Gregorian/Lunar conversion PDFs, extracts only fields referenced by the golden
matrix, and stores source URLs plus SHA-256 hashes. Full PDFs stay in the local
artifact cache and are intentionally not source-controlled.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "artifacts" / "golden-source-cache"
TARGETS_PATH = CACHE / "golden-fixture-targets.json"
OUTPUT_PATH = ROOT / "src" / "lib" / "saju" / "golden" / "evidence" / "hko-calendar.json"
HKO_URL = "https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/{year}e.pdf"
MONTHS = {name: index for index, name in enumerate(
    ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1
)}


@dataclass(frozen=True)
class LunarDay:
    lunar_year: int
    lunar_month: int
    lunar_day: int
    leap_month: bool


def download(year: int) -> tuple[Path, str, str]:
    CACHE.mkdir(parents=True, exist_ok=True)
    url = HKO_URL.format(year=year)
    destination = CACHE / f"{year}e.pdf"
    if not destination.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            destination.write_bytes(response.read())
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    return destination, url, digest


def month_header(cell: str | None) -> int | None:
    if not cell:
        return None
    match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)\b", cell)
    return int(match.group(1)) if match else None


def month_rows(pdf_path: Path) -> dict[int, list[str | None]]:
    with pdfplumber.open(pdf_path) as pdf:
        tables = pdf.pages[0].extract_tables()
    if not tables:
        raise RuntimeError(f"No table found in {pdf_path.name}")
    rows: dict[int, list[str | None]] = {}
    for row in tables[0]:
        if row and row[0] in MONTHS:
            rows[MONTHS[row[0]]] = row[2:33]
    if set(rows) != set(range(1, 13)):
        raise RuntimeError(f"Incomplete month table in {pdf_path.name}: {sorted(rows)}")
    return rows


def build_year_map(year: int, rows: dict[int, list[str | None]]) -> dict[str, LunarDay]:
    headers: list[tuple[date, int]] = []
    raw_days: dict[date, int] = {}
    for month, cells in rows.items():
        for day, cell in enumerate(cells, 1):
            try:
                solar = date(year, month, day)
            except ValueError:
                continue
            value = (cell or "").strip()
            header = month_header(value)
            if header is not None:
                headers.append((solar, header))
                raw_days[solar] = 1
            elif value.isdigit():
                raw_days[solar] = int(value)

    headers.sort()
    if not headers:
        raise RuntimeError(f"No lunar month headers in {year}")

    occurrences: dict[tuple[int, int], int] = {}
    annotated_headers: list[tuple[date, int, int, bool]] = []
    for solar, lunar_month in headers:
        lunar_year = year if lunar_month == 1 or solar >= next(
            (item[0] for item in headers if item[1] == 1), date(year + 1, 1, 1)
        ) else year - 1
        key = (lunar_year, lunar_month)
        occurrences[key] = occurrences.get(key, 0) + 1
        annotated_headers.append((solar, lunar_year, lunar_month, occurrences[key] > 1))

    result: dict[str, LunarDay] = {}
    first_solar, first_lunar_year, first_month, _ = annotated_headers[0]
    previous_month = 12 if first_month == 1 else first_month - 1
    previous_year = first_lunar_year - 1 if first_month == 1 else first_lunar_year

    for solar, lunar_day in raw_days.items():
        prior = [item for item in annotated_headers if item[0] <= solar]
        if prior:
            _, lunar_year, lunar_month, leap_month = prior[-1]
        else:
            lunar_year, lunar_month, leap_month = previous_year, previous_month, False
        result[solar.isoformat()] = LunarDay(lunar_year, lunar_month, lunar_day, leap_month)
    return result


def main() -> None:
    if not TARGETS_PATH.exists():
        raise RuntimeError(f"Run scripts/export-golden-fixtures.mjs first: {TARGETS_PATH}")
    targets = json.loads(TARGETS_PATH.read_text(encoding="utf-8"))
    relevant = [item for item in targets if item["category"] in {
        "solar-general", "lunar-regular", "lunar-leap"
    }]
    years = set()
    for item in relevant:
        input_year = int(item["input"]["birthDate"][:4])
        years.add(input_year)
        if item["input"]["calendarType"] == "lunar":
            years.add(input_year + 1)

    maps: dict[int, dict[str, LunarDay]] = {}
    sources: dict[int, dict[str, str | int]] = {}
    for year in sorted(years):
        pdf_path, url, digest = download(year)
        maps[year] = build_year_map(year, month_rows(pdf_path))
        sources[year] = {"year": year, "url": url, "sha256": digest}

    inverse: dict[tuple[int, int, int, bool], str] = {}
    for mapping in maps.values():
        for solar, lunar in mapping.items():
            inverse[(lunar.lunar_year, lunar.lunar_month, lunar.lunar_day, lunar.leap_month)] = solar

    entries = []
    for item in relevant:
        fixture_input = item["input"]
        source_year: int
        if fixture_input["calendarType"] == "solar":
            solar = fixture_input["birthDate"]
            source_year = int(solar[:4])
            lunar = maps[source_year].get(solar)
            if lunar is None:
                raise RuntimeError(f"Missing HKO solar date {solar}")
        else:
            lunar_year, lunar_month, lunar_day = map(int, fixture_input["birthDate"].split("-"))
            leap_month = bool(fixture_input["leapMonth"])
            solar = inverse.get((lunar_year, lunar_month, lunar_day, leap_month))
            if solar is None:
                entries.append({
                    "fixtureId": item["id"],
                    "status": "source-data-not-found",
                    "requestedLunarDate": fixture_input["birthDate"],
                    "requestedLeapMonth": leap_month,
                    "sourceId": f"hko-calendar-{lunar_year}",
                    "sourceSha256": sources[lunar_year]["sha256"],
                    "classification": "EXPECTED_DATA_ERROR_CANDIDATE",
                    "notes": "No matching regular/leap lunar date exists in the official HKO conversion table."
                })
                continue
            source_year = int(solar[:4])
            lunar = maps[source_year][solar]

        entries.append({
            "fixtureId": item["id"],
            "status": "verified-source-record",
            "solarDate": solar,
            "lunarDate": f"{lunar.lunar_year:04d}-{lunar.lunar_month:02d}-{lunar.lunar_day:02d}",
            "leapMonth": lunar.leap_month,
            "sourceId": f"hko-calendar-{source_year}",
            "sourceSha256": sources[source_year]["sha256"]
        })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "sourceAuthority": "Hong Kong Observatory",
        "accessedAt": "2026-09-02",
        "fieldsSupported": ["normalizedSolarDate", "normalizedLunarDate", "leapMonth"],
        "limitations": [
            "The HKO Gan-Zhi year changes at Lunar New Year and is not used as a BaZi Ipchun year-pillar authority.",
            "The PDF conversion table does not verify hour pillars, Ten Gods, twelve stages, or Dayun policy."
        ],
        "sources": list(sources.values()),
        "entries": entries
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} fixture evidence rows from {len(sources)} official HKO PDFs to {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"HKO_EVIDENCE_ERROR: {error}", file=sys.stderr)
        raise
