param(
  [string]$EnvFile = ""
)

$Root = $PSScriptRoot
if (-not $Root) { $Root = Get-Location }
if (-not $EnvFile) { $EnvFile = Join-Path $Root "Backend\secop_backend\secop_backend\.env" }
$EnvExample = Join-Path $Root "Backend\secop_backend\secop_backend\.env.example"

Write-Host "== SECOP Insight - Deploy reproducible ==" -ForegroundColor Green

if (-not (Test-Path $EnvFile)) {
  Write-Host "Falta $EnvFile - copia desde .env.example" -ForegroundColor Red
  Copy-Item $EnvExample $EnvFile
  Write-Host "Edita $EnvFile con tus claves y vuelve a ejecutar" -ForegroundColor Yellow
  exit 1
}

Write-Host "`n[1/4] Backend migrate..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "Backend\secop_backend\secop_backend")
& "..\venv\Scripts\python.exe" manage.py migrate --no-input
if ($LASTEXITCODE -ne 0) { Write-Host "migrate fallo" -ForegroundColor Red; exit 1 }
Pop-Location

Write-Host "`n[2/4] Backend check..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "Backend\secop_backend\secop_backend")
& "..\venv\Scripts\python.exe" manage.py check
Pop-Location

Write-Host "`n[3/4] Frontend build..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "Frontend\secop_frontend")
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "build fallo" -ForegroundColor Red; exit 1 }
Pop-Location

Write-Host "`n[4/4] Docker compose (opcional)..." -ForegroundColor Cyan
Write-Host "Para levantar con Docker (reproducible): docker compose up --build" -ForegroundColor Yellow
Write-Host "Para nube: backend en Render (HTTPS TLS 1.3) + db en Render Postgres + frontend en Vercel - variables por entorno separadas" -ForegroundColor Yellow

Write-Host "`nDeploy listo - HTTPS lo da Render/Vercel con Let's Encrypt (TLS 1.3)" -ForegroundColor Green
