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
# P2: valida VITE_API_URL antes de build. Qué: evita bake localhost en prod. Por qué: Vite inyecta en build.
$FrontEnv = Join-Path $Root "Frontend\secop_frontend\.env"
if ($env:VITE_API_URL) {
  Write-Host "VITE_API_URL=$env:VITE_API_URL" -ForegroundColor Green
} elseif (Test-Path $FrontEnv) {
  Write-Host "Frontend .env encontrado" -ForegroundColor Green
} else {
  Write-Host "Aviso: sin VITE_API_URL ni Frontend .env — build usará http://127.0.0.1:8000/api (solo dev)" -ForegroundColor Yellow
}
Push-Location (Join-Path $Root "Frontend\secop_frontend")
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "build fallo" -ForegroundColor Red; exit 1 }
Pop-Location

Write-Host "`n[4/4] Docker compose (opcional)..." -ForegroundColor Cyan
Write-Host "Para levantar con Docker (reproducible): docker compose up --build" -ForegroundColor Yellow
Write-Host "Para nube: backend en Render (HTTPS TLS 1.3) + db en Render Postgres + frontend en Vercel - variables por entorno separadas" -ForegroundColor Yellow

Write-Host "`nDeploy listo - HTTPS lo da Render/Vercel con Let's Encrypt (TLS 1.3)" -ForegroundColor Green
