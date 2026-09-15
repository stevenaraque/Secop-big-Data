# SECOP Insight — Observatorio de Contratación Pública SECOP II

> Inteligencia de negocios sobre 5.98M de contratos electrónicos | Django + PostgreSQL local + React | **V2 — ETL + Migraciones + Profiler Dual**
> Grupo 8 — ADSO 3171062 — Steven Alejandro Araque Castro | Yesid Amaya — Instructor Gustavo Jiménez Suancha — CIMM — Agosto-Septiembre 2026

## Qué es
Observatorio ciudadano que ingiere contratos SECOP II desde `datos.gov.co` (dataset `jbjy-vk9h`, 5.98M filas x 85 cols), los agrega en base de datos y los expone en un dashboard React con KPIs, filtros, mapa coroplético, grafo de redes y banderas rojas, sin congelar el navegador. El patrón central es **agregar en BD y enviar solo <50KB** al frontend, no traer filas completas (anti-patrón de 100MB).

**Objetivo General (Guía 4 GFPI-F-135 V04)** — Construir la estructura de datos y la interfaz del software bajo arquitectura decoupled, demostrando el Stack completo en sesiones de explicación paso a paso.

**Pitch 45s (V2):** *“Filtro 500k contratos y el profiler marca Naive 8s en rojo vs Optimizado 280ms en verde — 29× más rápido — demostrando que Django agrega y React virtualiza, no mueven datos brutos.”*

## Qué hace
- KPIs + filtros (territorio, modalidad, fechas) + tabla virtualizada 60 FPS con exportar CSV.
- Mapa coroplético de % contratación directa (clic filtra todo) + grafo entidad→contratista.
- Banderas de concentración + predominio de directa, con umbrales configurables sin reinicio.
- Auth JWT (registro, login, logout, recuperar 30min) + página `/login` + panel admin.
- ETL SODA 2.1 con monitoreo, actualización periódica sin duplicados y backup 7 días.
- Detalle y verificación de cada requisito: `CONTEXT.md`.

## Stack Tecnológico (V2 actualizado)
- **Backend:** Django 6.1 instalado (doc target Django 5.0.14) + Django REST Framework 3.17.2
- **Base de datos:** PostgreSQL 18 local (pgAdmin, localhost:5432) — *V2: Supabase descartado por techo 500MB; local permite 5.98M completos (100 páginas SODA de 50k)*
- **Frontend:** React 19.2.8 + Vite 5.4.21 + TanStack Query + Recharts + Leaflet + @tanstack/react-virtual (60 FPS)
- **Control de versiones:** Git + GitHub
- **Gestión:** Notion (4 Sprints, 42 requisitos, 124 pts) + `EstructuraSesion_v2.xlsx` V2 (5 sesiones × 6h 6:00-11:30 = 30h, Día 1-5) + `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V2 + `SECOP_Backlog_Producto.xlsx` (Product Backlog + 42 Historias con criterios)

## Estado
Metodología **Scrum** + **Guía 4: Proceso A (Desarrollo) + Proceso B (Transferencia)**. 42 RF + RNF-04/07/08/09/10/11/12 completados y verificados (`manage.py check` 0 issues, `npm run build` OK). Evidencia por requisito en `CONTEXT.md:4`, errores con causa y solución en `ERRORES.md`. Pendientes en Roadmap.

## Módulos (una línea cada uno, detalle en `CONTEXT.md:4`)
| Módulo | Qué hace |
|---|---|
| Auth API | Registro, login, logout JWT + recuperar contraseña 30min un solo uso |
| Login front | Página `/login`, redirect sin token, botón Salir con blacklist de refresh |
| ETL | `cargar_secop` SODA 2.1 paginado + monitoreo + actualización periódica sin duplicados + validación de calidad |
| API agregada | Resumen, top, serie mensual, mapa, búsqueda y stats por entidad en BD (endpoints naive vs optimized) |
| Dashboard | KPIs + tabla virtualizada + exportar CSV con BOM |
| Mapa | Coroplético % directa, clic filtra, limpia con VER TODO |
| Alertas | Banderas de concentración + predominio de directa + umbrales persistentes |
| Entidades | Lista con buscador + estadísticas por entidad |
| Grafo | Red entidad→contratista (grosor por monto, color por modalidad) |
| Panel admin | Contratos, entidades, cargas, umbrales, backups, auditoría |
| Auditoría | Quién hizo qué y cuándo (login, exportar, cargas, backups, umbrales) |
| Ops | Backup 7 días, deploy Docker reproducible, accesibilidad teclado, compatibilidad navegadores |

## Estructura de carpetas
```
Big data/
├── Backend/secop_backend/
│   ├── Dockerfile            # RNF-10: python:3.14-slim + migrate --no-input + gunicorn
│   ├── requirements.txt      # Django 6.1 + DRF + SimpleJWT + gunicorn + python-dotenv
│   ├── secop_backend/        # proyecto Django (settings.py, urls.py, wsgi.py)
│   │   ├── contratos/        # Contrato 15 cols + Entidad + TrabajoCarga + UmbralAlerta + ConfigActualizacion + BackupRegistro + Auditoria (migrations 0001-0009), services.py, exceptions.py (503), management/commands/cargar_secop.py
│   │   ├── users/            # Registro/Login/Logout + TokenRecuperacion 30min (migrations 0001)
│   │   └── manage.py
│   └── venv/                 # entorno virtual (Python 3.14.5, Django 6.1, no versionado)
├── Frontend/secop_frontend/  # Vite + React (App.jsx, main.jsx, Dashboard, Login, MapaDirecta, Buscador, Banderas, PredominioDirecta, Umbrales, Entidades, Grafo, SolicitarRecuperacion, Restablecer, Dockerfile, nginx.conf, .browserslistrc)
├── docker-compose.yml        # RNF-10: db + backend + frontend reproducibles
├── deploy.ps1 / deploy.sh    # RNF-10: migrate + check + build en orden
├── SECOP_Backlog_Producto.xlsx (42 historias)
├── SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx V2
└── README.md / CONTEXT.md / ERRORES.md
```

## Cómo levantar el proyecto en otro computador (desde cero) — RNF-10 Deploy Reproducible

**Requisitos previos:** `Git`, `Python 3.14`, `PostgreSQL 18 + pgAdmin`, `Node.js 20+`, `Docker` (opcional) y `VS Code / Antigravity` con extensiones ya configuradas en `.vscode/settings.json`.

> **RNF-10:** despliegue reproducible y documentado. Orden obligatorio: `migrate` antes de publicar código (C3), variables por entorno en `.env` (C4), HTTPS en nube (C1) via Render/Vercel con Let's Encrypt TLS 1.3. Ver `docker-compose.yml` + `Dockerfile` + `deploy.ps1`/`deploy.sh`.

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
   # source venv/bin/activate     # Mac/Linux
   pip install -r requirements.txt
   ```

3. **Base de datos — crear BD vacía en pgAdmin/psql:**
   ```sql
   -- en pgAdmin Query Tool o psql
   CREATE DATABASE secop_db;
   -- verifica: \l debe listar secop_db
   ```

4. **Variables de entorno — copiar plantilla y editar:**
   ```bash
   copy secop_backend\.env.example secop_backend\.env
   # edita secop_backend\.env con tu clave local:
   # DB_NAME=secop_db
   # DB_USER=postgres
   # DB_PASSWORD=tu_clave_postgres
   # DB_HOST=localhost
   # DB_PORT=5432
   ```

5. **Migraciones — crear tablas + índices (RF-01, RF-25, RF-02) — ANTES de publicar (RNF-10 C3):**
   ```bash
   cd secop_backend
   python manage.py migrate --no-input
   # debe decir: Applying contratos.0001... OK hasta 0009 OK (0009_auditoria incluida)
   python manage.py createsuperuser  # para /admin
   # En prod (Render): el Dockerfile y docker-compose.yml ya hacen `migrate --no-input` antes de `gunicorn`
   ```

6. **Probar que todo quedó (opcional pero recomendado):**
   ```bash
   python manage.py shell
   >>> from contratos.models import Contrato
   >>> Contrato.objects.count()  # debe ser 0 recién clonado
   ```

7. **Frontend — instalar y correr:**
   ```bash
   cd ..\..\Frontend\secop_frontend
   npm install
   npm run dev   # abre http://localhost:5173
   # Backend corre en http://127.0.0.1:8000/admin
   ```

8. **Verificación final:** Abre `http://localhost:5173/login`, entra con tu usuario y verifica el dashboard. El admin está en `http://127.0.0.1:8000/admin` (ver `CONTEXT.md:4`).
   > Sin sesión, `/` redirige solo a `/login`. El admin usa cookies de sesión y el dashboard JWT en `localStorage`: son sesiones distintas.

9. **Deploy reproducible (RNF-10 C2) — Docker o Nube:**
   ```bash
   # Local reproducible con Docker (requiere Docker Desktop)
   docker compose up --build
   # Backend: http://localhost:8000 (migrate ya aplicado) + Frontend: http://localhost:5173 + DB: localhost:5432

   # O script local sin Docker:
   .\deploy.ps1        # Windows
   # ./deploy.sh       # Linux/Mac
   # Hace: migrate --no-input + check + npm run build
   ```
   **Nube HTTPS (RNF-10 C1):** Backend en **Render** (`gunicorn` + `migrate` en Dockerfile, `https://secop-backend.onrender.com` TLS 1.3), DB en **Render Postgres** (`dpg-xxx`), Frontend en **Vercel** (`https://secop-insight.vercel.app` TLS 1.3). Variables por entorno separadas: dev `.env` con `localhost`, prod con host de nube en Render/Vercel dashboard — nunca hardcodear (RNF-10 C4).

> **Nota:** No subas tu `.env` real. Solo `.env.example` está versionado. Si `migrate` falla con `relation does not exist`, revisa que tu `.env` apunta a `localhost:5432` y que `secop_db` existe en pgAdmin. En prod, `DEBUG=False` y `SECRET_KEY` distinto por entorno.

## Arquitectura V2 — Decoupled + Flujo migrate → ETL → API
```
[datos.gov.co SODA 2.1 jbjy-vk9h 5.98M] --$limit=50k & $offset + $order=:id + X-App-Token--> [Django Thread bulk_create 1000] --> [PostgreSQL local 15 cols indexadas]
[React filtros] --GET /api/optimized/resumen?depto=Boyaca--> [Django DRF] --JSON 50KB--> [React Recharts/Mapa/Tabla Virtual + Profiler 4 barras]
```
**Regla de oro V2:** `migrate` crea tabla vacía + índices → `cargar_secop` la llena (ETL Extract-Transform-Load) → `/api/resumen` la consulta. Sin `migrate` falla `relation does not exist`; sin ETL responde 0.

## Roadmap — Qué sigue (V2 + Backlog Notion)
- **Sesión 2 / Sprint 2:** ETL `cargar_secop` (SODA 2.1 `$limit=50k/$offset/$order=:id` + `X-App-Token` 10k req/h) + `ProcessingJob` Thread 202 Accepted + polling 1s + endpoints dual `/optimized/*` vs `/naive/*` + timing middleware
- **Sesión 3 / Sprint 3:** Dashboard React + filtros + `serie-mensual` (DATE_TRUNC) + mapa Leaflet coroplético + búsqueda tipo Google (debounce 300ms, abort) + cache TanStack Query
- **Sesión 4 / Sprint 4:** Grafo `react-force-graph` + **Profiler Dual 4 barras (BD | Python | TTFB | Render) + toggle Usuario/Ingeniería** + banderas rojas (NIT >30%, Directa >80%)
- **Sesión 5 / Buffer (Semana 5) — PENDIENTE 15/09:** suite mínima de pruebas (hoy cero: sin pytest/Jest) + ramas `feature/*` desde ahora + video 3 min + pitch 45s + tag `v1.0-sprint4` + Swagger `/api/docs/` + Notion al día + reflexión 3.1. Deploy local-first luego Render/Vercel. Ver `CONTEXT.md:9` (revisión Guía 4 con estado de evidencias).

## ETL y Paginación SODA 2.1 (V2)
No descargar 5.98M de golpe. SODA 2.1 exige paginación: `?$limit=50000&$offset=50000&$order=:id&$where=departamento='Boyaca'` — 100 requests para 5M. Con `X-App-Token` en `.env` pasas de 1k a 10k req/h. Índices `CREATE INDEX idx_contrato_depto ON contrato(departamento)` pasan agregaciones de segundos a ms.

## Procedimiento de Restauración — RNF-09 (7 días retención)
**Backup:** `POST /api/cargar/backup/` (solo admin `IsAdminUser`) crea `Backend/secop_backend/backups/secop_backup_YYYYMMDD_HHMMSS.json` con hasta 100k contratos (`id_contrato`, `nombre_entidad`, `valor_contrato`...), registra en `backup_registro` (`archivo`, `tamano_bytes`, `registros`, `creado_en`) y purga automáticamente los mayores a 7 días (`creado_en < now-7d` borra archivo + fila). Listar: `GET /api/cargar/backup/listar/` — Descargar: `GET /api/cargar/backup/<id>/descargar/` — Admin: `http://127.0.0.1:8000/admin/contratos/backupregistro/`. Verificación: `anon 401`, `normal 403`, `admin 201 7912B 18 regs`.
**Restauración manual (sin pg_dump):**
```powershell
cd Backend/secop_backend/secop_backend
python manage.py shell
>>> import json, pathlib
>>> from contratos.models import Contrato
>>> data = json.loads(pathlib.Path("backups/secop_backup_20260911_162107.json").read_text(encoding="utf-8"))
>>> objs = [Contrato(id_contrato=r["id_contrato"], nombre_entidad=r["nombre_entidad"], nit_entidad=r["nit_entidad"], departamento=r["departamento"], ciudad=r["ciudad"], valor_contrato=r["valor_contrato"], fecha_firma=r["fecha_firma"] or None, modalidad=r["modalidad"], contratista_nit=r["contratista_nit"], contratista_nombre=r["contratista_nombre"], orden="", sector="", estado_contrato="", codigo_categoria_principal="", descripcion_del_proceso="") for r in data]
>>> Contrato.objects.bulk_create(objs, batch_size=1000, ignore_conflicts=True)
>>> Contrato.objects.count()
```
**Restauración pg_dump (prod):** `pg_dump -h localhost -U postgres -d secop_db -t contrato -t entidad -Fc > secop.dump` y `pg_restore -d secop_db secop.dump`. Documentado en `CONTEXT.md:8` y `ERRORES.md:27`.
**Servicio no disponible:** si PostgreSQL está caído, `contratos/exceptions.py:1` `secop_exception_handler` intercepta `OperationalError/InterfaceError` y responde `503 {"detalle":"Servicio no disponible. Intente más tarde."}` sin exponer traceback. Frontend `Dashboard.jsx` muestra ese detalle en lugar de error crudo.

## Dónde seguir (la evidencia vive aquí, no arriba)
- **`CONTEXT.md`** — memoria del proyecto: decisiones, estado real y verificación requisito por requisito (`:4`), clave de buenas prácticas (`:8`), revisión Guía 4 (`:9`).
- **`ERRORES.md`** — 31 errores con causa y solución. Si algo falla, buscar ahí primero.
- **Fuentes y artefactos V2**
  - Dataset: https://www.datos.gov.co/resource/jbjy-vk9h.json (SECOP II, 5.98M, 2.72M vistas, CC BY-SA 4.0)
  - SODA 2.1 paginación: https://support.socrata.com (Tyler Tech, 2025 — $limit 50k + $offset)
  - Guía SENA GFPI-F-135 V04 — Fase Desarrollo — ADSO 3171062
  - Planificación local: `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V2 (ETL + Migraciones + Profiler Dual)
  - Backlogs: `EstructuraSesion_v2.xlsx` (5 sesiones 6h) + `SECOP_Insight_Backlog_Notion.md`
  - Buenas prácticas: `Informe_Stack_Django_React (1).pdf` (57 págs, Grupo 8, Julio 2026 — SOLID, DRY, KISS, YAGNI, Clean Code, JWT/PBKDF2, CORS/CSRF, ORM, Git) — ver `CONTEXT.md:8` Clave Obligatoria

---
*Última actualización: 15/09/2026 — README compacto (portada: qué / qué hace / cómo correr / dónde seguir; el diario por RF vive en `CONTEXT.md:4`) — Autor: Steven Araque*
