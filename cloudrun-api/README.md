# Unwoldang Cloud Run API

Cloud Run handles Gemini report generation, Kakao token exchange, and PortOne KG Inicis payment verification.

## Routes

- `GET /health`
- `POST /api/report`
- `POST /report`
- `POST /api/auth/kakao/exchange`
- `POST /api/payments/portone/confirm`

## Required Server Env

```env
ALLOWED_ORIGINS=https://unwoldang.com,https://www.unwoldang.com,https://unwoldang.vercel.app
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
KAKAO_REST_API_KEY=...
KAKAO_CLIENT_SECRET=...
PORTONE_API_SECRET=...
PORTONE_STORE_ID=store-...
PORTONE_API_BASE_URL=https://api.portone.io
REPORT_ACCESS_SECRET=...
REPORT_ACCESS_TOKEN_TTL_MS=1800000
REPORT_RATE_LIMIT_WINDOW_MS=60000
REPORT_RATE_LIMIT_MAX=12
```

`PORTONE_API_SECRET`, `GEMINI_API_KEY`, `REPORT_ACCESS_SECRET`, `KASI_SERVICE_KEY`, and `KAKAO_CLIENT_SECRET` should be stored in Secret Manager, not in frontend env.

## Deploy

```powershell
.\cloudrun-api\deploy-cloudrun.ps1 `
  -ProjectId YOUR_PROJECT_ID `
  -Region asia-northeast3 `
  -KasiSecretName KASI_SERVICE_KEY `
  -PortOneSecretName PORTONE_API_SECRET `
  -PortOneStoreId store-your-portone-store-id `
  -ReportAccessSecretName REPORT_ACCESS_SECRET `
  -KakaoRestApiKey YOUR_KAKAO_REST_API_KEY `
  -KakaoClientSecretName KAKAO_CLIENT_SECRET
```

## Frontend Env

```env
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
VITE_PORTONE_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/portone/confirm
VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/auth/kakao/exchange
```

## PortOne Verification

The frontend only opens the payment window. Cloud Run exchanges `PORTONE_API_SECRET` for a PortOne access token, reads the payment record, then checks:

- `paymentId === orderId`
- paid amount matches the order amount
- payment status is `PAID`
- store ID matches `PORTONE_STORE_ID` when configured

After a verified payment, Cloud Run returns a short-lived `reportAccessToken`. `/api/report` requires that signed token, so a direct unpaid Gemini report request is rejected before model cost is incurred.
