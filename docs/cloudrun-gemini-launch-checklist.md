# 운월당 Cloud Run + Gemini 출시 체크리스트

## 1. 로컬 화면 확인

- 프론트 화면 확인 주소: `http://127.0.0.1:4174/`
- 현재 프리뷰 서버는 정적 화면만 담당
- 실제 Gemini 응답은 Cloud Run API가 필요

## 2. 현재 준비 완료

- 프론트 결과 UI 준비 완료
- 결정론적 사주 계산 basis 준비 완료
- Gemini draft merge 로직 준비 완료
- Vercel `api/report.ts` is disabled with 410. Cloud Run owns report generation.
- Cloud Run 백엔드 폴더 준비 완료

관련 파일:

- [geminiReportService.ts](../src/lib/server/geminiReportService.ts)
- [index.ts](../cloudrun-api/src/index.ts)
- [deploy-cloudrun.ps1](../cloudrun-api/deploy-cloudrun.ps1)

## 3. 출시 전 반드시 필요한 것

### Google Cloud

- Google Cloud 프로젝트 준비
- Vertex AI API 활성화
- Cloud Run Admin API 활성화
- Cloud Build API 활성화
- Artifact Registry API 활성화
- `GEMINI_API_KEY` 또는 Vertex 기반 인증 준비

### 로컬 도구

- `gcloud` CLI 설치
- `gcloud auth login`
- `gcloud config set project YOUR_PROJECT_ID`

## 4. Secret 준비

Cloud Run에서는 아래 secret 이름을 기준으로 잡아두면 됩니다.

- `GEMINI_API_KEY`

예시:

```powershell
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic
gcloud secrets versions add GEMINI_API_KEY --data-file=gemini-key.txt
```

## 5. 배포

```powershell
cd C:\Users\1\Documents\unwoldang\cloudrun-api
.\deploy-cloudrun.ps1 -ProjectId YOUR_PROJECT_ID
```

## 6. 프론트 연결

Cloud Run URL이 나오면 프론트 환경변수에 아래처럼 넣습니다.

```env
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
VITE_REPORT_TIMEOUT_MS=70000
```

## 7. 최종 테스트 순서

1. 홈에서 종합사주 진입
2. 사주 정보 입력
3. 결제 전 단계 진입
4. 로딩에서 `/api/report` 호출 확인
5. 결과 페이지에 실제 Gemini 문장 반영 확인
6. 마이페이지 다시보기 확인

## 7-1. 배포 직후 확인 — 순서대로

### (1) 새 리비전이 실제로 떠 있는가

`GET /health` 한 건으로 확인한다. 이 네 필드가 배포 지문이다:

```
promptVersion    : 소스의 PREMIUM_SAJU_PROMPT_VERSION 과 같아야 한다
reportMode       : premium_saju_comprehensive_v4
proseMode        : { "love-reunion": "authored", "default": "strict-echo" }
proseTemperature : { "love-reunion": 0.75, "default": 0 }
```

롤백(ADR §6)을 실행했을 때 그것이 배포됐는지 확인하는 지점도 여기다 —
`proseMode['love-reunion']` 이 `strict-echo` 로 바뀌어야 한다.

### (2) 로그 4종

Cloud Logging 에서 아래를 본다. 첫 줄만 **구조화 JSON**이고 나머지는 자유 문자열이다.

| 로그 | 언제 | 무엇을 본다 |
|---|---|---|
| `jsonPayload.event = "gemini_draft_review"` | **모든** draft 처리 (거부 0건 포함) | `accepted` · `rejected` · `rejectionsByReason` · `droppedInSanitize` |
| `jsonPayload.event = "gemini_draft_all_rejected"` | 전 필드 거부 → 결정론 착지 | 이 경로가 얼마나 도는가 |
| `jsonPayload.event = "gemini_merged_rejected"` | 병합 후 검사가 계열을 되돌림 | `note` 의 되돌린 계열과 위반 문구 |
| `Gemini report draft failed:` | 호출 자체 실패 | 타임아웃·5xx 발생률 |

### (3) 로그 기반 지표와 알람

`gemini_draft_review` 의 `jsonPayload.accepted` / `jsonPayload.rejected` 로 로그 기반
지표를 만든다. **분모(`accepted`)가 있어야 비율 알람이 성립한다** — 자유 문자열 warn 만
보면 "거부가 늘었다" 와 "트래픽이 늘었다" 가 구분되지 않는다.

판단 기준:
- 거부율이 오르면 프롬프트를 고치기 전에 **`rejectionsByReason` 의 키**를 본다.
  키가 어느 단계가 막고 있는지 바로 가리킨다
  (`missing-citation` = 인용 규칙 전달 실패 / `unknown-entity` · `misattributed-claim`
  = 사실 환각 / `banned-phrase` = 안전 규격 / `base-mismatch` = 상품 분기 오류).
- `base-mismatch` 가 재회운에서 대량으로 보이면 **코드와 프롬프트가 갈라진 것**이다
  (ADR §6-2 의 "두 곳을 반드시 같이" 를 한쪽만 실행한 상태).
- 거부율이 높지만 사유가 형식 계열(`missing-citation`·`malformed-citation`)이면
  프롬프트 수정보다 온도를 0.75 → 0.5 로 내려 보는 쪽이 싸다.
- `droppedInSanitize` 가 0 이 아니면 길이 상한을 넘겨 사라진 필드가 있다는 뜻이다.
  이 필드는 검증 계층에 도달하지 못하므로 `rejectionsByReason` 에 잡히지 않는다.

**로그에 고객 문장과 개인정보는 들어가지 않는다.** 경로·사유 코드·개수·리포트 일련번호만
싣는다. 이 원칙을 깨면 리포트 본문이 로그 보존 기간 동안 평문으로 남는다.

## 8. 지금 남은 유일한 실질 blocker

이 PC에는 아직 `gcloud`가 설치되어 있지 않음

즉, 코드와 배포 스크립트는 준비됐고, 실제 Cloud Run 배포는 `gcloud 설치 + 로그인` 후 바로 진행 가능
> Launch note: Vercel `/api/report` is disabled. Gemini report generation must go through Cloud Run and requires a paid `reportAccessToken`.
