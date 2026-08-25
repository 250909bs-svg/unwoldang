param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "asia-northeast3",
  [string]$Repository = "unwoldang",
  [string]$ServiceName = "unwoldang-report-api",
  [string]$ImageName = "unwoldang-cloudrun",
  [string]$AllowedOrigins = "https://unwoldang.com,https://www.unwoldang.com",
  [string]$GeminiModel = "gemini-2.5-flash",
  [string]$GeminiSecretName = "",
  [string]$GeminiRequestTimeoutMs = "22000",
  [string]$KasiLunarSecretName = "",
  [string]$KasiSpecialDaySecretName = "",
  [string]$KasiSecretName = "",
  [string]$KasiRequestTimeoutMs = "5000",
  [string]$PortOneSecretName = "",
  [string]$PortOneStoreId = "",
  [string]$PortOneApiBaseUrl = "https://api.portone.io",
  [string]$PortOnePaymentLedgerCollection = "portonePaymentConfirmations",
  [string]$ReportAccessSecretName = "REPORT_ACCESS_SECRET",
  [string]$UserAccessSecretName = "USER_ACCESS_SECRET",
  [string]$AdminAccessSecretName = "ADMIN_ACCESS_SECRET",
  [string]$AdminCredentialHashSecretName = "",
  [string]$ReportAccessTokenTtlMs = "1800000",
  [string]$PaymentOrderClaimTtlMs = "7200000",
  [string]$ReportGenerationLockTtlMs = "120000",
  [string]$AuthAccessTokenTtlMs = "2592000000",
  [string]$AdminAccessTokenTtlMs = "43200000",
  [string]$ReportRateLimitWindowMs = "60000",
  [string]$ReportRateLimitMax = "12",
  [string]$KakaoRestApiKey = "",
  [string]$KakaoClientSecretName = "",
  [string]$EnableFirestoreArchive = "true",
  [string]$FirestoreProjectId = "",
  [string]$FirestoreDatabaseId = "(default)",
  [string]$FirestoreArchiveCollection = "reportArchives",
  [string]$RequireReportTokenForArchive = "true"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName"

Write-Host ""
Write-Host "=== Unwoldang Cloud Run Deploy ===" -ForegroundColor Cyan
Write-Host "Project : $ProjectId"
Write-Host "Region  : $Region"
  Write-Host "Service : $ServiceName"
  Write-Host "Image   : $image"
  Write-Host ""

  $secretPairs = @()
  if ($GeminiSecretName.Trim()) {
    $secretPairs += "GEMINI_API_KEY=$($GeminiSecretName):latest"
  }
  if ($KasiLunarSecretName.Trim()) {
    $secretPairs += "KASI_LUNAR_SERVICE_KEY=$($KasiLunarSecretName):latest"
  }
  if ($KasiSpecialDaySecretName.Trim()) {
    $secretPairs += "KASI_SPECIALDAY_SERVICE_KEY=$($KasiSpecialDaySecretName):latest"
  }
  if ($KasiSecretName.Trim()) {
    $secretPairs += "KASI_SERVICE_KEY=$($KasiSecretName):latest"
  }
  if ($PortOneSecretName.Trim()) {
    $secretPairs += "PORTONE_API_SECRET=$($PortOneSecretName):latest"
  }
  if ($ReportAccessSecretName.Trim()) {
    $secretPairs += "REPORT_ACCESS_SECRET=$($ReportAccessSecretName):latest"
  }
  if ($UserAccessSecretName.Trim()) {
    $secretPairs += "USER_ACCESS_SECRET=$($UserAccessSecretName):latest"
  }
  if ($AdminAccessSecretName.Trim()) {
    $secretPairs += "ADMIN_ACCESS_SECRET=$($AdminAccessSecretName):latest"
  }
  if ($AdminCredentialHashSecretName.Trim()) {
    $secretPairs += "ADMIN_CREDENTIAL_HASH=$($AdminCredentialHashSecretName):latest"
  }
  if ($KakaoClientSecretName.Trim()) {
    $secretPairs += "KAKAO_CLIENT_SECRET=$($KakaoClientSecretName):latest"
  }
  $secretArg = $secretPairs -join ","
  $envVars = "ALLOWED_ORIGINS=$AllowedOrigins|GEMINI_MODEL=$GeminiModel|GEMINI_REQUEST_TIMEOUT_MS=$GeminiRequestTimeoutMs|KASI_REQUEST_TIMEOUT_MS=$KasiRequestTimeoutMs|PORTONE_API_BASE_URL=$PortOneApiBaseUrl|PORTONE_PAYMENT_LEDGER_COLLECTION=$PortOnePaymentLedgerCollection|REPORT_ACCESS_TOKEN_TTL_MS=$ReportAccessTokenTtlMs|PAYMENT_ORDER_CLAIM_TTL_MS=$PaymentOrderClaimTtlMs|REPORT_GENERATION_LOCK_TTL_MS=$ReportGenerationLockTtlMs|AUTH_ACCESS_TOKEN_TTL_MS=$AuthAccessTokenTtlMs|ADMIN_ACCESS_TOKEN_TTL_MS=$AdminAccessTokenTtlMs|REPORT_RATE_LIMIT_WINDOW_MS=$ReportRateLimitWindowMs|REPORT_RATE_LIMIT_MAX=$ReportRateLimitMax|ENABLE_FIRESTORE_ARCHIVE=$EnableFirestoreArchive|FIRESTORE_DATABASE_ID=$FirestoreDatabaseId|FIRESTORE_ARCHIVE_COLLECTION=$FirestoreArchiveCollection|REQUIRE_REPORT_TOKEN_FOR_ARCHIVE=$RequireReportTokenForArchive"
  if ($PortOneStoreId.Trim()) {
    $envVars = "$envVars|PORTONE_STORE_ID=$PortOneStoreId"
  }
  if ($KakaoRestApiKey.Trim()) {
    $envVars = "$envVars|KAKAO_REST_API_KEY=$KakaoRestApiKey"
  }
  if ($FirestoreProjectId.Trim()) {
    $envVars = "$envVars|FIRESTORE_PROJECT_ID=$FirestoreProjectId"
  }
Push-Location $root
try {
  Write-Host "1) Artifact Registry repository check/create..." -ForegroundColor Yellow
  gcloud artifacts repositories describe $Repository --location $Region | Out-Null 2>$null
  if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $Repository `
      --repository-format=docker `
      --location=$Region `
      --description="Unwoldang Cloud Run images"
  }

  Write-Host "2) Build & push image..." -ForegroundColor Yellow
  gcloud builds submit --config cloudrun-api/cloudbuild.yaml .

  Write-Host "3) Deploy Cloud Run service..." -ForegroundColor Yellow
  $deployArgs = @(
    "run", "deploy", $ServiceName,
    "--image", $image,
    "--region", $Region,
    "--platform", "managed",
    "--allow-unauthenticated",
    "--set-env-vars", "^|^$envVars"
  )
  if ($secretArg) {
    $deployArgs += @("--set-secrets", $secretArg)
  }
  & gcloud @deployArgs
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud run deploy failed with exit code $LASTEXITCODE"
  }

  Write-Host ""
  Write-Host "Deploy finished." -ForegroundColor Green
  Write-Host "Set frontend report, payment-confirm, Kakao, archive, and admin endpoints to the Cloud Run URL." -ForegroundColor Green
  Write-Host ""
}
finally {
  Pop-Location
}
