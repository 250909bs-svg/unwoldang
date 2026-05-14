# Unwoldang Launch Payment Checklist

## 1. Production Flow

- Checkout provider: PortOne KG Inicis
- Frontend callback: `/payment/portone/callback`
- Cloud Run payment verification: `/api/payments/portone/confirm`
- Report generation: `/api/report`
- Production admin: disabled on the public client until a server-authenticated admin API is connected

## 2. PortOne Console Values

In PortOne Admin Console, prepare these values:

- Store ID: `store-...`
- Channel Key for KG Inicis: `channel-key-...`
- V2 API Secret: server-side only

The V2 API Secret must never be added to Vercel frontend environment variables.

## 3. Cloud Run Secrets

Store the PortOne API Secret in Secret Manager:

```powershell
gcloud secrets create PORTONE_API_SECRET --data-file="C:\path\to\portone-api-secret.txt"
```

Create a separate random report access signing secret. This is what blocks unpaid direct calls to the report API:

```powershell
gcloud secrets create REPORT_ACCESS_SECRET --data-file="C:\path\to\report-access-secret.txt"
```

If the secret already exists, add a new version:

```powershell
gcloud secrets versions add PORTONE_API_SECRET --data-file="C:\path\to\portone-api-secret.txt"
gcloud secrets versions add REPORT_ACCESS_SECRET --data-file="C:\path\to\report-access-secret.txt"
```

Grant Cloud Run access:

```powershell
$projectNumber = (gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)").Trim()
gcloud secrets add-iam-policy-binding PORTONE_API_SECRET `
  --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding REPORT_ACCESS_SECRET `
  --member="serviceAccount:$projectNumber-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

Deploy Cloud Run:

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

## 4. Vercel Frontend Env

```env
VITE_PAYMENT_MODE=live
VITE_PORTONE_STORE_ID=store-your-portone-store-id
VITE_PORTONE_CHANNEL_KEY=channel-key-for-kg-inicis
VITE_PORTONE_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/portone/confirm
VITE_PORTONE_DEFAULT_PHONE_NUMBER=01000000000
VITE_PORTONE_DEFAULT_EMAIL=customer@unwoldang.com
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
VITE_REPORT_TIMEOUT_MS=70000
VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/auth/kakao/exchange
VITE_ENABLE_CLIENT_ADMIN=false
```

## 5. Final Test

- Real domain does not run with `VITE_PAYMENT_MODE=demo`
- KG Inicis payment window opens from checkout
- Payment cancel/fail returns to checkout
- Payment success calls Cloud Run verification before report loading
- Direct `/api/report` calls without a `reportAccessToken` return 401
- Cloud Run rejects wrong amount, wrong payment ID, or non-`PAID` status
- `/admin` is not usable on the public domain
- Report and payment pages are `no-store`
