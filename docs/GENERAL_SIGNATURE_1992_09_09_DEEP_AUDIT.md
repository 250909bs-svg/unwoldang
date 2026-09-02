# 1992-09-09 10:24 대표 명식 독립 FACT 감사

입력: 남성 · 양력 1992-09-09 · 10:24 · Asia/Seoul · 진태양시 미적용 · 민간 자정 경계

| 필드 | 독립 expected | current | source/tier | 판정 | confidence |
|---|---|---|---|---|---|
| 양력일 | 1992-09-09 | 1992-09-09 | KASI + HKO / A | MATCH | high |
| 음력일 | 1992-08-13 | current comparison contract 미노출 | KASI + HKO / A | EXPECTED VERIFIED, ACTUAL NOT EXPOSED | high |
| 윤달 | 평달 | current comparison contract 미노출 | KASI + HKO / A | EXPECTED VERIFIED, ACTUAL NOT EXPOSED | high |
| 연주 | 임신 | 임신 | KASI metadata / A | MATCH | high |
| 월주 | 기유 | 기유 | KASI metadata / A | MATCH | high |
| 일주 | 무자 | 무자 | KASI metadata / A | MATCH | high |
| 시주 | pending | 정사 | 승인된 시간 포함 독립 만세력 없음 | PENDING | unknown |
| 일간 | 무 | 무 | 검증된 무자 일주의 천간 정의 / C | MATCH | high |
| 대운 방향 | pending | current 값은 expected로 사용하지 않음 | 독립 정책/계산 미확보 | PENDING | unknown |
| 대운 startsAt | pending | current 값은 expected로 사용하지 않음 | 독립 절기 instant+환산 정책 미확보 | PENDING | unknown |

## 파생 표 감사

- 지장간 canonical table은 외부 Tier-C 표와 12/12 일치했다. 검증된 연·월·일 지지에 대해 `신=무·임·경`, `유=신`, `자=계`를 적용할 수 있다. 시지 `사`는 시주가 아직 pending이므로 대표 명식의 verified 파생값으로 승격하지 않는다.
- 십성 mapping은 외부 Tier-C 표와 100/100 일치했다. 검증된 천간 기준 `임=편재`, `기=겁재`, `무=비견`이다. 시간 천간의 십성은 시주 독립 검증 전 pending이다.
- 12운성 mapping은 외부 Tier-C 표와 120/120 일치했다. 무 일간의 검증된 지지 기준 `신=병`, `유=사`, `자=태`다. 시지 기반 값은 pending이다.
- 표준 관계 33쌍은 외부 Tier-C 표와 모두 일치했다. 대표 명식의 `자유파`는 표준 관계로 확인 가능하지만 삼합의 일부 성립·강도는 policy interpretation으로 분리한다.
- 8글자 전체 오행 분포, 시주 포함 십성·12운성, 대운은 시주/대운 expected 미확보 때문에 대표 fixture 전체 verified로 올리지 않는다.

## 결론

대표 fixture는 기존 scaffold의 `verified`에서 **partial**로 엄격화했다. 이는 current 결과가 틀렸다는 뜻이 아니라, 정사시와 대운까지 독립 provenance가 완성되지 않았기 때문이다.
