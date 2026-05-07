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
  [string]$TossSecretName = ""
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
  if ($TossSecretName.Trim()) {
    $secretPairs += "TOSS_SECRET_KEY=$($TossSecretName):latest"
  }
  $secretArg = $secretPairs -join ","

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
    --set-env-vars "^|^ALLOWED_ORIGINS=$AllowedOrigins|GEMINI_MODEL=$GeminiModel" `
    --set-secrets $secretArg

  Write-Host ""
  Write-Host "Deploy finished." -ForegroundColor Green
  Write-Host "Set frontend env to the Cloud Run URL + /api/report" -ForegroundColor Green
  Write-Host ""
}
finally {
  Pop-Location
}
