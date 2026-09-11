#!/bin/bash
# RNF-10: deploy reproducible — Qué: aplica migraciones antes de publicar. Por qué: no romper esquema en prod.
set -e
echo "== SECOP Insight — Deploy reproducible =="

ENV_FILE="Backend/secop_backend/secop_backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE — copia desde .env.example"
  cp Backend/secop_backend/secop_backend/.env.example "$ENV_FILE"
  echo "Edita $ENV_FILE con tus claves y vuelve a ejecutar"
  exit 1
fi

echo "[1/4] Backend migrate..."
(cd Backend/secop_backend/secop_backend && ../../venv/bin/python manage.py migrate --no-input || python manage.py migrate --no-input)

echo "[2/4] Backend check..."
(cd Backend/secop_backend/secop_backend && ../../venv/bin/python manage.py check || python manage.py check)

echo "[3/4] Frontend build..."
(cd Frontend/secop_frontend && npm run build)

echo "[4/4] Docker compose (opcional)..."
echo "Para levantar con Docker: docker compose up --build"
echo "Para nube: backend en Render (HTTPS TLS 1.3) + db en Render Postgres + frontend en Vercel — variables por entorno separadas"

echo "Deploy listo — HTTPS lo da Render/Vercel con Let's Encrypt (TLS 1.3)"
