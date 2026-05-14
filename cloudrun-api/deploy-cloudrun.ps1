param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "asia-northeast3",
  [string]$Repository = "unwoldang",
  [string]$ServiceName = "unwoldang-report-api",
  [string]$ImageName = "unwoldang-cloudrun",
  [string]$AllowedOrigins = "https://unwoldang.com,https://www.unwoldang.com",
  [string]$GeminiModel = "gemini-2.5-flash",
  [string]$KasiSecretName = "",
  [string]$PortOneSecretName = "",
  [string]$PortOneStoreId = "",
  [string]$PortOneApiBaseUrl = "https://api.portone.io",
  [string]$KakaoRestApiKey = "",
  [string]$KakaoClientSecretName = ""
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

  $secretPairs = @("GEMINI_API_KEY=GEMINI_API_KEY:latest")
  if ($KasiSecretName.Trim()) {
    $secretPairs += "KASI_SERVICE_KEY=$($KasiSecretName):latest"
  }
  if ($PortOneSecretName.Trim()) {
    $secretPairs += "PORTONE_API_SECRET=$($PortOneSecretName):latest"
  }
  if ($KakaoClientSecretName.Trim()) {
    $secretPairs += "KAKAO_CLIENT_SECRET=$($KakaoClientSecretName):latest"
  }
  $secretArg = $secretPairs -join ","
  $envVars = "ALLOWED_ORIGINS=$AllowedOrigins|GEMINI_MODEL=$GeminiModel|PORTONE_API_BASE_URL=$PortOneApiBaseUrl"
  if ($PortOneStoreId.Trim()) {
    $envVars = "$envVars|PORTONE_STORE_ID=$PortOneStoreId"
  }
  if ($KakaoRestApiKey.Trim()) {
    $envVars = "$envVars|KAKAO_REST_API_KEY=$KakaoRestApiKey"
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
  gcloud run deploy $ServiceName `
    --image $image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars "^|^$envVars" `
    --set-secrets $secretArg

  Write-Host ""
  Write-Host "Deploy finished." -ForegroundColor Green
  Write-Host "Set frontend env to the Cloud Run URL + /api/report" -ForegroundColor Green
  Write-Host ""
}
finally {
  Pop-Location
}
