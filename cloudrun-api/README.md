# Unwoldang Cloud Run API

Cloud Run provides deterministic and Gemini-enhanced report generation, Kakao login exchange, server-signed PortOne orders, payment verification, entitlement recovery, report archives, and the admin report API.

## Routes

- `GET /health`
- `POST /api/report` (`POST /report` remains a compatibility alias)
- `POST /api/payments/portone/order`
- `POST /api/payments/portone/confirm`
- `GET /api/payments/portone/entitlements`
- `POST /api/payments/portone/entitlement/renew`
- `POST /api/auth/kakao/exchange`
- `GET /api/archive/reports`
- `POST /api/archive/reports`
- `POST /api/admin/login`
- `GET /api/admin/reports`

Payment and user archive routes require the Kakao-issued user bearer token. Report generation requires a payment-bound report bearer token in production. Archive writes also require the corresponding report token unless `REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=false`; production must keep this check enabled. Admin report reads require the admin bearer token returned by `/api/admin/login`.

## Environment

Use `cloudrun-api/.env.example` as the complete reference. Do not put server values in Vercel frontend environment variables.

Core production values:

```env
ALLOWED_ORIGINS=https://unwoldang.com,https://www.unwoldang.com
REPORT_ACCESS_SECRET=...
USER_ACCESS_SECRET=...
ADMIN_ACCESS_SECRET=...
REPORT_ACCESS_TOKEN_TTL_MS=1800000
PAYMENT_ORDER_CLAIM_TTL_MS=7200000
REPORT_GENERATION_LOCK_TTL_MS=120000
REPORT_RATE_LIMIT_WINDOW_MS=60000
REPORT_RATE_LIMIT_MAX=12
ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS=900000
ADMIN_LOGIN_RATE_LIMIT_MAX=5
ENABLE_FIRESTORE_ARCHIVE=true
FIRESTORE_PROJECT_ID=your-gcp-project-id
FIRESTORE_DATABASE_ID=(default)
PORTONE_PAYMENT_LEDGER_COLLECTION=portonePaymentConfirmations
FIRESTORE_ARCHIVE_COLLECTION=reportArchives
REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=true
```

Payment values:

```env
PORTONE_API_SECRET=...
PORTONE_STORE_ID=store-...
PORTONE_API_BASE_URL=https://api.portone.io
```

Kakao and admin values are required only when those routes are used:

```env
KAKAO_REST_API_KEY=...
KAKAO_CLIENT_SECRET=...
AUTH_ACCESS_TOKEN_TTL_MS=2592000000
ADMIN_CREDENTIAL_HASH=sha256_of_adminId_colon_password
ADMIN_ACCESS_TOKEN_TTL_MS=43200000
```

Gemini and KASI are optional enhancements. With no Gemini key, or when Gemini fails, the API returns the deterministic report. With no KASI key, the internal calendar engine remains active.

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_REQUEST_TIMEOUT_MS=22000
KASI_SERVICE_KEY=...
KASI_REQUEST_TIMEOUT_MS=5000
```

Store `PORTONE_API_SECRET`, the three access-token secrets, `ADMIN_CREDENTIAL_HASH`, `GEMINI_API_KEY`, `KASI_SERVICE_KEY`, and an enabled Kakao client secret in Secret Manager. The report, user, and admin signing secrets must be different high-entropy values. Route-specific production operations fail closed when their required secret or Firestore dependency is missing.

`ALLOW_UNVERIFIED_REPORTS=true` and `FIRESTORE_ACCESS_TOKEN` are local-development escape hatches only. Never enable or set them on Cloud Run.

## Deploy

Create the referenced Secret Manager secrets before deploying. Gemini, KASI, Kakao client-secret mode, and the admin API can be omitted by passing an empty value for their secret-name parameters. `ADMIN_ACCESS_SECRET` has a production-oriented default, so explicitly pass `-AdminAccessSecretName ""` together with `-AdminCredentialHashSecretName ""` when disabling the admin API.

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

For a deterministic-only new deployment, omit `-GeminiSecretName`. The script no longer sends admin credential material as a command-line environment value; it only maps the named Secret Manager secret.

Firestore must already exist in Native mode. The Cloud Run service account needs document read/write access to both `portonePaymentConfirmations` and `reportArchives` (or their configured collection names), plus Secret Manager access to every named secret.

## Frontend Env

```env
VITE_REPORT_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/report
VITE_REPORT_ARCHIVE_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/archive/reports
VITE_PORTONE_CONFIRM_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/payments/portone/confirm
VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/auth/kakao/exchange
VITE_ADMIN_LOGIN_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/admin/login
VITE_ADMIN_REPORTS_ENDPOINT=https://YOUR_CLOUD_RUN_URL/api/admin/reports
```

The frontend derives `/order`, `/entitlements`, and `/entitlement/renew` from `VITE_PORTONE_CONFIRM_ENDPOINT`, so separate endpoint variables are not required.

## Payment and Report Idempotency

1. An authenticated frontend calls `/api/payments/portone/order` with a product ID. The server chooses the catalog price and returns `orderId`, `amount`, and a signed, user-bound `orderClaim`.
2. The frontend opens PortOne with that `orderId`, product ID, and `orderClaim` in `customData`.
3. After payment, `/api/payments/portone/confirm` verifies the user, signed order claim, payment ID, product, catalog amount, `KRW`, `PAID` status, configured store ID, and transaction ID.
4. Firestore records one entitlement for the payment. An identical confirmation retry reuses that entitlement and returns a newly valid short-lived `reportAccessToken`; it does not create a second entitlement.
5. `/api/report` binds the report input hash to the entitlement and uses a Firestore lease to prevent concurrent duplicate generation. A completed Gemini-enhanced result is cached and returned for the same paid input. A different input on the same entitlement is rejected.
6. If Gemini is unavailable or rejected by the fact guard, the deterministic fallback is returned but is not marked as the completed cached AI result. The lease is released so a later retry can attempt enhancement again.

`GET /api/payments/portone/entitlements` lists a signed-in user's recoverable purchases. `POST /api/payments/portone/entitlement/renew` validates ownership and issues a fresh short-lived report token without charging again.

## Health Readiness

`GET /health` separates three signals:

- `readyForAiEnhancement`: Gemini key is configured.
- `readyForReportGeneration`: report signing and Firestore are configured; deterministic generation remains available.
- `readyForPaymentConfirmation`: report/user signing, Firestore, and PortOne verification are configured.
