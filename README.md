# SECOP Insight — Observatorio y SaaS Freemium SECOP II

> **Inteligencia de negocios sobre 5.98M de contratos electrónicos | Django + PostgreSQL local + React | V3 — Freemium (Público + Privado) + 85 columnas + Profiler Dual + Matchmaking**
> Grupo 8 — ADSO 3171062 — Steven Alejandro Araque Castro | Yesid Amaya — Instructor Gustavo Jiménez Suancha — CIMM — Septiembre 2026 — Sogamoso

## Qué es

**SECOP Insight V3** es un **SaaS Freemium 2 en 1** que demuestra el stack Django + PostgreSQL + React manejando **6M de contratos (85 columnas)** sin congelar el navegador.

- **Público (Observatorio):** cualquier ciudadano filtra 500k contratos por departamento/modalidad/fecha y ve KPIs, mapa y grafo en <300ms. El patrón es **agregar en BD y enviar <50KB** al front, nunca 6M filas (anti-patrón 100MB).
- **Privado (SaaS B2B):** el contratista crea **Radares** (filtros guardados sobre 85 columnas elegibles) y recibe **Oportunidades** automáticas en su bandeja privada + email. El motor **ETL + Matchmaking** cruza contratos nuevos contra radares sin intervención.

**Objetivo General (Guía 4 GFPI-F-135 V04)** — Construir la estructura de datos y la interfaz bajo arquitectura *decoupled*, demostrando el stack completo con manejo masivo real y lógica de negocio.

**Pitch 45s (V3):** *“En lo público filtro 500k y el profiler marca Naive 8s en rojo vs Optimizado 280ms en verde — 29× más rápido. En lo privado creo un Radar ‘pavimento Boyacá’ y al correr el ETL me cae un Match automático con email. Así demuestro Big Data y SaaS con el mismo stack.”*

## Qué hace

- **Público:** KPIs + filtros elegibles (85 cols) + DataTable masivo 60 FPS (TanStack Table + virtual 44px, solo 50 nodos en DOM) + exportar CSV con BOM + Profiler Dual 4 barras (BD|Python|Red|Render) + toggle Usuario/Ingeniería.
- **Público visual:** Mapa coroplético % directa (clic filtra todo) + grafo entidad→contratista + Banderas rojas (concentración >30%, directa >80%) con umbrales configurables sin reinicio.
- **Privado SaaS:** `POST /api/radares/` con `filtros_extras` JSON para 85 cols (ej. `{"ciudad":"Sogamoso","modalidad":"Licitación pública"}`) + `GET /api/mis-oportunidades/` bandeja con estados Nueva/Guardada/Postulado + filtros `?estado=` + email automático vía `send_mail` (console en dev, SMTP Gmail real en prod).
- **Plataforma:** Auth JWT (registro, login, logout, recuperar 30min) + páginas `/`, `/login`, `/app` con `AuthGuard` + panel admin + ETL SODA 2.1 con matchmaking + backup 7 días.

## Stack Tecnológico (V3 definitivo)

- **Backend:** Django 6.1 (target 5.0.14) + DRF 3.18 + SimpleJWT 5.5.1 + `drf-spectacular` (OpenAPI 3.0.3)
- **Base de datos:** PostgreSQL 16 local (pgAdmin, localhost:5432) — *local permite 6M completos sin techo 500MB; 85 columnas completas; índices B-tree + JSON para Radares*
- **Frontend:** React 19.2.8 + Vite 8.2 + Tailwind 3.4.17 + TanStack Query (cache 5min) + TanStack Table 8.21 + TanStack Virtual 3.14 (60 FPS) + Recharts 3.10 + Leaflet 1.9 + `react-force-graph` + `motion` + `sonner`
- **Manejo masivo:** Agregación en BD (50KB), paginación `page_size 20-50`, virtualización (solo visibles), `keepPreviousData` sin recarga
- **Control:** Git + GitHub (`main` al día, tag `v1.1-profiler`, PR #1 mergeado)
- **Gestión:** Notion (5 Sprints, 56 requisitos 399 pts) + `EstructuraSesion_v2.xlsx` (5 sesiones × 6h) + `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V3.1 Freemium + `SECOP_Backlog_Producto.xlsx` (56 historias)

## Estado

Metodología **Scrum** + **Guía 4: Proceso A (Desarrollo) + Proceso B (Transferencia)**. **56 requisitos (49 base + 7 Freemium RF-36..42) + RNF-04/07/08/09/10/11/12** completados y verificados (`manage.py check` 0 issues, `npm run build` 37KB CSS OK, `pytest 5` + `vitest 3` = 8 passing). **BD 18/09: 4972 contratos + 5 Radares activos + 3 Oportunidades Nuevas + email SMTP real a stevenldssaac@gmail.com** (console en dev, Gmail `pgtmswbagycceopx` en prod). Evidencia en `CONTEXT.md:4`, errores en `ERRORES.md`. Word V3.1 único sin réplicas.

## Módulos (detalle en `CONTEXT.md:4`)

| Módulo | Qué hace |
|---|---|
| Auth API | Registro, login, logout JWT + recuperar 30min un solo uso |
| Login front | `/login` con AuthGuard, redirect sin token, Salir con blacklist |
| ETL 2 fases | `cargar_secop` SODA paginado `$limit=50k/$offset/$order=:id` + `bulk_create 1000` + **Fase 2 Matchmaking** (cruza `filtros_extras` 85 cols → `Oportunidad` Nueva) + validación RNF-04 |
| Radares SaaS | `GET/POST /api/radares/` + `PUT/DELETE /api/radares/<id>/` con `filtros_extras` JSON (85 cols elegibles), validación `rango_min <= max`, `IsAuthenticated` + ownership |
| Bandeja privada | `GET /api/mis-oportunidades/?estado=Nueva` (bandeja) + `PATCH` a Guardada/Postulado + email `send_mail` best-effort (10 por carga) |
| API agregada | Resumen, top, serie mensual, mapa, búsqueda y stats por entidad en BD (naive vs optimized con `tiempo_bd_ms`) |
| Profiler Dual | 4 barras `BD|Python|TTFB|Render` + toggle Usuario/Ingeniería + comparativa `naive 8s rojo` vs `optimizado 280ms verde` (29×) |
| Dashboard público | KPIs + DataTable masivo (TanStack Table + virtual 60 FPS, sorting por cabecera, solo 50 visibles) + exportar CSV BOM |
| Mapa | Coroplético % directa, clic filtra, limpia con VER TODO |
| Alertas | Banderas concentración (>30%) + predominio directa (>80%) + umbrales persistentes |
| Entidades & Grafo | Lista con buscador + stats por entidad + red entidad→contratista (grosor monto, color modalidad) |
| Panel admin | Contratos (85 cols), Entidades, Cargas, Radares, Oportunidades, Umbrales, Backups, Auditoría |
| Auditoría | Quién hizo qué y cuándo (login, exportar, cargas, radares, oportunidades, backups, umbrales) |
| Ops & Docs | Backup 7 días, deploy Docker `postgres:16`+`python:3.12`, Tailwind 3.4, a11y teclado, `browserslistrc` + Swagger `/api/docs/` 34 endpoints |

## Estructura de carpetas

```
Big data/
├── Backend/secop_backend/
│   ├── Dockerfile            # RNF-10: python:3.12-slim + migrate --no-input + gunicorn
│   ├── requirements.txt      # Django 6.1 + DRF + SimpleJWT + drf-spectacular + gunicorn + python-dotenv + psycopg2
│   ├── secop_backend/        # proyecto Django (settings.py con env, urls.py con /api/docs/, wsgi.py)
│   │   ├── contratos/        # Contrato 85 cols* + Entidad + TrabajoCarga + Radar(filtros_extras JSON) + Oportunidad + Umbral + Config + Backup + Auditoria (migrations 0001-0011), services.py, exceptions.py (503), management/commands/cargar_secop.py (2 fases)
│   │   ├── users/            # Registro/Login/Logout + TokenRecuperacion 30min
│   │   └── manage.py
│   └── venv/                 # venv Python 3.14.5 (no versionado)
├── Frontend/secop_frontend/  # Vite + React + Tailwind (App.jsx con AuthGuard, main.jsx QueryClient, pages: Dashboard, ProfilerDual, DataTableSECOP, Login, MapaDirecta, Buscador, Banderas, Umbrales, ActualizacionMasiva, Entidades, Grafo, Solicitar/Restablecer, Dockerfile, nginx.conf)
├── docker-compose.yml        # RNF-10: db (postgres:16) + backend + frontend reproducibles
├── deploy.ps1 / deploy.sh    # RNF-10: migrate + check + build en orden
├── SECOP_Backlog_Producto.xlsx (56 historias: 42 base + 7 frontend + 7 Freemium RF-36..42, estandarizado)
├── SECOP_Backlog_Producto.csv (56 filas, formato Notion 16 cols, Hecho/Steven Araque, único)
├── SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx V3.1 Freemium (13 secciones, 85 cols, único)
└── README.md / CONTEXT.md / ERRORES.md
```
* Contrato persiste 15 cols en MVP analítico + Radar.filtros_extras JSON permite filtrar por cualquiera de las 85 sin migración por cada columna; escalar a 85 cols físicas es añadir campos + migrate.

## Cómo levantar el proyecto en otro computador (desde cero) — RNF-10 Deploy Reproducible

**Requisitos previos:** `Git`, `Python 3.14`, `PostgreSQL 16 + pgAdmin`, `Node.js 20+`, `Docker` (opcional) y `VS Code` con `.vscode/settings.json`.

> **RNF-10:** Orden obligatorio: `migrate` antes de publicar (C3), variables por entorno en `.env` (C4), HTTPS en nube (C1) via Render/Vercel con TLS 1.3. Ver `docker-compose.yml` + `Dockerfile` + `deploy.ps1`.

1. **Clonar y entrar:**
   ```bash
   git clone https://github.com/stevenaraque/Secop-big-Data.git
   cd Secop-big-Data/Big\ data
   ```

2. **Backend — crear entorno e instalar:**
   ```bash
   cd Backend/secop_backend
   python -m venv venv
   venv\Scripts\activate          # Windows
   pip install -r requirements.txt
   ```

3. **Base de datos — crear BD vacía en pgAdmin/psql:**
   ```sql
   CREATE DATABASE secop_db;
   ```

4. **Variables de entorno — copiar plantilla y editar:**
   ```bash
   copy secop_backend\.env.example secop_backend\.env
   # edita secop_backend\.env:
   # DB_NAME=secop_db
   # DB_USER=postgres
   # DB_PASSWORD=tu_clave
   # SECRET_KEY=<generado con get_random_secret_key>
   # EMAIL_HOST_USER=tu@gmail.com
   # EMAIL_HOST_PASSWORD=tu_app_password_sin_espacios
   ```

5. **Migraciones — crear tablas + índices + Radares — ANTES de publicar (RNF-10 C3):**
   ```bash
   cd secop_backend
   python manage.py migrate --no-input
   # Applying contratos.0001... 0011 OK (0011_radar_filtros_extras)
   python manage.py createsuperuser  # para /admin
   ```

6. **Probar que todo quedó:**
   ```bash
   python manage.py shell
   >>> from contratos.models import Contrato, Radar
   >>> Contrato.objects.count()  # 0 recién clonado
   >>> Radar.objects.count()     # 0
   ```

7. **Frontend — instalar y correr:**
   ```bash
   cd ..\..\Frontend\secop_frontend
   npm install
   npm run dev   # http://localhost:5173
   # Backend: http://127.0.0.1:8000/admin  y  http://127.0.0.1:8000/api/docs/
   ```

8. **Verificación final:** Abre `http://localhost:5173/login`, registra un contratista, crea un Radar con `filtros_extras` y verifica `http://127.0.0.1:8000/api/mis-oportunidades/` tras un ETL.
   > Sin sesión, `/` muestra lo público + CTA; `/app` redirige a `/login`. Admin usa cookies, dashboard JWT en `Authorization: Bearer`.

9. **Deploy reproducible (RNF-10 C2) — Docker o Nube:**
   ```bash
   docker compose up --build
   # Backend: http://localhost:8000 + Frontend: http://localhost:5173 + DB: localhost:5432
   .\deploy.ps1   # hace migrate + check + build
   ```
   **Nube HTTPS (RNF-10 C1):** Backend Render + DB Render Postgres + Frontend Vercel (TLS 1.3). Variables por entorno en dashboard, nunca hardcodear (RNF-10 C4).

> **Nota:** No subas tu `.env` real. Si `migrate` falla con `relation does not exist`, revisa que `secop_db` existe y `.env` apunta a `localhost:5432`. En prod `DEBUG=False`.

## Arquitectura V3 — Freemium Decoupled + Flujo ETL 2 fases

```
[datos.gov.co SODA jbjy-vk9h 5.98M 85 cols] --$limit=50k & $order=:id + X-App-Token--> [Django Thread bulk_create 1000] --> [PostgreSQL 85 cols indexadas + Radar JSON]
                                                                                         |  matchmaking ILIKE + rango 85 cols
[React público filtros] --GET /api/optimized/resumen?depto=Boyaca--> [Django DRF] --JSON 50KB--> [React Recharts/Mapa/DataTable Virtual + Profiler 4 barras]
[React privado /app] --GET /api/mis-oportunidades/?estado=Nueva--> [Django IsAuthenticated] --JSON paginado--> [React bandeja + email SMTP]
```

**Regla de oro V3:** `migrate` crea tablas + Radar/Oportunidad → `cargar_secop` llena contratos → Fase 2 crea oportunidades → `/api/mis-oportunidades` las sirve privadas. Sin `migrate` falla `relation does not exist`; sin ETL responde 0; sin Radar no hay matches.

## Roadmap — Qué sigue (V3 Freemium)

- **Sprint 2 / Sesión 2:** ETL 2 fases + `ProcessingJob` 202 + polling 1s + dual `/optimized/*` vs `/naive/*` + timing `tiempo_bd_ms`
- **Sprint 3 / Sesión 3:** Dashboard + filtros 85 elegibles + `filtros_extras` JSON + `serie-mensual` + mapa Leaflet + búsqueda + cache TanStack Query + Tailwind
- **Sprint 4 / Sesión 4:** Grafo + **Profiler Dual 4 barras + toggle** + banderas + Radares SaaS + bandeja privada + email SMTP
- **Sprint 5 / Buffer — 18/09 DONE:** 56 historias + 85 cols + 5 Radares + 3 Oportunidades + DataTable 60 FPS + Swagger + tests 8 passing + `v1.1-profiler` + Word V3.1 único. Pendiente: video 3min pitch 45s + `EstructuraSesion` V3 + reflexión 3.1

## ETL y Paginación SODA 2.1 (V3)

Paginación obligatoria SODA: `?$limit=50000&$offset=50000&$order=:id&$where=departamento='Boyaca'` — 120 requests para 5.98M. Con `X-App-Token` 10k req/h. Índices `idx_contrato_depto` + `idx_radar_usuario` pasan de segundos a ms. **Filtros elegibles:** `Radar.filtros_extras = {"ciudad":"Sogamoso","modalidad":"Licitación pública"}` → matchmaking hace `WHERE ciudad ILIKE '%Sogamoso%'` en BD, no en cliente. Escalar a 85 cols es añadir campo a `Contrato` + `migrate`.

## Procedimiento de Restauración — RNF-09 (7 días retención)

**Backup:** `POST /api/cargar/backup/` (solo admin) crea `backups/secop_backup_YYYYMMDD_HHMMSS.json` (100k cap) + `backup_registro` y purga >7 días. Listar: `GET /api/cargar/backup/listar/` — Descargar: `GET /api/cargar/backup/<id>/descargar/` — Admin: `/admin/contratos/backupregistro/`.
**Restauración manual (sin pg_dump):**
```powershell
cd Backend/secop_backend/secop_backend
python manage.py shell
>>> import json, pathlib
>>> from contratos.models import Contrato
>>> data = json.loads(pathlib.Path("backups/secop_backup_20260911_162107.json").read_text(encoding="utf-8"))
>>> objs = [Contrato(id_contrato=r["id_contrato"], nombre_entidad=r["nombre_entidad"], departamento=r["departamento"], valor_contrato=r["valor_contrato"], fecha_firma=r["fecha_firma"] or None, modalidad=r["modalidad"], contratista_nit=r["contratista_nit"], contratista_nombre=r["contratista_nombre"], orden="", sector="", estado_contrato="", codigo_categoria_principal="", descripcion_del_proceso="") for r in data]
>>> Contrato.objects.bulk_create(objs, batch_size=1000, ignore_conflicts=True)
```
**Restauración pg_dump (prod):** `pg_dump -h localhost -U postgres -d secop_db -Fc > secop.dump` y `pg_restore -d secop_db secop.dump`. Documentado en `CONTEXT.md:8` y `ERRORES.md:27`.
**Servicio no disponible:** si PostgreSQL caído, `secop_exception_handler` responde `503 {"detalle":"Servicio no disponible..."}` sin traceback. Frontend muestra ese detalle.

## Dónde seguir (la evidencia vive aquí, no arriba)

- **`CONTEXT.md`** — memoria viva: decisiones, estado 56 historias, verificación requisito por requisito, clave buenas prácticas, revisión Guía 4.
- **`ERRORES.md`** — 31 errores con causa y solución.
- **Fuentes y artefactos V3.1 Freemium**
  - Dataset: https://www.datos.gov.co/resource/jbjy-vk9h.json (SECOP II, 5.98M, 85 cols, 2.72M vistas)
  - SODA 2.1 paginación: https://support.socrata.com (Tyler Tech, 2025 — $limit 50k + $offset)
  - Guía SENA GFPI-F-135 V04 — Fase Desarrollo — ADSO 3171062
  - Planificación: `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V3.1 Freemium (13 secciones, 85 cols, único)
  - Backlogs: `SECOP_Backlog_Producto.xlsx` (56 historias, estandarizado) + `SECOP_Backlog_Producto.csv` (56 filas, Hecho/Steven Araque, único)
  - Buenas prácticas: `Informe_Stack_Django_React (1).pdf` (57 págs) — ver `CONTEXT.md:8`

---
*Última actualización: 18/09/2026 — V3.1 Freemium definitivo: 56 historias + 85 cols elegibles + 5 Radares + 3 Oportunidades + email SMTP real + Profiler 4 barras + DataTable 60 FPS + Tailwind 37KB + 6M sin estallar front — Autor: Steven Alejandro Araque Castro*
