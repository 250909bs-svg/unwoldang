# General Signature Solar-Term Engine Fix Validation

검증일: 2026-09-02
작업 브랜치: `release/general-signature-rc`
범위: 태양황경 기반 24절기 UTC instant 계산만 교체

## 구현 계약

- production engine: `astronomy-engine@2.1.19`의 `SearchSunLongitude`
- runtime dependency: exact version, MIT, install script 없음, transitive dependency 없음
- public contract: `getSolarTermInstantForGregorianYear(year, longitude): Date` 유지
- 시간 의미: 반환값은 절대 UTC instant이며 timezone 표시는 호출자가 한 번만 수행
- 오류: legacy approximation으로 fallback하지 않고 fail closed
- legacy: `solarTermLegacy.ts`에 audit comparison 전용으로 격리, production bundle 제외
- calendar policy: `calendar-v2.0.0` → `calendar-v2.1.0`
- preflight: calendar version이 commercial calculation fingerprint에 포함되어 이전 policy와 다른 fingerprint 생성

## Canonical 24-term longitude table

춘분 0°, 청명 15°, 곡우 30°, 입하 45°, 소만 60°, 망종 75°, 하지 90°, 소서 105°, 대서 120°, 입추 135°, 처서 150°, 백로 165°, 추분 180°, 한로 195°, 상강 210°, 입동 225°, 소설 240°, 대설 255°, 동지 270°, 소한 285°, 대한 300°, 입춘 315°, 우수 330°, 경칩 345°.

24/24 명칭·황경·중복 없음 테스트와 1900~2099 전 범위 4,800 instant 탐색 테스트를 통과했다.

## Independent comparison thresholds

- JPL DE440s/Skyfield second-level reference: 최대 절대 오차 45초 이하
- NAOJ minute-published reference: 최대 절대 오차 75초 이하
- NAOJ의 표시 분과 production instant가 서로 다른 rounding bin에 놓이는 경우에도 expected를 바꾸지 않고 mismatch를 보존한다. JPL second-level 비교가 45초 이내인 1분 차이는 `INSUFFICIENT_EVIDENCE`로 분류한다.

## Results

| 검증 | 결과 |
|---|---:|
| 2024 24절기 | 24/24 JPL·NAOJ 허용범위 내 |
| JPL 10년 × 24 | 240/240, max 41.480s, mean abs 9.914s |
| JPL percentile | P50 8.976s, P95 24.864s, P99 31.300s |
| JPL signed bias | +1.907s |
| NAOJ 5년 × 24 | 120/120 within 75s, max 70.241s, mean abs 20.056s |
| HKO 2024 중기 | 기존 독립 감사의 NAOJ 분단위 12/12 일치 유지 |
| 108 boundary before | year 2, month 15 mismatches |
| 108 boundary after | 96 decisive cases: year 0, month 0 mismatches; official exact minute 12건은 분단위 반올림상 ambiguous |
| exact/±30s 포함 | 132건, non-zero offset side mismatch 0; JPL exact 0초 지점 model difference 6 |
| 대운 startsAt 영향 | 10건, max 45,839.966s, mean abs 23,963.577s; production policy result 10/10 일치 |
| 성능 warm 100회 | legacy 0.020ms/24 terms, precise 0.357ms/24 terms, +0.337ms |

성능 수치는 동일 프로세스의 단순 microbenchmark이며 호스트 부하에 따라 달라질 수 있다. report/preflight latency를 막는 수준은 아니다.

## Regression

- 대표 `1992-09-09 10:24 male Asia/Seoul`: 임신 / 기유 / 무자 / 정사, 일간 무 유지
- 12운성 120/120, 십성 100/100, 지장간 12/12, 관계 33/33 유지
- release preflight auto/manual/blocked 및 client tamper 방어 유지
- Golden 140: verified 0, partial 106, pending 34, conflicting 0. compared 106 중 match 100, minute-evidence mismatch 6. 독립 근거가 없는 필드는 승격하지 않았다.

## Qualification

이번 결과는 태양절기 instant P0 수정의 검증이다. 대운 startsAt 환산 정책 자체, late-zi, hour pillar, 전문가 용신·희기 및 Golden pending 필드의 독립 검증 완료를 뜻하지 않는다.
