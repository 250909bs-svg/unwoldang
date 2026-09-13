# General Signature True-Solar-Time Validation

Date: 2026-09-07

## Scope

This validation covers only the astronomical equation-of-time component and the
legal-clock-to-apparent-solar-time conversion. It does not declare a universal
Myeongri policy for whether true-solar correction must be used.

## Independent basis

- NOAA defines the clock correction as equation of time plus four minutes per
  longitude degree minus the civil timezone offset.
- JPL DE440s was evaluated through Skyfield 1.53 and jplephem 2.24. The ephemeris
  SHA-256 is stored in the minimal evidence snapshot.
- The independent calculation uses apparent solar right ascension of date and
  Greenwich apparent sidereal time. It does not call Unwoldang code.

## Result

- Legacy Spencer/NOAA fractional-year approximation: 48 sampled instants,
  maximum absolute error 48.278 seconds and mean absolute error 19.324 seconds
  against JPL DE440s; 33/48 samples produced the same rounded minute.
- Astronomy Engine 2.1.19: the committed 20-point JPL sample stays within one
  second. No new dependency was added because the exact pinned package already
  powers the validated solar-term engine.
- Representative `1992-09-09 10:24 Asia/Seoul`, longitude 126.978°: JPL equation
  of time is 2.646860 minutes. The total correction rounds to -29 minutes and
  yields apparent solar time 09:55; the hour pillar remains 丁巳.
- The stricter IANA round-trip exposed two pre-existing Golden input errors:
  Seoul `1960-01-01` uses UTC+08:30, and `1987-06-10` uses the historical
  UTC+10:00 daylight-saving offset. Fixture IDs were retained and only these
  input offsets were corrected with IANA provenance.

## Policy and release limits

- IANA timezone validation must resolve the physical instant before this step.
- Verified numeric longitude is required; free-text place names are insufficient.
- Exact dayun startsAt remains a separate policy-sensitive item and is not
  validated by this evidence.
- Archived reports retain their recorded calendar policy version; the calendar
  engine version is raised to `calendar-v2.2.0`, invalidating older preflight
  fingerprints for new generation.
