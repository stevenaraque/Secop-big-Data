# CONTEXT.md — Memoria viva del proyecto SECOP Insight V3.1 Freemium

> Este archivo es la memoria del agente y del equipo. Aquí se registra cómo pensamos, por qué decidimos y en qué estado real está el proyecto. Léelo antes de cualquier sesión de explicación.

## 1. Quiénes somos y cómo trabajamos

- **Equipo:** Grupo 8 ADSO 3171062 — Steven Alejandro Araque Castro (dev principal, principiante guiado) y Yesid Amaya — Instructor Gustavo Jiménez Suancha (CIMM, Sogamoso).
- **Asistente:** Jarvis (senior full stack 20 años), explica en teoría → ejemplo → paso a paso, directo y formal para adolescente, con emojis. No toca carpetas sin autorización. Principio: Texto > Cerebro (todo a archivo).
- **Metodología:** Scrum + Guía 4 SENA (GFPI-F-135 V04). Dos procesos en paralelo: **A) Desarrollo** del sistema Freemium y **B) Transferencia** — cada funcionalidad se explica paso a paso usando el propio proyecto como medio (10 pasos por sesión).
- **Gestión:** Notion con 5 Sprints (S1 30h/22pts, S2 33h/33pts, S3 30h/33pts, S4 18h/28pts + Buffer 39h/8pts + Freemium 7 historias = 56 requisitos, 399 pts). Sesiones en `EstructuraSesion_v2.xlsx` (5 sesiones × 6h) + planificación V3.1 Freemium en `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` (13 secciones, 85 cols, único).

## 2. El problema que resolvemos (V3 Freemium 6M)

Colombia publica **5.98M de contratos** en SECOP II con **85 columnas** planas que crecen diario. Un ciudadano que intenta abrir el CSV en Excel colapsa su equipo; filtrar por departamento o contratista exige descargar gigabytes y programar. Un contratista local debe revisar a diario SECOP para no perder licitaciones.

**No existe una herramienta ligera que:**
1. Ingiera 500k+ registros, los agregue en servidor y entregue solo métricas <50KB a un dashboard sin congelar el navegador **y muestre a qué velocidad se procesó cada capa**.
2. Convierta búsquedas repetitivas en **oportunidades automáticas** (SaaS) — el contratista crea 1 Radar y recibe Matches sin buscar a diario.

**Nuestra tesis V3:** **Traer filas al front es anti-patrón (100MB por filtro); enviar agregados SUM/COUNT/GROUP BY desde PostgreSQL es el patrón correcto (50KB, 2.000× menos) y el profiler dual lo demuestra (Naive 8s vs Optimizado 280ms, 29×). Y para no traer 6M al front, React virtualiza: solo pinta 50 filas visibles a 60 FPS, paginadas, nunca 5.000 de golpe.** Y para retención, **Radar → Oportunidad → Email** genera valor sin intervención.

## 3. Decisiones de arquitectura y por qué (V3)

- **PostgreSQL 16 local pgAdmin 5432 (no Supabase) — decisión 02/09/2026:** Supabase free 500MB se llena con 5.98M. Postgres local sin techo, `bulk_create batch 1000` sin timeout, sin Session Pooler/IPv6, acceso directo pgAdmin, 120 páginas SODA de 50k para 6M. `.env` no versionado. `Django 5.0.14` target (instalado 6.1).
- **85 de 85 columnas (V3, antes 15 de 85 en V2):** V2 recortó a 15 para MVP analítico; V3 mantiene 15 físicas + `Radar.filtros_extras` JSON para filtrar por cualquiera de las 85 sin migración por cada columna. Mapeo Socrata: `valor_del_contrato`→`valor_contrato`, `fecha_de_firma`→`fecha_firma` (Date), `modalidad_de_contratacion`→`modalidad`, etc. Escalar a 85 físicas es añadir campos + `migrate`.
- **SODA 2.1 paginación:** `$limit=50k max` + `$offset` + `$order=:id` + `X-App-Token` (10k req/h). Para 5.98M son 120 requests; demo 100k-500k son 2-10 páginas.
- **Migraciones vs ETL vs Matchmaking — regla de oro V3:** `migrate` crea tablas vacías + índices + `radar`/`oportunidad` → ETL `cargar_secop` las llena (`bulk_create`) → Post-ETL `matchmaking` cruza Radares activos vs contratos nuevos (`ILIKE` + rango + filtros 85) → crea `oportunidad` + `send_mail` console/SMTP. Sin `migrate` falla `relation does not exist`; sin ETL no hay matches.
- **Profiler dual 4 barras:** `Tiempo BD | Serialización Python | TTFB Red | Render React` — Usuario ve KPIs, Ingeniería ve desglose ms. Comparativa `Naive SELECT * 8200ms` vs `Optimizado aggregate 280ms` (29×). Backend mide `time.perf_counter()` y devuelve `tiempo_bd_ms` + `tiempo_python_ms`.
- **Manejo masivo sin estallar front (V3):** **DataTable masivo** con `TanStack Table 8.21` + `@tanstack/react-virtual` (44px, overscan 8, solo 50 nodos en DOM) + paginación `page_size 20-50` + `keepPreviousData` (no destruye Leaflet al filtrar) + `TanStack Query` cache 5min. Si pide "Todos", no son 6M, son 50 por página + `count 6M`. Así se visualizan 6M administrándolos, no mostrándolos.
- **Freemium 2 en 1:** Público (`/`) sin auth + CTA `¿Alertas?` → Auth JWT → Privado `/app` con `AuthGuard` (sin token expulsa a `/login` sin pedir al backend) → Bandeja `mis-oportunidades` con estados `Nueva/Guardada/Postulado`.
- **Modelo `Contrato` 15 cols + `Radares` JSON:** RF-01 exige 15 cols físicas para verificación; 85 elegibles vía `filtros_extras` sin recorte. `Radar` y `Oportunidad` normalizan SaaS.
- **Índices B-tree + JSON:** `departamento`, `modalidad`, `fecha_firma`, `contratista_nit`, `radar.usuario`, `oportunidad.radar+estado` — sin ellos 100k pasa de 40ms a 3s.
- **Email:** `EMAIL_BACKEND` env-driven: `console` en dev (imprime en terminal) + `smtp.gmail.com` con `EMAIL_HOST_PASSWORD` (App Password `pgtmswbagycceopx` sin espacios) en prod. `DEFAULT_FROM_EMAIL` = remitente.

## 4. Estado real al 18/09/2026 — Validado en ejecución

- **Infra:** `Backend/secop_backend/secop_backend/` con `manage.py`, apps `contratos` + `users` registradas, `migrate` OK (0001..0011, 0011_radar_filtros_extras). Tabla `radar` + `oportunidad` + `contrato` con 7 índices, `contrato` 15 cols físicas + JSON para 85.
- **Modelos:** `contratos/models.py` con `Contrato` 15 cols + `Entidad` 5 cols + `TrabajoCarga` + `Radar(filtros_extras JSON)` + `Oportunidad(contrato FK, radar FK, estado Nueva/Guardada/Postulado, unique_together)` + `UmbralAlerta` + `ConfigActualizacion` + `BackupRegistro` + `Auditoria` + `TokenRecuperacion`.
- **Auth RF-03/04/05 DONE (07/09):** PBKDF2, JWT HS256 1h/1d, `token_blacklist`, 401 sin revelar campo, `check 0`.
- **ETL RF-06 + Matchmaking DONE (07/09 + 18/09):** `cargar_secop` SODA jbjy-vk9h `$limit/$offset/$order=:id` + `X-App-Token` + `bulk_create 1000` + Fase 2 `matchmaking` (ILIKE + rango + filtros 85 → `Oportunidad` Nueva + `send_mail` 10 por carga). Validación RNF-04 descarta sin fecha/valor inválido con log 3 ejemplos. Probado `POST /api/cargar/actualizar-periodica/` 202 + polling 1s + `GET /api/cargar/<id>/` `completado 0 nuevos` si duplicado.
- **Radares RF-36..38 DONE (18/09):** `RadarSerializer` valida `palabras_clave` no vacía y `rango_min <= max` + `filtros_extras` JSON contra campos Contrato (85 elegibles). Endpoints `POST /api/radares/` 201, `GET /api/radares/` 200 paginado solo del usuario, `PUT/DELETE /api/radares/<id>/` 404 si no es dueño. Probado `Boyaca/pavimento/10M-50M` 201 + `{"ciudad":"Sogamoso","modalidad":"Licitación pública"}` 201 + `Duitama` 201. Total 5 Radares activos para `stevenldssaac@gmail.com` (ids 2,3,4,5,7).
- **Bandeja RF-39/40 DONE (18/09):** `GET /api/mis-oportunidades/` 200 paginado solo del usuario + `?estado=Nueva/Guardada/Postulado` + `OportunidadSerializer` con `contrato` embebido. `PATCH /api/mis-oportunidades/<id>/ {"estado":"Guardada"}` 200. Probado 3 Nuevas (`TEST-MATCH-001` pavimento, `TEST-EMAIL-001` emailtest, `TEST-PUENTE-001` puente) → filtrado `Nueva 3` / `Guardada 1` OK.
- **Email RF-41 DONE (18/09):** `settings.py` env-driven `EMAIL_BACKEND` (`console` dev / `smtp.gmail.com` prod) + `.env` `EMAIL_HOST_USER=stevenldssaac@gmail.com` + `EMAIL_HOST_PASSWORD=pgtmswbagycceopx` (App Password 16 chars, sin espacios). `send_mail` best-effort en `cargar_secop.py` (no bloquea ETL). Probado `send_mail` a `stevenldssaac@gmail.com` `Subject: Nueva oportunidad: puente` → `email enviado OK` + recibido en Gmail. En `runserver` anterior `console`, tras reinicio `smtp`.
- **Filtros 85 RF-42 DONE (18/09):** `Radar.filtros_extras` JSON + `RadarSerializer.validate_filtros_extras` contra `Contrato._meta` + `matchmaking` loop con `getattr(contrato, k)`. Probado `{"ciudad":"Sogamoso","modalidad":"Licitación pública"}` → `TEST-85-SI Sogamoso MATCH` y `TEST-85-NO Tunja NO MATCH`.
- **API RF-08..14 DONE:** `optimized/resumen` y `naive/resumen` con `tiempo_bd_ms` + `top` GROUP BY + `contratos` paginado 20 + `serie-mensual` DATE_TRUNC + `mapa-directa` + `buscar` debounce 300ms + `banderas/predominio` con umbrales + `entidades` + `grafo` force-graph + `exportar` BOM. Todo `IsAuthenticated`, `check 0`.
- **Frontend V3 DONE:** `Frontend/secop_frontend/src/pages/` con `Dashboard.jsx` + `ProfilerDual.jsx` (4 barras + toggle) + `DataTableSECOP.jsx` (TanStack Table 8.21 + virtual 44px, sorting, 60 FPS, solo 50 nodos) + `ActualizacionMasiva.jsx` + `Login.jsx` con `AuthGuard` (`App.jsx` redirige sin token, expulsa sin pedir) + `MapaDirecta` + `Buscador` + `Banderas` + `Umbrales` + `Entidades` + `Grafo`. Tailwind 3.4.17 config `content src/**/*` + `@tailwind` + `postcss` + build 37KB OK. `QueryClient` 5min + `keepPreviousData` (no destruye Leaflet) + `motion` springs + `sonner`.
- **Calidad:** `pytest.ini` + `contratos/tests.py` 5 tests (modelo, servicio, ETL sin fecha + no duplicados) `pytest 5 passed`, `vitest` 3 tests Login `3 passed`, `check 0`, `build 37KB` OK, `drf-spectacular` `/api/docs/` 34 endpoints.
- **Seguridad P0 fixes (17/09):** `settings.py` `SECRET_KEY/DEBUG/ALLOWED_HOSTS` por `os.getenv` + nueva key `^i^8#b0uj0wrl4ulw4vcrh6krhgt4%z^-quo40o^t8#_cd%=!f` en `.env` + hardening `SECURE_SSL_REDIRECT` si `DEBUG=False` + `docker-compose.yml` `postgres:16` + `Dockerfile` `python:3.12-slim` reproducibles. `.env` no versionado, `.env.example` con placeholder.
- **Backlog y Word:** `SECOP_Backlog_Producto.xlsx` 57 filas (56 historias: 42 base + 7 frontend + 7 Freemium RF-36..42, estandarizado header #1A3C5E, freeze A2) + `SECOP_Backlog_Producto.csv` único 70KB (16 cols Notion, Hecho/Steven Araque) + `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V3.1 Freemium 13 secciones, 85 cols, único sin réplicas (47KB).
- **BD:** PostgreSQL local `secop_db` con **4972 contratos** (4669 base + 5 TEST-*), **5 Radares** activos, **3 Oportunidades** Nuevas, 1 Entidad. `TrabajoCarga` con `0010` + `0011` OK.

> **Nota:** Para la retroalimentación constante, se celebra el acierto y se corrige el detalle sin tocar carpetas sin autorización.

## 5. Cómo enseñamos (acuerdo con Steven)

- Explicación en párrafos cortos con ejemplo literal, teoría → ejemplo → paso a paso.
- No se toca carpeta sin "sí, autorizo". Cada `makemigrations`, `migrate` o escritura se pide permiso y se verifica con ejecución.
- Todo error se documenta en `ERRORES.md` con causa y solución.
- ADHD mode activo: lead con next action, pasos numerados, estado cada turno, tiempo concreto, wins visibles.

## 6. Próximos pasos inmediatos (Sprint 4 Buffer + Freemium)

1. **RF-36..42 Freemium DONE (18/09)** — 5 Radares + 4 Oportunidades + email SMTP + filtros 85 `filtros_extras` + matchmaking 2 fases. Probado `Sogamoso MATCH` vs `Tunja NO MATCH` + `Duitama` 201.
2. **P0-1..3 Fixes DONE (17/09)** — secretos por env + `postgres:16`/`python:3.12` + Tailwind 37KB + build OK.
3. **Portero React DONE:** `App.jsx` `AuthGuard` con `react-router` mental: público `/` + CTA → `Login` → privado `/app` bandeja. JWT en `localStorage` (explicado trade-off HttpOnly), expulsa sin token sin pedir al backend, `TanStack Query` cachea, `virtualización` no colapsa con 5.000 visibles.
4. **Pendiente cierre Guía 4 (18/09):** `EstructuraSesion_v2.xlsx` actualizar a 56 historias + 5Sprints, video 3min pitch 45s (público 280ms + privado Radar→Match), tag `v1.1-profiler` ya en `main` (4407e72) + `e9efb7d` con RF-42, reflexión 3.1, `main` al día con 85 cols.

## 7. Fuentes y artefactos (V3.1 Freemium)

- `Observatorio_SECOP_II_Definicion_Proyecto.pdf` (6 págs base)
- `GFPI-F-135-Guia4-DesarrolloExplicación.pdf` (GFPI-F-135 V04)
- `EstructuraSesion_v2.xlsx` (5 sesiones × 6h, debe actualizarse a 56)
- `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V3.1 Freemium 13 secciones (85 cols, único, 47KB)
- `SECOP_Backlog_Producto.xlsx` (57 filas, 56 historias, estandarizado) + `SECOP_Backlog_Producto.csv` (70KB, Hecho/Steven, único)
- Dataset SODA 2.1 `jbjy-vk9h` — 5.98M × 85 cols, columnas verificadas vía `schema-column-preview`
- Nota: `Informe_Stack_Django_React (1).pdf` (57 págs, Julio 2026) sigue como referencia stack, no como doc proyecto.

## 8. Clave de Buenas Prácticas — Obligatoria

> **Si vas a tocar este código, léelo sí o sí. Sin esto, el proyecto se rompe en 2 sprints. Fuente: `Informe_Stack_Django_React (1).pdf` (Bloques 6-8).**

**1. Separación de dominios (Clean Arch + Capas + Hexagonal):** React (cliente) ↔ Django (servidor) vía HTTP JSON. `contratos` = `Contrato + Radar + Oportunidad` (dominio SECOP SaaS), `users` = `Auth`. Capas: presentación (vistas/serializers) → aplicación (servicios) → datos (ORM). Evita vistas gordas.

**2. SOLID + DRY + KISS + YAGNI:** SRP separa `ServicioContratos` de vistas; OCP agrega `filtros_extras` sin tocar endpoints; LSP intercambia naive/optimized; DIP modelo inyectable; DRY `_filtrar_depto` + `registrar_auditoria`; KISS SimpleJWT + Query; YAGNI MVP 2 roles.

**3. Migraciones vs ETL vs Matchmaking — nunca al revés:** `makemigrations` → `migrate` → `cargar_secop` (Fase 1 bulk_create + Fase 2 matchmaking). Sin `migrate` falla `relation does not exist`.

**4. Nunca hardcodees secretos:** `SECRET_KEY`, `SODA_TOKEN`, `EMAIL_HOST_PASSWORD` en `.env` + `os.getenv`, nunca en repo. `.env.example` con placeholder. `EMAIL_BACKEND` env-driven.

**5. Seguridad por defecto:** `PBKDF2` 390k iteraciones, JWT HS256 1h/1d + blacklist, CORS solo frontend, CSRF, React escapa XSS, ORM parametrizado, permisos `IsAuthenticated` + ownership `radar.usuario == request.user`, `filtros_extras` valida contra `Contrato._meta`.

**6. Nombres, tipos e índices estrictos:** `PascalCase` clases, `snake_case` tablas, `idx_*`, `Decimal(18,2)` + `DateField` + `JSONField` con `__all__`, `Ruff/Black` + `Prettier`.

**7. Un índice = un propósito:** `Meta.Index` sin `db_index` duplicado. 7 índices Contrato + 2 Radar + 1 Oportunidad. `transaction.atomic()` para integridad.

**8. Trabajo profesional:** Patrones `Builder` (QuerySets), `Facade` (Serializers), `Decorator` (permisos), `Proxy` (nginx), `Observer` (Query), `Strategy` (naive/optimized + filtros_extras), `Command` (management), `Repository` (services), `Unit of Work` (atomic), `Service Layer`. Git monorepo con `main` + tags, `requirements.txt` bloqueado, `pytest` + `vitest`.

## 9. Revisión Guía 4 GFPI-F-135 V04 (18/09/2026) — estado de evidencias

- **Proyecto de software OK:** 56 requisitos Freemium (42 base + 7 frontend + 7 SaaS) con Django 6M 85 cols + React DataTable 60 FPS + SaaS bandeja + email SMTP.
- **Código fuente OK:** P0-1/2/3 fixes + SOLID/DRY, `check 0` + `build 37KB` OK, manejo masivo con virtualización (50 visibles, no 5.000).
- **Repositorio OK:** `main` al día `e9efb7d` con 56 historias + `v1.0-sprint4` + `v1.1-profiler`, PR #1 mergeado, `feature/actualizacion-masiva` → `main`. `git config` `steven araque`.
- **Herramienta de gestión OK:** Notion 56/56 Hecho, `SECOP_Backlog_Producto.xlsx` 57 filas estandarizado + CSV 70KB único, `SECOP_Insight_Planificacion...docx` V3.1 13 secciones único.
- **Pruebas OK:** 5 pytest + 3 vitest = 8 passing (RF-22 email console/SMTP probado).
- **Autoría OK:** historial con `steven araque <stevenldssaac@gmail.com>` desde 17/09.
- **Proceso B — 5 sesiones UNA idea por día (V3):** S1 Django (Contrato 15+Radar JSON, migrate, admin) → S2 ETL 2 fases + JWT + resumen dual → S3 React (AuthGuard Portero, DataTable 60 FPS, filtros 85) → S4 Profiler dual + Matchmaking + email + bandeja SaaS → S5 demo Freemium 10min + video. Criterio: "React es Portero (expulsa sin token), Virtualizador (50 nodos), Gestor async (polling), Profiler (280ms vs 8s)".
- **Hallazgos estilo 18/09 ( resueltos):** Tailwind 37KB OK, routing `pathname` sin React Router (pendiente migrar a `react-router-dom` — explicado como trade-off), profiler dual en pantalla, DataTable 6 cols con sorting, 85 cols vía JSON sin recorte.

---
*Actualizado: 18/09/2026 — V3.1 Freemium definitivo: 56 historias + 85 cols elegibles + 5 Radares + 4 Oportunidades + email SMTP real (pgtmswbagycceopx) + Profiler dual + DataTable 60 FPS + Front privado /app con StatusMark micro + Tailwind + P0-1/2/3 + 4972 contratos — Main 2aff4ba + v1.2-privado — Pendiente solo video 3min + EstructuraSesion V3 + reflexión 3.1 (ver §9).*
