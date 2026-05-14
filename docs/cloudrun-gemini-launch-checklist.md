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

- [geminiReportService.ts](C:/Users/1/Documents/unwoldang/src/lib/server/geminiReportService.ts)
- [index.ts](C:/Users/1/Documents/unwoldang/cloudrun-api/src/index.ts)
- [deploy-cloudrun.ps1](C:/Users/1/Documents/unwoldang/cloudrun-api/deploy-cloudrun.ps1)

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

## 8. 지금 남은 유일한 실질 blocker

이 PC에는 아직 `gcloud`가 설치되어 있지 않음

즉, 코드와 배포 스크립트는 준비됐고, 실제 Cloud Run 배포는 `gcloud 설치 + 로그인` 후 바로 진행 가능
> Launch note: Vercel `/api/report` is disabled. Gemini report generation must go through Cloud Run and requires a paid `reportAccessToken`.
