# KASI Local Live Verification

- Status: `KASI_LOCAL_LIVE_VERIFIED`
- Verified at: 2026-08-25 (Asia/Seoul)
- Scope: local release-candidate verification only
- Command: `npm run test:kasi:smoke`
- Result: 5 tests passed

## Verified capabilities

1. 1992-09-09 solar date to lunar date conversion, including year/month/day sexagenary metadata
2. Regular lunar-month date to solar date conversion
3. Leap lunar-month date to solar date conversion
4. KASI 2024 Ipchun date verification with the internal minute-level solar-term boundary
5. KASI 2024 Gyeongchip date verification with the internal month-boundary calculation

## Credential handling

The lunar-calendar and special-day Decoding Keys were injected separately through
`KASI_LUNAR_SERVICE_KEY` and `KASI_SPECIALDAY_SERVICE_KEY`. The credentials were
removed from the local environment after the smoke test. No credential value is
stored in this repository or in this verification record.

## Release interpretation

This status verifies local live authentication, response parsing, calendar
conversion, leap-month handling, and solar-term date cross-checking. Production
still requires the two secrets to be created in Google Secret Manager and mapped
to the Cloud Run service. This record does not indicate that a production deploy
has occurred.
