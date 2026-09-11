# RNF-10: deploy reproducible — Qué: imagen backend con migraciones antes de publicar. Por qué: evita romper esquema en prod.
FROM python:3.14-slim

WORKDIR /app

# deps sistema para psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY secop_backend/ ./secop_backend/
COPY .env.example ./secop_backend/.env.example

WORKDIR /app/secop_backend

# migraciones se aplican en runtime (ver docker-compose command) antes de gunicorn
EXPOSE 8000

CMD ["sh", "-c", "python secop_backend/manage.py migrate --no-input && python secop_backend/manage.py collectstatic --no-input 2>/dev/null || true && gunicorn secop_backend.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
