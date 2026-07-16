# Unwoldang Launch Payment Checklist

## 1. Production Flow

1. Kakao exchange returns a signed user bearer token.
2. Checkout calls `POST /api/payments/portone/order` with that bearer token. Cloud Run selects the server catalog price and returns `orderId` and a signed `orderClaim`.
3. The browser opens PortOne KG Inicis with the returned order data and puts `productId` plus `orderClaim` in `customData`.
4. The payment callback calls `POST /api/payments/portone/confirm` with the same user bearer token.
5. Cloud Run verifies PortOne and atomically creates or reuses the user's Firestore entitlement.
6. The browser calls `POST /api/report` with the short-lived `reportAccessToken`.
7. A signed-in user can list or renew unused entitlements and can save/read their report archive.

Public endpoints:

- Frontend callback: `/payment/portone/callback`
- Server order intent: `/api/payments/portone/order`
- Payment confirmation: `/api/payments/portone/confirm`
- Entitlement list: `/api/payments/portone/entitlements`
- Entitlement token renewal: `/api/payments/portone/entitlement/renew`
- Report generation: `/api/report`
- User report archive: `/api/archive/reports`
- Admin login/reports: `/api/admin/login`, `/api/admin/reports`

## 2. PortOne Console Values

Prepare:

- Store ID: `store-...`
- KG Inicis channel key: `channel-key-...`
- PortOne V2 API Secret: server-side Secret Manager only

The API Secret and access-signing values must never be added to Vercel frontend variables.

## 3. Secret Manager

Prepare local files containing placeholder-replaced values, then create the secrets used by your deployment:

```powershell
gcloud secrets create PORTONE_API_SECRET --data-file="C:\path\to\portone-api-secret.txt"
gcloud secrets create REPORT_ACCESS_SECRET --data-file="C:\path\to\report-access-secret.txt"
gcloud secrets create USER_ACCESS_SECRET --data-file="C:\path\to\user-access-secret.txt"
gcloud secrets create ADMIN_ACCESS_SECRET --data-file="C:\path\to\admin-access-secret.txt"
gcloud secrets create ADMIN_CREDENTIAL_HASH --data-file="C:\path\to\admin-credential-hash.txt"
```

`REPORT_ACCESS_SECRET`, `USER_ACCESS_SECRET`, and `ADMIN_ACCESS_SECRET` must be three different high-entropy values. `ADMIN_CREDENTIAL_HASH` contains only the SHA-256 digest of `adminId:password`, prepared offline.

Optional enhancement/integration secrets:

```powershell
gcloud secrets create GEMINI_API_KEY --data-file="C:\path\to\gemini-api-key.txt"
gcloud secrets create KASI_SERVICE_KEY --data-file="C:\path\to\kasi-service-key.txt"
gcloud secrets create KAKAO_CLIENT_SECRET --data-file="C:\path\to\kakao-client-secret.txt"
```

If a secret already exists, use `gcloud secrets versions add SECRET_NAME --data-file="..."` instead.

Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on every named secret. Keep the service account identifier explicit; do not assume that every project uses the default Compute Engine service account.

## 4. Firestore

- Create Firestore in Native mode before launch.
- Give the Cloud Run runtime service account document read/write permission.
- Keep `ENABLE_FIRESTORE_ARCHIVE=true`.
- Keep `REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=true`.
- Default collections are `portonePaymentConfirmations` and `reportArchives`.
- Payment confirmation fails closed when the entitlement ledger is unavailable.

## 5. Deploy Cloud Run

```powershell
.\cloudrun-api\deploy-cloudrun.ps1 `
  -ProjectId YOUR_PROJECT_ID `
  -Region asia-northeast3 `
  -GeminiSecretName GEMINI_API_KEY `
  -KasiSecretName KASI_SERVICE_KEY `
  -PortOneSecretName PORTONE_API_SECRET `
  -PortOneStoreId store-your-portone-store-id `
  -ReportAccessSecretName REPORT_ACCESS_SECRET `
  -UserAccessSecretName USER_ACCESS_SECRET `
  -AdminAccessSecretName ADMIN_ACCESS_SECRET `
  -AdminCredentialHashSecretName ADMIN_CREDENTIAL_HASH `
  -KakaoRestApiKey YOUR_KAKAO_REST_API_KEY `
  -KakaoClientSecretName KAKAO_CLIENT_SECRET
```

Gemini and KASI are optional. Omit their secret-name arguments for a deterministic/internal-calendar deployment. To keep the admin API unavailable, explicitly pass `-AdminAccessSecretName "" -AdminCredentialHashSecretName ""` because the admin signing-secret parameter otherwise has a production-oriented default.

## 6. Vercel Frontend Env

```env
VITE_PAYMENT_MODE=live
VITE_PORTONE_STORE_ID=store-your-portone-store-id
VITE_PORTONE_CHANNEL_KEY=channel-key-for-kg-inicis
VITE_PORTONE_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/portone/confirm
VITE_PORTONE_DEFAULT_PHONE_NUMBER=01000000000
VITE_PORTONE_DEFAULT_EMAIL=customer@unwoldang.com
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
VITE_REPORT_ARCHIVE_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/archive/reports
VITE_REPORT_TIMEOUT_MS=70000
VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/auth/kakao/exchange
VITE_ADMIN_LOGIN_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/admin/login
VITE_ADMIN_REPORTS_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/admin/reports
VITE_ENABLE_CLIENT_ADMIN=false
```

The client derives PortOne `/order`, `/entitlements`, and `/entitlement/renew` URLs from `VITE_PORTONE_CONFIRM_ENDPOINT`.

## 7. Final Tests

- `GET /health` reports payment/report readiness separately from Gemini enhancement readiness.
- The live domain never runs with `VITE_PAYMENT_MODE=demo`.
- Checkout obtains a server order and embeds its signed `orderClaim` before opening PortOne.
- Cancel/fail returns safely to checkout.
- Success verifies payment before report loading.
- Confirm rejects a missing/foreign user token, forged order claim, wrong amount/product/store/payment ID, and a non-`PAID` status.
- A duplicate confirmation creates no second entitlement and returns a usable short-lived report token.
- A concurrent duplicate report request returns a retryable in-progress response; a completed enhanced result is reused for the identical input.
- A Gemini outage returns the deterministic fallback and leaves the enhancement attempt retryable.
- Direct production `/api/report` calls without a valid payment-bound token return 401.
- Entitlement list/renew works only for the signed-in owner and does not charge again.
- User archives require user auth; archive writes also require the report token.
- Admin login fails closed when its credential-hash secret is absent.
- Report and payment pages are `no-store`.
- Submit `https://unwoldang.com/sitemap.xml` to Google Search Console and Naver Search Advisor.
