# General Signature Golden Source Manifest

접근일: 2026-09-02
원칙: 현재 운월당 엔진과 AI 출력은 expected 근거로 사용하지 않는다. 각 출처가 실제로 제공하는 필드만 검증한다.

| sourceId | tier | 출처 | 검증 필드 | 한계 |
|---|---:|---|---|---|
| `kasi-lunar-api-v1.1` | A | 한국천문연구원 음양력 정보 API / 공공데이터포털 | 양·음력 변환, 윤달, KASI 제공 년·월·일 간지 metadata | 시주·십성·12운성·대운 미지원 |
| `kasi-specialday-api-v1.4` | A | 한국천문연구원 특일 정보 API / 공공데이터포털 | 24절기 날짜 | 분 단위 절입 시각 미지원 |
| `hko-gregorian-lunar-calendar` | A | Hong Kong Observatory 연간 양·음력 변환표 | 양력일, 음력일, 윤달 | 간지년은 설 기준이므로 사주 연주에 사용하지 않음 |
| `naoj-reki-yoko-2024` | A | National Astronomical Observatory of Japan, 2024 solar terms | 절기 분 단위 시각 | 사주 연주·월주를 직접 제공하지 않음 |
| `jpl-de440s-skyfield-1.53` | A | JPL DE440s ephemeris + Skyfield 1.53 재현 계산 | 10개 연도 240개 태양황경 도달 UTC instant | JPL 원본이 사주 기둥을 제공하지 않으며, 재현 스크립트의 시각척도·관측점 계약을 함께 봐야 함 |
| `iana-tzdb-2026b` | A | IANA Time Zone Database / ICU 78.3 | 역사적 UTC offset, DST, UTC instant | 진태양시·균시차 미지원 |
| `chen-twelve-stages-2021` | C | C. Chen, *Chinese Medicine* 2021, DOI 10.4236/cm.2021.123007 | 12운성 120표, 지장간 표 | 학파별 표기·순서 차이 가능 |
| `bazichic-reference-2017` | C | BaZiChic reference tables, September 2017 pp.71-72 | 십성, 표준 천간·지지 관계 | 공식 천문기관 자료 아님; 정책 민감 관계 제외 |

## Evidence snapshots

- `src/lib/saju/golden/evidence/hko-calendar.json`: 55개 공식 연간 PDF URL·SHA-256과 70 fixture 최소 날짜 매핑. API key/원문 PDF는 저장하지 않는다.
- `src/lib/saju/golden/evidence/solar-terms-2024.json`: 2024년 10개 절입 시각과 원문 URL.
- `src/lib/saju/golden/evidence/iana-timezone.json`: 16개 현지 시각의 offset·UTC instant와 tzdb/ICU 버전.
- `artifacts/solar-term-audit/solar-term-engine-audit.json`: JPL DE440s 240건과 NAOJ 120건의 독립 reference snapshot. 현재 운월당 engine output은 expected로 사용하지 않는다.
- `artifacts/solar-term-audit/solar-term-engine-fix-validation.json`: production `astronomy-engine@2.1.19` 결과와 위 독립 reference의 비교, 경계·대운·성능 영향.

`astronomy-engine@2.1.19`는 현재 production 계산 구현이며 독립 expected 출처로 분류하지 않는다. 이 패키지의 결과는 위 JPL·NAOJ 자료와 비교되는 actual이다.

## Independent manse provider review

| 후보 | 판정 | 이유 |
|---|---|---|
| DateDB | PENDING | 공개 출력은 재현 가능하지만 알고리즘 버전·야자시·대운 정책·라이선스가 충분히 문서화되지 않음 |
| Mansaenyang | PENDING | 계산 버전·시간대·절입·대운 정책을 확인할 수 없음 |
| 8s8s calendar | REJECTED | 버전·정책·재현 계약·사용 조건을 확인할 수 없음 |

승인된 `approved-independent-manse` provider는 현재 **0개**다. 따라서 해당 provenance는 새로 발행하지 않는다.
