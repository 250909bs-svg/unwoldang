"""Independently audit Unwoldang solar-term instants.

This script intentionally does not import or execute the Unwoldang engine.
It compares a literal audit reproduction of the current compact solar-longitude
formula against:

* NAOJ Reki Yoko annual tables (official, minute precision, JCST / UTC+09:00)
* HKO 2024 major solar-term table (official, minute precision, HKT / UTC+08:00)
* JPL DE440s through Skyfield 1.53 (independent implementation, sub-minute)

Downloaded publications and the temporary Python dependency stay under
``artifacts/``.  The output contains hashes and the minimum fields needed to
reproduce the audit; it never contains credentials or user data.
"""

from __future__ import annotations

import hashlib
import json
import math
import statistics
import sys
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
AUDIT_ROOT = ROOT / "artifacts" / "solar-term-audit"
OFFICIAL_ROOT = AUDIT_ROOT / "official"
SKYFIELD_ROOT = AUDIT_ROOT / "skyfield-data"
VENDOR_ROOT = AUDIT_ROOT / "vendor"
OUTPUT_PATH = AUDIT_ROOT / "solar-term-engine-audit.json"

sys.path.insert(0, str(VENDOR_ROOT))

try:
    import pdfplumber
    import numpy as np
    from skyfield.api import Loader
    from skyfield.framelib import ecliptic_frame
except ImportError as error:  # pragma: no cover - operator setup error
    raise RuntimeError(
        "Install Skyfield into artifacts/solar-term-audit/vendor before running this audit."
    ) from error


J2000 = 2451545.0
UNIX_EPOCH_JD = 2440587.5
SECONDS_PER_DAY = 86400.0
AUDIT_YEARS = (1989, 1990, 1992, 2000, 2010, 2012, 2020, 2024, 2025, 2030)
NAOJ_YEARS = (2010, 2012, 2020, 2024, 2025)
TERM_ANGLES = tuple(range(0, 360, 15))
TERM_NAMES = {
    0: "춘분", 15: "청명", 30: "곡우", 45: "입하", 60: "소만", 75: "망종",
    90: "하지", 105: "소서", 120: "대서", 135: "입추", 150: "처서",
    165: "백로", 180: "추분", 195: "한로", 210: "상강", 225: "입동",
    240: "소설", 255: "대설", 270: "동지", 285: "소한", 300: "대한",
    315: "입춘", 330: "우수", 345: "경칩",
}

# HKO 2024 major solar terms.  Values are transcribed from the one-page
# official publication whose SHA-256 is included in the result.  HKO publishes
# these in HKT (UTC+08:00), not KST/JST.
HKO_MAJOR_2024 = {
    300: (1, 20, 22, 7), 330: (2, 19, 12, 13), 0: (3, 20, 11, 6),
    30: (4, 19, 22, 0), 60: (5, 20, 21, 0), 90: (6, 21, 4, 51),
    120: (7, 22, 15, 44), 150: (8, 22, 22, 55), 180: (9, 22, 20, 44),
    210: (10, 23, 6, 15), 240: (11, 22, 3, 56), 270: (12, 21, 17, 21),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "UnwoldangGoldenAudit/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            destination.write_bytes(response.read())
    return destination


def pairs(text: str, header: str | None = None) -> list[tuple[int, int]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if header and lines and lines[0].replace(" ", "") == header:
        lines = lines[1:]
    result: list[tuple[int, int]] = []
    for line in lines:
        values = [int(value) for value in line.split()]
        if len(values) != 2:
            raise RuntimeError(f"Expected a numeric pair, received {line!r}")
        result.append((values[0], values[1]))
    return result


def parse_naoj_year(year: int) -> tuple[dict[int, datetime], dict[str, Any]]:
    url = f"https://eco.mtk.nao.ac.jp/koyomi/yoko/pdf/yoko{year}.pdf"
    path = download(url, OFFICIAL_ROOT / f"yoko{year}.pdf")
    result: dict[int, datetime] = {}
    with pdfplumber.open(path) as pdf:
        solar_page = next(
            (page for page in pdf.pages if "二十四節気" in (page.extract_text() or "")),
            None,
        )
        if solar_page is None:
            raise RuntimeError(f"Machine-readable NAOJ solar-term page not found in {path.name}")

        tables = solar_page.extract_tables()
        if tables and len(tables[0]) >= 3:
            row = tables[0][2]
            for offset in (0, 4):
                angle_lines = [line.strip() for line in (row[offset + 1] or "").splitlines() if line.strip()]
                if angle_lines and angle_lines[0] == "度":
                    angle_lines = angle_lines[1:]
                angles = [int(value) for value in angle_lines]
                dates = pairs(row[offset + 2] or "", "月日")
                times = pairs(row[offset + 3] or "", "時分")
                if not (len(angles) == len(dates) == len(times)):
                    raise RuntimeError(
                        f"NAOJ table columns differ in {path.name}: "
                        f"angles={len(angles)}, dates={len(dates)}, times={len(times)}"
                    )
                for angle, (month, day), (hour, minute) in zip(angles, dates, times):
                    local = datetime(year, month, day, hour, minute, tzinfo=UTC)
                    result[angle] = local - timedelta(hours=9)
        else:
            # Text PDFs expose numeric cells as words at stable column positions.
            words = solar_page.extract_words()
            column_sets = (
                (175.0, 205.0, ((208.0, 230.0), (230.0, 253.0), (253.0, 278.0), (278.0, 302.0))),
                (365.0, 396.0, ((396.0, 420.0), (420.0, 444.0), (444.0, 468.0), (468.0, 492.0))),
            )
            for angle_left, angle_right, value_columns in column_sets:
                angle_words = [
                    word for word in words
                    if angle_left <= float(word["x0"]) < angle_right
                    and str(word["text"]).isdigit()
                    and int(word["text"]) in TERM_ANGLES
                ]
                for angle_word in angle_words:
                    top = float(angle_word["top"])
                    values: list[int] = []
                    for left, right in value_columns:
                        matches = [
                            word for word in words
                            if left <= float(word["x0"]) < right
                            and abs(float(word["top"]) - top) < 1.25
                            and str(word["text"]).isdigit()
                        ]
                        if len(matches) != 1:
                            break
                        values.append(int(matches[0]["text"]))
                    if len(values) == 4:
                        month, day, hour, minute = values
                        angle = int(angle_word["text"])
                        local = datetime(year, month, day, hour, minute, tzinfo=UTC)
                        result[angle] = local - timedelta(hours=9)

    if set(result) != set(TERM_ANGLES):
        raise RuntimeError(f"NAOJ {year} did not yield all 24 terms: {sorted(result)}")
    return result, {
        "year": year,
        "url": url,
        "sha256": sha256(path),
        "timezone": "JCST",
        "utcOffsetMinutes": 540,
        "precision": "minute-rounded",
    }


def hko_2024() -> tuple[dict[int, datetime], dict[str, Any]]:
    url = "https://www.hko.gov.hk/en/gts/astron2024/files/2024SolarTerms24.pdf"
    path = download(url, OFFICIAL_ROOT / "hko-2024-solar-terms.pdf")
    result = {
        angle: datetime(2024, month, day, hour, minute, tzinfo=UTC) - timedelta(hours=8)
        for angle, (month, day, hour, minute) in HKO_MAJOR_2024.items()
    }
    return result, {
        "year": 2024,
        "url": url,
        "sha256": sha256(path),
        "timezone": "HKT",
        "utcOffsetMinutes": 480,
        "precision": "minute-rounded",
        "fields": "12 major solar terms",
    }


def to_jd(value: datetime) -> float:
    return value.timestamp() / SECONDS_PER_DAY + UNIX_EPOCH_JD


def from_jd(jd: float) -> datetime:
    return datetime.fromtimestamp((jd - UNIX_EPOCH_JD) * SECONDS_PER_DAY, tz=UTC)


def normalize_angle(angle: float) -> float:
    return angle - math.floor(angle / 360.0) * 360.0


def signed_angle_difference(target: float, actual: float) -> float:
    difference = target - actual
    if difference < -180.0:
        return difference + 360.0
    if difference > 180.0:
        return difference - 360.0
    return difference


def compact_solar_longitude(jd: float) -> float:
    """Literal audit reproduction of src/lib/saju/sxtwl.ts."""
    t = (jd - J2000) / 36525.0
    mean_longitude = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
    mean_anomaly = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
    anomaly_radians = math.radians(mean_anomaly)
    center = (
        (1.914602 - 0.004817 * t - 0.000014 * t * t) * math.sin(anomaly_radians)
        + (0.019993 - 0.000101 * t) * math.sin(2.0 * anomaly_radians)
        + 0.000289 * math.sin(3.0 * anomaly_radians)
    )
    true_longitude = mean_longitude + center
    omega = 125.04 - 1934.136 * t
    apparent = true_longitude - 0.00569 - 0.00478 * math.sin(math.radians(omega))
    return normalize_angle(apparent)


def compact_root(calculation_year: int, angle: int, *, numerical_derivative: bool = False) -> float:
    january_first = to_jd(datetime(calculation_year, 1, 1, tzinfo=UTC))
    # Production intentionally uses the raw angle delta for the initial
    # January anchor. The public wrapper advances the anchor year for angles
    # below 280 degrees so the result lands in the requested Gregorian year.
    jd = january_first + (angle - compact_solar_longitude(january_first)) * 365.25 / 360.0
    for _ in range(8):
        difference = signed_angle_difference(angle, compact_solar_longitude(jd))
        if numerical_derivative:
            epsilon = 1.0 / 1440.0
            before = compact_solar_longitude(jd - epsilon)
            after = compact_solar_longitude(jd + epsilon)
            derivative = signed_angle_difference(after, before) / (2.0 * epsilon)
        else:
            derivative = 0.9856
        jd += difference / derivative
    return jd


def current_raw_and_wrapper(year: int, angle: int) -> tuple[datetime, datetime, datetime]:
    calculation_year = year + 1 if angle < 280 else year
    raw = from_jd(compact_root(calculation_year, angle))
    wrapper = raw  # The production wrapper only validates and chooses calculation_year.
    numerical = from_jd(compact_root(calculation_year, angle, numerical_derivative=True))
    return raw, wrapper, numerical


class JplSolarTerms:
    def __init__(self) -> None:
        loader = Loader(str(SKYFIELD_ROOT))
        self.loader = loader
        self.timescale = loader.timescale()
        self.ephemeris = loader("de440s.bsp")
        self.earth = self.ephemeris["earth"]
        self.sun = self.ephemeris["sun"]

    def longitude(self, instant: datetime) -> float:
        time = self.timescale.from_datetime(instant)
        apparent = self.earth.at(time).observe(self.sun).apparent()
        _latitude, longitude, _distance = apparent.frame_latlon(ecliptic_frame)
        return float(longitude.degrees % 360.0)

    def term(self, year: int, angle: int, seed: datetime) -> datetime:
        low = seed - timedelta(days=2)
        high = seed + timedelta(days=2)
        low_difference = signed_angle_difference(angle, self.longitude(low))
        high_difference = signed_angle_difference(angle, self.longitude(high))
        if not (low_difference > 0.0 and high_difference < 0.0):
            raise RuntimeError(
                f"JPL root bracket failed for {year=} {angle=}: "
                f"low={low_difference}, high={high_difference}"
            )
        for _ in range(48):
            midpoint = low + (high - low) / 2
            difference = signed_angle_difference(angle, self.longitude(midpoint))
            if difference > 0.0:
                low = midpoint
            else:
                high = midpoint
        return low + (high - low) / 2


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def delta_seconds(left: datetime, right: datetime) -> float:
    return (left - right).total_seconds()


def rounded_minute_delta(left: datetime, right: datetime) -> float:
    return delta_seconds(left, right)


def summarize(values: list[float]) -> dict[str, float]:
    return {
        "count": len(values),
        "minSeconds": round(min(values), 3),
        "maxSeconds": round(max(values), 3),
        "maxAbsoluteSeconds": round(max(abs(value) for value in values), 3),
        "meanSeconds": round(statistics.fmean(values), 3),
        "meanAbsoluteSeconds": round(statistics.fmean(abs(value) for value in values), 3),
        "medianSeconds": round(statistics.median(values), 3),
    }


def main() -> None:
    OFFICIAL_ROOT.mkdir(parents=True, exist_ok=True)
    SKYFIELD_ROOT.mkdir(parents=True, exist_ok=True)

    naoj: dict[int, dict[int, datetime]] = {}
    naoj_sources: list[dict[str, Any]] = []
    for year in NAOJ_YEARS:
        rows, source = parse_naoj_year(year)
        naoj[year] = rows
        naoj_sources.append(source)

    hko, hko_source = hko_2024()
    jpl = JplSolarTerms()

    records: list[dict[str, Any]] = []
    for year in AUDIT_YEARS:
        for angle in TERM_ANGLES:
            official = naoj.get(year, {}).get(angle)
            raw, wrapper, numerical = current_raw_and_wrapper(year, angle)
            seed = official or wrapper
            jpl_instant = jpl.term(year, angle, seed)
            model_angle_at_jpl = compact_solar_longitude(to_jd(jpl_instant))
            longitude_error_degrees = signed_angle_difference(angle, model_angle_at_jpl)
            item: dict[str, Any] = {
                "year": year,
                "angle": angle,
                "name": TERM_NAMES[angle],
                "officialNaojUtc": iso(official) if official else None,
                "jplSkyfieldUtc": iso(jpl_instant),
                "engineRawUtc": iso(raw),
                "engineWrapperUtc": iso(wrapper),
                "engineNumericalDerivativeUtc": iso(numerical),
                "rawWrapperDeltaSeconds": round(delta_seconds(raw, wrapper), 6),
                "fixedVsNumericalDerivativeSeconds": round(delta_seconds(raw, numerical), 6),
                "engineMinusJplSeconds": round(delta_seconds(wrapper, jpl_instant), 3),
                "compactLongitudeErrorAtJplArcseconds": round(longitude_error_degrees * 3600.0, 6),
            }
            if official:
                item["engineMinusNaojSeconds"] = round(rounded_minute_delta(wrapper, official), 3)
                item["jplMinusNaojSeconds"] = round(rounded_minute_delta(jpl_instant, official), 3)
            if year == 2024 and angle in hko:
                item["officialHkoUtc"] = iso(hko[angle])
                item["hkoMinusNaojSeconds"] = round(delta_seconds(hko[angle], official), 3)
            records.append(item)

    current_vs_jpl = [row["engineMinusJplSeconds"] for row in records]
    current_vs_naoj = [row["engineMinusNaojSeconds"] for row in records if "engineMinusNaojSeconds" in row]
    jpl_vs_naoj = [row["jplMinusNaojSeconds"] for row in records if "jplMinusNaojSeconds" in row]
    raw_wrapper = [row["rawWrapperDeltaSeconds"] for row in records]
    derivative = [row["fixedVsNumericalDerivativeSeconds"] for row in records]
    hko_naoj = [row["hkoMinusNaojSeconds"] for row in records if "hkoMinusNaojSeconds" in row]

    by_year = {}
    for year in AUDIT_YEARS:
        year_rows = [row for row in records if row["year"] == year]
        by_year[str(year)] = {
            "engineVsJpl": summarize([row["engineMinusJplSeconds"] for row in year_rows]),
            "engineVsNaoj": summarize([row["engineMinusNaojSeconds"] for row in year_rows if "engineMinusNaojSeconds" in row])
            if year in naoj else None,
            "officialNaojAvailable": year in naoj,
        }

    result = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(tz=UTC).isoformat(timespec="seconds"),
        "engineImportUsed": False,
        "currentEngineUsedAsExpected": False,
        "timezoneNormalization": {
            "NAOJ": "JCST UTC+09:00 converted to UTC by subtracting 9 hours",
            "HKO": "HKT UTC+08:00 converted to UTC by subtracting 8 hours",
            "JPL": "Skyfield UTC input with TT/TDB handled by its timescale and DE440s",
        },
        "sources": {
            "NAOJ": naoj_sources,
            "HKO": hko_source,
            "JPL_DE440S": {
                "name": "JPL Planetary and Lunar Ephemerides DE440s",
                "file": "de440s.bsp",
                "sha256": sha256(SKYFIELD_ROOT / "de440s.bsp"),
                "implementation": "Skyfield 1.53 true ecliptic and equinox of date, apparent geocentric Sun",
                "reference": "https://ssd.jpl.nasa.gov/planets/eph_export.html",
            },
        },
        "statistics": {
            "engineVsJpl": summarize(current_vs_jpl),
            "engineVsNaoj": summarize(current_vs_naoj),
            "jplVsNaoj": summarize(jpl_vs_naoj),
            "rawVsWrapper": summarize(raw_wrapper),
            "fixedVsNumericalDerivative": summarize(derivative),
            "hkoVsNaoj2024MajorTerms": summarize(hko_naoj),
            "byYear": by_year,
        },
        "records": records,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["statistics"], ensure_ascii=False, indent=2))
    print(f"Wrote {len(records)} term comparisons to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
