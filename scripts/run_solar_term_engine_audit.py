"""Run the solar-term audit with parsers for both modern NAOJ PDF layouts."""

from __future__ import annotations

import importlib.util
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "solar_term_audit_core",
    SCRIPT_DIR / "audit_solar_term_engine.py",
)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load solar-term audit core")
audit = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = audit
spec.loader.exec_module(audit)

# 1990/1992/2000 are official scanned publications without a machine-readable
# text layer. They remain cited publications but are not transcribed as
# expected data by this automated audit. 2030 has not yet been published.
audit.NAOJ_YEARS = (2010, 2012, 2020, 2024, 2025)


def parse_naoj_year(year: int) -> tuple[dict[int, datetime], dict[str, Any]]:
    url = f"https://eco.mtk.nao.ac.jp/koyomi/yoko/pdf/yoko{year}.pdf"
    path = audit.download(url, audit.OFFICIAL_ROOT / f"yoko{year}.pdf")
    result: dict[int, datetime] = {}

    with audit.pdfplumber.open(path) as pdf:
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
                dates = audit.pairs(row[offset + 2] or "", "月日")
                times = audit.pairs(row[offset + 3] or "", "時分")
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
                    and int(word["text"]) in audit.TERM_ANGLES
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

    if set(result) != set(audit.TERM_ANGLES):
        raise RuntimeError(f"NAOJ {year} did not yield all 24 terms: {sorted(result)}")
    return result, {
        "year": year,
        "url": url,
        "sha256": audit.sha256(path),
        "timezone": "JCST",
        "utcOffsetMinutes": 540,
        "precision": "minute-rounded",
    }


audit.parse_naoj_year = parse_naoj_year

if __name__ == "__main__":
    audit.main()
