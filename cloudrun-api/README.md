# Unwoldang Cloud Run API

운월당의 Gemini 사주 분석 백엔드입니다.

## 제공 경로

- `GET /health`
- `POST /api/report`
- `POST /report`

## 로컬 빌드

프로젝트 루트에서 아래 순서로 실행합니다.

```powershell
cd C:\Users\1\Documents\unwoldang\cloudrun-api
copy .env.example .env
npm.cmd run build
npm.cmd run start
```

## 요청 예시

```json
{
  "serviceId": "general-signature",
  "payload": {
    "user": {
      "name": "차민호",
      "gender": "male"
    },
    "birth": {
      "calendar": "solar",
      "isLeapMonth": false,
      "date": "1992-09-09",
      "time": "10:24",
      "isUnknownTime": false
    },
    "questions": [
      "지금 가장 조심해야 할 선택은 무엇인가요?",
      "2026년에 커리어를 어떻게 확장하는 게 좋을까요?"
    ]
  }
}
```

## Cloud Run 배포

리포지토리 루트에서 Dockerfile을 지정해 빌드합니다.

```powershell
gcloud builds submit --tag asia-northeast3-docker.pkg.dev/YOUR_PROJECT/unwoldang/unwoldang-cloudrun -f cloudrun-api/Dockerfile .
gcloud run deploy unwoldang-report-api `
  --image asia-northeast3-docker.pkg.dev/YOUR_PROJECT/unwoldang/unwoldang-cloudrun `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars ALLOWED_ORIGINS=https://unwoldang.com,https://www.unwoldang.com,GEMINI_MODEL=gemini-2.5-flash `
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,KASI_SERVICE_KEY=KASI_SERVICE_KEY:latest,TOSS_SECRET_KEY=TOSS_SECRET_KEY:latest
```

프론트 환경변수는 아래처럼 맞추면 됩니다.

```env
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
VITE_TOSSPAYMENTS_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/toss/confirm
```

## KASI calendar verification

Set `KASI_SERVICE_KEY` on Cloud Run to enable Korea Astronomy and Space Science Institute
calendar verification. The backend uses it only as a helper for lunar/solar conversion and
solar-term cross-checks. Four-pillar, dayun, ten-god, and interpretation calculations remain
inside the Unwoldang saju engine.

If `KASI_SERVICE_KEY` is missing or the public API is unavailable, report generation still
continues with the internal deterministic calendar engine.

```powershell
gcloud secrets create KASI_SERVICE_KEY --data-file="C:\path\to\kasi-key.txt"

.\cloudrun-api\deploy-cloudrun.ps1 `
  -ProjectId YOUR_PROJECT `
  -KasiSecretName KASI_SERVICE_KEY
```

## Toss Payments confirmation

The frontend opens the Toss Payments checkout with the public client key, but the final
approval must be confirmed on the server with the secret key. Store `TOSS_SECRET_KEY`
in Secret Manager and pass it to the deploy script.

```powershell
gcloud secrets create TOSS_SECRET_KEY --data-file="C:\path\to\toss-secret-key.txt"

.\cloudrun-api\deploy-cloudrun.ps1 `
  -ProjectId YOUR_PROJECT `
  -KasiSecretName KASI_SERVICE_KEY `
  -TossSecretName TOSS_SECRET_KEY
```
