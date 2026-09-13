# General Signature Independent Golden FACT Audit

## Release gate summary

- TOTAL: 140
- VERIFIED: 0
- PARTIAL: 106
- PENDING: 34
- CONFLICTING: 0
- VERIFIED FACT FIELDS: 286
- MATCHED EXPOSED FACT FIELDS: 140
- MISMATCHED EXPOSED FACT FIELDS: 36
- UNEXPLAINED MISMATCHES: 0
- CURRENT ENGINE USED AS EXPECTED: no
- GOLDEN FACT RELEASE GATE: **NO-GO**

`NO-GO`는 검증 실패를 숨기지 않은 결과다. fixture 전체 140건의 모든 목표 필드가 독립 검증된 상태가 아니며, 공식 절기 시각과 current 계산 사이의 분 단위 차이가 확인됐다.

## Category breakdown

| category | total | verified | partial | pending | conflicting |
|---|---:|---:|---:|---:|---:|
| 일반 양력 | 40 | 0 | 40 | 0 | 0 |
| 음력 평달 | 20 | 0 | 20 | 0 | 0 |
| 음력 윤달 | 10 | 0 | 10 | 0 | 0 |
| 입춘·월 절입 | 20 | 0 | 20 | 0 | 0 |
| 자시·날짜 경계 | 16 | 0 | 0 | 16 | 0 |
| 시간 미상·범위 | 8 | 0 | 0 | 8 | 0 |
| 해외 시간대·DST·진태양시 | 16 | 0 | 16 | 0 | 0 |
| 대운 방향·startsAt | 10 | 0 | 0 | 10 | 0 |

## Confirmed findings

### ENGINE_BUG_CONFIRMED — 2024 절입 instant

NAOJ 공식 분 단위 값과 current `getSolarTermInstantForGregorianYear`를 같은 UTC instant로 비교했다. 입추는 분 단위 일치했으나 나머지 9개 절기는 1~7분 차이가 났다. 한로 두 fixture는 fixture 자체 경계도 잘못되어 별도 conflict로 분류했다. 엔진은 이번 감사에서 수정하지 않았다.

| 절기 | 공식 KST | current KST(분 반올림) | 차이 |
|---|---|---|---:|
| 입춘 | 2024-02-04 17:27 | 17:21 | -6분 |
| 경칩 | 2024-03-05 11:23 | 11:16 | -7분 |
| 청명 | 2024-04-04 16:02 | 15:56 | -6분 |
| 입하 | 2024-05-05 09:10 | 09:04 | -6분 |
| 망종 | 2024-06-05 13:10 | 13:06 | -4분 |
| 소서 | 2024-07-06 23:20 | 23:19 | -1분 |
| 입추 | 2024-08-07 09:09 | 09:09 | 0분 |
| 백로 | 2024-09-07 12:11 | 12:10 | -1분 |
| 한로 | 2024-10-08 04:00 | 03:57 | -3분 |
| 입동 | 2024-11-07 07:20 | 07:17 | -3분 |

16개 non-conflicting before/after fixture에서 절기 instant와 상대 분 차이 두 필드씩, 총 32개 mismatch가 발생했다. 한로 2개 fixture의 같은 4개 mismatch는 fixture conflict 범주에 포함한다.

### EXPECTED_DATA_ERROR — corrected leap-month fixtures

- `lunar-leap-003`: 존재하지 않는 2017 윤5월 10일을 공식 윤6월 10일로 고쳤다. HKO 대응 양력은 2017-08-01이다.
- `lunar-leap-005`: 존재하지 않는 2012 윤3월 12일을 공식 윤4월 12일로 고쳤다. HKO 대응 양력은 2012-06-01이다.

fixture ID는 유지했고, HKO evidence를 다시 생성해 70/70 valid record를 확보했다.

### EXPECTED_DATA_ERROR — corrected Hanro alignment

`solar-term-017/018`의 기존 03:00 KST reference를 공식 NAOJ 04:00 KST로 고쳤다. 입력은 공식 경계 직전/직후인 03:59/04:01이며 source conflict는 해소됐다. 현 엔진 계산은 약 3분 빠르므로 engine mismatch는 그대로 남는다.

## Independent tables

- 12운성: 10천간 × 12지지 = 120/120 match.
- 십성: 10 일간 × 10 대상 천간 = 100/100 match.
- 지장간: 12/12 row 및 순서 match.
- 표준 관계: 천간합 5 + 천간충 4 + 육합 6 + 충 6 + 파 6 + 해 6 = 33/33 match.
- 형·원진·부분 삼합·합화 성립 강도는 정책 민감 항목으로 표준 FACT 결과에 합산하지 않는다.

## Evidence coverage and gaps

- HKO: 70개 fixture 조사, 70개 날짜 변환 evidence, invalid lunar input conflict 0개.
- IANA: 16/16 offset·DST·UTC instant match. 진태양시는 검증 범위 밖이다.
- NAOJ: 10개 2024 절입 시각 확보.
- KASI: 기존 실키 smoke 5건의 기록을 유지한다. Secret과 원문 전체 응답은 저장하지 않았다.
- 승인된 독립 만세력 provider: 0. 따라서 시주·자시 정책·대운 방향/startsAt 전면 검증은 pending이다.
- 대운 startsAt: 독립 절기 instant, 순역 정책, 일수 환산 방식이 모두 합의된 provider가 없어 10/10 pending이다.
- 시간 미상/범위: 하나의 시주를 expected로 만들지 않았으며 8/8 pending이다.

## Expert review package

`GENERAL_SIGNATURE_EXPERT_BLIND_REVIEW_50.csv`에 50개 분산 fixture를 준비했다. 엔진의 신강·용신·희기 결론은 노출하지 않았고 전문가 A/B 입력 칸은 모두 비어 있다. 전문가 A와 B가 서로의 답을 보지 않고 작성한 뒤 adjudication하도록 설계했다.

## Required next actions

1. `GENERAL_SIGNATURE_SOLAR_TERM_ENGINE_CORRECTION_AUDIT_2026-09-02.md`에서 재현한 절입 엔진 오류를 별도 승인 후 교체한다.
2. 야자시·월주·시주·대운 정책이 문서화된 독립 provider를 최소 1개 승인하고 중요 경계는 2개 출처 합의를 확보한다.
3. 50건 blind expert review를 완료하고 용신·희기 정책 버전을 확정한다.
