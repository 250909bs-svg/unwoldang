# General Signature Time and Dayun Independent Audit

Date: 2026-09-02
RC base: `6deeda44b9b128c204ce7f509646228bdd8de208`
Scope: audit evidence and comparison tools only. Production FACT engine changes: none.

## Current policy extracted from code

- Day boundary defaults to `civil-midnight`. Optional `late-zi-next-day` moves the effective sexagenary date at apparent-solar 23:00.
- Hour branch uses 子 for 23:00-00:59, then two civil hours per branch through 亥 at 21:00-22:59.
- Hour stem uses the selected effective day stem and the 五鼠遁 table.
- Overseas input requires an explicit UTC offset and a syntactically valid IANA zone identifier.
- True-solar time is applied only with verified longitude. Correction is `4 × (longitude - offset/4) + equation of time`, rounded to one minute, before day/hour calculation.
- Dayun direction is forward for yang-year male or yin-year female, otherwise reverse.
- Forward uses the next major solar term; reverse uses the previous major solar term.
- Current start conversion is `term distance / 3 = years`, then `birth instant + years × 365.2422 days`.

## Independent sources

| Source | Decision | Supported facts | Limitations |
|---|---|---|---|
| 6tail `lunar-javascript@1.7.7` | approved, Tier B | sect 1/2 day pillar, hour pillar, dayun direction, first dayun, sect-2 startsAt | one provider; its late-Zi hour-stem and calendar-component startsAt policies are not universal |
| 易學象數論/六壬透易 | Tier C table | 五鼠遁 starting stems | table/policy source, not a complete manse provider |
| 淵海子平 論起大運法 | Tier C policy | direction, previous/next 節, three days per year | does not define one exact modern timestamp representation |
| IANA tzdb 2026b / ICU 78.3 | Tier A | offset and normalized instant | no true-solar-time validation |
| JPL DE440s + Skyfield 1.53 | Tier A | second-level solar-term instant | no late-Zi or dayun interpretation policy |

The 6tail package was installed only under the untracked audit directory, with install scripts disabled. The committed evidence stores version, MIT license, and npm integrity; it is not a production dependency.

## Results

### Hour and late-Zi

- Clock hour to branch: 24/24 match.
- 五鼠遁 day-stem × hour-branch table: 120/120 match.
- 32 policy rows (two dates × eight times × two policies): day pillar 32/32 match.
- Hour pillar: 26/32 match; six documented policy differences.
- All six differences are the civil-midnight policy at 23:00, 23:30, or 23:59. Unwoldang uses the retained civil-day stem for the hour stem. 6tail keeps the civil-day pillar in sect 2 but still uses its next-day exact stem for the time pillar.
- No unexplained late-Zi mismatch was found.
- The Golden expected hour pillar is derived from the explicitly selected day-boundary policy plus the independent 五鼠遁 table. The 6tail alternative remains recorded as a policy difference rather than being overwritten.

Representative `1992-09-09 10:24 Asia/Seoul`: KASI day pillar 戊子 + 巳 branch + 五鼠遁 gives 丁巳; current result is 丁巳.

### Dayun

- Five male/female pairs: direction 10/10 match against both the classical rule and 6tail.
- First dayun pillar: 10/10 match.
- Exact startsAt: 0/10 identical to 6tail sect 2.
- Maximum absolute delta: 190,615.538 seconds (2.2062 days).
- Mean absolute delta: 101,037.395 seconds.
- This is classified as `POLICY_DIFFERENCE`, not an engine bug: Unwoldang adds a continuous tropical-year duration; 6tail converts the term-distance minutes into calendar years/months/days/hours and adds calendar components.
- There is no second independently approved provider that publishes reproducible exact startsAt timestamps. Exact startsAt therefore remains pending.

### Timezone and DST

- Existing Golden offset/normalized-instant evidence remains 16/16 matched.
- Both New York fall-back `01:30` instants are distinguishable when explicit offsets `-04:00` and `-05:00` are supplied.
- `2024-03-10 02:30 America/New_York -05:00` does not round-trip in IANA tzdb because that wall time does not exist.
- Current normalization validates only the zone identifier and offset range, then accepts this nonexistent wall time. Classification: `ENGINE_BUG_CONFIRMED`.
- No production code was changed in this audit; a separately approved fix must validate the local wall time and explicit offset against IANA rules without breaking ambiguous fall-back input.

### True solar time

- Longitude correction, equation-of-time inclusion, and one-minute rounding policies were extracted.
- IANA evidence does not validate longitude or equation of time.
- No second independent apparent-solar-time evidence set was approved in this phase. The two true-solar Golden cases remain insufficiently evidenced.

### JPL boundary twelve fields

JPL second-level instants place all six affected fixture input times unambiguously before or after 경칩, 입추, and 백로. The production boundary-pillar mismatch remains 0. The Golden harness still exposes 12 minute-representation mismatches because NAOJ is minute-rounded while the production comparison contract rounds the astronomical instant to a minute. They remain classified `INSUFFICIENT_EVIDENCE`, with `UNEXPLAINED_MISMATCH = 0`; expected values were not rewritten to current output.

## Golden matrix after evidence application

- Total: 140
- Verified: 16
- Partial: 116
- Pending: 8
- Conflicting: 0
- Verified FACT fields: 378
- Matched FACT fields: 256
- Mismatched FACT fields: 12, all explained minute-precision cases
- Unexplained mismatch: 0

The 16 day-boundary fixtures are verified. Ten dayun fixtures become partial because pillars, direction, and first dayun are verified while exact startsAt remains pending. Eight time-uncertainty fixtures remain pending.

## Release gate

`TIME_AND_DAYUN_INDEPENDENT_AUDIT_NO_GO`

Reasons:

1. Nonexistent DST local time is accepted by the current normalization path.
2. Exact dayun startsAt lacks a second reproducible source and differs by conversion policy from the approved provider.
3. True-solar-time correction still lacks an approved independent evidence set.
