# General Signature Independent Golden FACT Matrix

## 목적과 비순환 원칙

이 문서는 `general-signature`의 deterministic FACT를 현재 엔진 결과와 독립된 자료로 검증하기 위한 운영 기준이다. `fixtures.ts`는 expected를 만들기 위해 `deterministicBasis`, `calcBazi`, `buildBirthCalculation`을 import하지 않는다. 현재 엔진은 `harness.ts`에서 actual을 얻을 때만 실행한다.

- `actual = currentEngine(input)` 값을 expected로 복사하지 않는다.
- expected의 각 필드는 독립 provenance를 가진다.
- provenance가 없거나 `unverified`인 값은 golden PASS에 포함하지 않는다.
- `pending` fixture는 실행 성공 여부와 무관하게 PASS가 아니다.
- mismatch는 엔진 자동 수정 권한이 아니다. 원자료와 정책을 재검토한 후 별도 승인한다.

## Matrix 상태

| category | 계획 수 | 현재 verified | 현재 partial | 현재 pending |
| --- | ---: | ---: | ---: | ---: |
| solar-general | 40 | 1 | 0 | 39 |
| lunar-regular | 20 | 0 | 1 | 19 |
| lunar-leap | 10 | 0 | 1 | 9 |
| solar-term-boundary | 20 | 0 | 0 | 20 |
| day-boundary | 16 | 0 | 0 | 16 |
| time-uncertainty | 8 | 0 | 0 | 8 |
| timezone-solar-time | 16 | 0 | 0 | 16 |
| dayun-boundary | 10 | 0 | 0 | 10 |
| **TOTAL** | **140** | **1** | **2** | **137** |

정확한 140개 ID와 입력은 `src/lib/saju/golden/fixtures.ts`가 단일 목록이다. 테스트는 총수, category별 수, ID 중복, verified provenance를 모두 검사한다.

## Provenance types

| sourceType | 의미 | verified 사용 조건 |
| --- | --- | --- |
| `KASI` | 한국천문연구원/공공데이터포털의 음양력 또는 특일 자료 | 실제 응답 값, 요청 조건, 확인일이 기록된 경우 |
| `approved-independent-manse` | 서비스가 승인한 외부 만세력 결과 | 도구명·버전·정책·원본 결과 보존 |
| `independent-standard-table` | 현재 엔진과 별도인 구현·표준표·공개 계산 자료 | 규칙/표 출처와 적용 정책이 명시된 경우 |
| `expert-review` | 자격과 검수일이 기록된 명리 전문가 검수 | FACT/학파 정책을 구분하고 2인 검수 정책을 충족한 경우 |
| `unverified` | 출처 대기 또는 참고값 | PASS 금지 |

## FACT source map

| FACT | 1차 독립 근거 | 보조 근거 | 현재 판정 원칙 |
| --- | --- | --- | --- |
| 양력→음력 | KASI 음양력 정보 `getLunCalInfo` | 독립 달력 대조표 | KASI 원응답 확보 시 verified 가능 |
| 음력→양력 | KASI 음양력 정보 `getSolCalInfo` | 독립 달력 대조표 | 윤달 플래그를 함께 대조 |
| 윤달 여부 | KASI `lunLeapmonth` | 독립 달력 대조표 | 같은 월 숫자의 평달/윤달을 별도 fixture로 관리 |
| 년간지 | KASI `lunSecha` | 승인 독립 만세력 | 입춘 경계 fixture는 분 단위 근거 추가 필요 |
| 월간지 | KASI `lunWolgeon` | 승인 독립 만세력 + 절입 시각 | 절입 직전/후는 분 단위 독립 자료 전까지 pending |
| 일진/일주 | KASI `lunIljin` | 승인 독립 만세력 | 야자시 정책은 일반 일진과 분리해 검증 |
| 절기 날짜 | KASI 특일 `get24DivisionsInfo` | KASI 월력요항/HKO | KASI 특일은 날짜 검증이며 분 단위 대체가 아님 |
| 분 단위 절입 | HKO/HM Nautical Almanac/USNO 또는 승인 ephemeris | KASI 날짜 교차검증 | 원자료 시각·시간대 변환 확인 전 pending |
| 시주 | 독립 시진·오서둔 표 | 승인 독립 만세력 | 일간, 시간대, 진태양시, 자시 정책을 함께 기록 |
| 오행 | 독립 천간·지지 오행 mapping | 기둥 expected | 기둥이 독립 verified인 fixture에서만 파생 검증 |
| 십성 | 독립 일간×대상 천간 표 | 전문가 검수 | 지장간 기준/겉글자 기준을 분리 |
| 지장간 | 승인 표준표 | 전문가 검수 | 본기·중기·여기 순서 정책을 기록 |
| 합충형파해 | 승인 관계표 | 전문가 검수 | FACT 존재와 해석 우선순위를 분리 |
| 12운성 | 승인 독립 golden table | 전문가 검수 | 일간 음양별 순·역 정책을 기록 |
| 대운 방향 | 승인 성별×년간 음양 정책 | 독립 만세력 | 정책 버전 없는 값은 pending |
| 대운 startsAt | 독립 절입 거리 계산/승인 만세력 | 전문가 정책 승인 | 3일=1년 등 환산 정책과 시각을 함께 기록 |
| 용신·희기 | **140 FACT matrix에서 제외** | 전문가 2인 검수 dataset | 별도 interpretation policy로 관리 |

### 공식 참고 자료

- KASI 음양력 정보: https://www.data.go.kr/data/15012679/openapi.do
- KASI 특일 정보: https://www.data.go.kr/data/15012690/openapi.do
- KASI 달력 자료의 공식성 설명: https://www.kasi.re.kr/kor/publication/post/notice/385
- HKO 24절기 시각: https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm
- HKO 24절기 정의와 황경: https://www.hko.gov.hk/en/gts/time/24solarterms.htm

## 대표 fixture: 1992-09-09 10:24

입력은 남성, 양력 `1992-09-09 10:24`, `Asia/Seoul`, 진태양시 보정 비활성, 민간시 자정 경계다.

| field | expected | provenance |
| --- | --- | --- |
| normalizedSolarDate | 1992-09-09 | KASI live smoke |
| leapMonth | false | KASI 응답 `평` |
| yearPillar | 임신 | KASI `lunSecha` |
| monthPillar | 기유 | KASI `lunWolgeon` |
| dayPillar | 무자 | KASI `lunIljin` + 독립 계산 자료 |
| hourPillar | 정사 | 독립 시진표 2곳 교차 확인 |
| dayMaster | 무 | 독립 무자 일주 자료 |

KASI live smoke 기록은 `docs/KASI_LOCAL_LIVE_VERIFICATION.md`에 있다. 독립 교차자료는 다음과 같다.

- https://datedb.net/tool/saju-worksheet/19920909/
- https://www.mansaenyang.com/saju/1992-09-09
- https://calendar.8s8s.net/ganzhichaxun.php?d=9&m=9&y=1992

외부 독립 구현은 정책 차이가 있을 수 있으므로 경계 fixture에서는 단일 사이트 결과만으로 verified 처리하지 않는다.

## Boundary 설계 주의

2024년 월 절입 pair의 입력 시각은 HKO 공개 astronomical time을 HKT에서 KST로 변환한 검수 후보값이다. 각 pair는 `-1분/+1분`으로 설계했지만 `boundaryReference.status`는 `pending-independent-confirmation`이다. 원본 연감의 해당 minor solar term 시각과 KST 변환을 다시 확인하기 전 expected 기둥을 입력하지 않는다.

자시 fixture는 `civil-midnight`와 `late-zi-next-day`를 별도 정책으로 유지한다. 둘의 결과 차이는 버그로 단정하지 않고 정책 차이로 보고한다.

해외 fixture는 IANA timezone 이름뿐 아니라 실제 출생 instant에 적용된 `utcOffsetMinutes`를 기록한다. DST 중복 시간은 같은 현지 시각이라도 offset을 달리한 두 fixture로 분리한다.

## Harness 출력과 mismatch 처리

`evaluateGoldenMatrix()`는 다음을 별도로 집계한다.

- `TOTAL`, `VERIFIED`, `PARTIAL`, `PENDING`
- 비교한 fixture와 fixture match/mismatch
- field 단위 FACT match/mismatch
- provenance warning
- category별 total/status/comparison 통계

mismatch 보고에는 fixture의 provenance에서 `EXPECTED_SOURCE`, actual field에서 `CURRENT_ENGINE_RESULT`, 비교 항목의 `DIFFERING_FIELD`, input의 `lateZiPolicy`/`trueSolarTimePolicy`, provenance의 `confidence`를 함께 사용한다. mismatch가 발견되어도 FACT 엔진은 이 단계에서 수정하지 않는다.

## Expert review 분리

용신·희기·신강신약의 최종 전문가 합의는 이 140건의 객관 FACT expected에 섞지 않는다. `expertReview.ts`와 `GENERAL_SIGNATURE_EXPERT_REVIEW_TEMPLATE.csv`는 향후 50건×전문가 2인 검수를 위한 빈 계약만 제공하며 답을 생성하지 않는다.
