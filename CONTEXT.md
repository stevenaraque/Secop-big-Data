# CONTEXT.md — Memoria viva del proyecto SECOP Insight V3.1 Freemium

> Este archivo es la memoria del agente y del equipo. Aquí se registra cómo pensamos, por qué decidimos y en qué estado real está el proyecto. Léelo antes de cualquier sesión de explicación.

## 1. Quiénes somos y cómo trabajamos

- **Equipo:** Grupo 8 ADSO 3171062 — Steven Alejandro Araque Castro (dev principal, principiante guiado) y Yesid Amaya — Instructor Gustavo Jiménez Suancha (CIMM, Sogamoso).
- **Asistente:** Jarvis (senior full stack 20 años), explica en teoría → ejemplo → paso a paso, directo y formal para adolescente, con emojis. No toca carpetas sin autorización. Principio: Texto > Cerebro (todo a archivo).
- **Metodología:** Scrum + Guía 4 SENA (GFPI-F-135 V04). Dos procesos en paralelo: **A) Desarrollo** del sistema Freemium y **B) Transferencia** — cada funcionalidad se explica paso a paso usando el propio proyecto como medio (10 pasos por sesión).
- **Gestión:** Notion con 5 Sprints (S1 30h/22pts, S2 33h/33pts, S3 30h/33pts, S4 18h/28pts + Buffer 39h/8pts + Freemium 7 historias = 56 requisitos, 399 pts). Sesiones en `EstructuraSesion_v2.xlsx` (5 sesiones × 6h) + planificación V3.1 Freemium en `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` (13 secciones, redactado con 85 cols — esquema real 95 desde 27/09/2026).

## 2. El problema que resolvemos (V3 Freemium 6M)

Colombia publica **6.11M de contratos** (verificado 08/10/2026, actualización diaria) en SECOP II con **95 columnas** planas que crecen diario (85 hasta el 27/09/2026, +10 sostenibilidad por Decreto 0997). Un ciudadano que intenta abrir el CSV en Excel colapsa su equipo; filtrar por departamento o contratista exige descargar gigabytes y programar. Un contratista local debe revisar a diario SECOP para no perder licitaciones.

**No existe una herramienta ligera que:**
1. Ingiera 500k+ registros, los agregue en servidor y entregue solo métricas <50KB a un dashboard sin congelar el navegador **y muestre a qué velocidad se procesó cada capa**.
2. Convierta búsquedas repetitivas en **oportunidades automáticas** (SaaS) — el contratista crea 1 Radar y recibe Matches sin buscar a diario.

**Nuestra tesis V3:** **Traer filas al front es anti-patrón (100MB por filtro); enviar agregados SUM/COUNT/GROUP BY desde PostgreSQL es el patrón correcto (50KB, 2.000× menos) y el profiler dual lo demuestra (Naive 8s vs Optimizado 280ms, 29×). Y para no traer 6M al front, React virtualiza: solo pinta 50 filas visibles a 60 FPS, paginadas, nunca 5.000 de golpe.** Y para retención, **Radar → Oportunidad → Email** genera valor sin intervención.

## 3. Decisiones de arquitectura y por qué (V3)

- **PostgreSQL 16 local pgAdmin 5432 (no Supabase) — decisión 02/09/2026:** Supabase free 500MB se llena con 6.11M. Postgres local sin techo, `bulk_create batch 1000` sin timeout, sin Session Pooler/IPv6, acceso directo pgAdmin, 123 páginas SODA de 50k para 6.11M. `.env` no versionado. `Django 5.0.14` target (instalado 6.1).
- **95 de 95 columnas (V3.3, 85 hasta 27/09/2026, antes 15 de 85 en V2):** V2 recortó a 15 para MVP analítico; V3 mantiene 15 físicas + `Radar.filtros_extras` JSON para filtrar por cualquiera de las 95 sin migración por cada columna. Mapeo Socrata: `valor_del_contrato`→`valor_contrato`, `fecha_de_firma`→`fecha_firma` (Date), `modalidad_de_contratacion`→`modalidad`, etc. Escalar a 95 físicas es añadir campos + `migrate`.
- **SODA 2.1 paginación:** `$limit=50k max` + `$offset` + `$order=:id` + `X-App-Token` (10k req/h). Para 5.98M son 120 requests; demo 100k-500k son 2-10 páginas. (Esquema 95 cols + 6.11M filas verificado 08/10/2026: 123 requests para carga total.)
- **Migraciones vs ETL vs Matchmaking — regla de oro V3:** `migrate` crea tablas vacías + índices + `radar`/`oportunidad` → ETL `cargar_secop` las llena (`bulk_create`) → Post-ETL `matchmaking` cruza Radares activos vs contratos nuevos (`ILIKE` + rango + filtros 95) → crea `oportunidad` + `send_mail` console/SMTP. Sin `migrate` falla `relation does not exist`; sin ETL no hay matches.
- **Profiler dual 4 barras:** `Tiempo BD | Serialización Python | TTFB Red | Render React` — Usuario ve KPIs, Ingeniería ve desglose ms. Comparativa real medida (Boyacá: BD ~126ms agregado vs naive 413 anti-OOM con >20k). Backend mide con 2 `perf_counter()` (servicio vs payload) y devuelve `tiempo_bd_ms` + `tiempo_python_ms` reales (09/10/2026: eliminados los multiplicadores fijos `×0.15/×0.85`, tag `v1.5-dashboard`). Resumen normaliza `Decimal→float` para JSON numérico.
- **Manejo masivo sin estallar front (V3):** **DataTable masivo** con `TanStack Table 8.21` + `@tanstack/react-virtual` (44px, overscan 8, solo 50 nodos en DOM) + paginación `page_size 20-50` + `keepPreviousData` (no destruye Leaflet al filtrar) + `TanStack Query` cache 5min. Si pide "Todos", no son 6M, son 50 por página + `count 6M`. Así se visualizan 6M administrándolos, no mostrándolos.
- **Freemium 2 en 1:** Público (`/`) sin auth + CTA `¿Alertas?` → Auth JWT → Privado `/app` con `AuthGuard` (sin token expulsa a `/login` sin pedir al backend) → Bandeja `mis-oportunidades` con estados `Nueva/Guardada/Postulado`.
- **Modelo `Contrato` 15 cols + `Radares` JSON:** RF-01 exige 15 cols físicas para verificación; 95 elegibles vía `filtros_extras` sin recorte. `Radar` y `Oportunidad` normalizan SaaS.
- **Índices B-tree + JSON:** `departamento`, `modalidad`, `fecha_firma`, `contratista_nit`, `nit_entidad` (0018, por-entidad), `-valor_contrato` (0018, grafo), `radar.usuario`, `oportunidad.radar+estado` — sin ellos 100k pasa de 40ms a 3s. `por-entidad` usa `GROUPING SETS` (1 pasada, 60s→3.7s en entidad 182k).
- **Email:** `EMAIL_BACKEND` env-driven: `console` en dev (imprime en terminal) + `smtp.gmail.com` con `EMAIL_HOST_PASSWORD` (App Password `<APP_PASSWORD_16_SIN_ESPACIOS_NO_VERSIONAR>` — solo en `.env` local y dashboard, nunca en docs) en prod. `DEFAULT_FROM_EMAIL` = remitente.

## 4. Estado real al 18/09/2026 — Validado en ejecución

- **Infra:** `Backend/secop_backend/secop_backend/` con `manage.py`, apps `contratos` + `users` registradas, `migrate` OK (0001..0011, 0011_radar_filtros_extras). Tabla `radar` + `oportunidad` + `contrato` con 7 índices, `contrato` 15 cols físicas + JSON para 85 (esquema era 85 el 18/09; 95 desde 27/09/2026).
- **Modelos:** `contratos/models.py` con `Contrato` 15 cols + `Entidad` 5 cols + `TrabajoCarga` + `Radar(filtros_extras JSON)` + `Oportunidad(contrato FK, radar FK, estado Nueva/Guardada/Postulado, unique_together)` + `UmbralAlerta` + `ConfigActualizacion` + `BackupRegistro` + `Auditoria` + `TokenRecuperacion`.
- **Auth RF-03/04/05 DONE (07/09):** PBKDF2, JWT HS256 1h/1d, `token_blacklist`, 401 sin revelar campo, `check 0`.
- **Auditoría auth DONE (08/10/2026, commits `3e5a0bf` + `8defebf` + `30a4031`, tag `v1.4-auth`):** P0-1 registro 200 genérico anti-enumeración (existe vs nuevo idéntico) + P0-2 username duplicado 200 (antes 500 IntegrityError) + P0-3 email `iexact` + `lower` (antes `Test@X` duplicaba y `.get()` → 500) + P0-4 throttle `login 10/min, register/recuperar 20/min` (antes `anon 200/min` = fuerza bruta) + P0-5 rotación refresh + blacklist (refresh 1 uso) + P1-1/2 Registro timeout 15s + 429 + `nav()` SPA + P1-3 política `8-128 + CommonPasswordValidator + SimilarityValidator` sync front/back (antes `Password1` pasaba) + P1-4 Recuperar/Restablecer timeout/429 + política previa + confirmar + P1-5 `PrivateRoute` valida `exp` + refresh antes de pintar + P2 (checked muerto, `85→95`, vacíos trim, ojo con teclado). `pytest users 9 passed` + `vitest 14 passed (3 suites)` + `check 0` + `build 2.16s`. Pendiente mayor: HttpOnly cookies (access 1h no revocable por diseño JWT, documentado en `settings.py`).
- **ETL RF-06 + Matchmaking DONE (07/09 + 18/09):** `cargar_secop` SODA jbjy-vk9h `$limit/$offset/$order=:id` + `X-App-Token` + `bulk_create 1000` + Fase 2 `matchmaking` (ILIKE + rango + filtros 95 → `Oportunidad` Nueva + `send_mail` 10 por carga). Validación RNF-04 descarta sin fecha/valor inválido con log 3 ejemplos. Probado `POST /api/cargar/actualizar-periodica/` 202 + polling 1s + `GET /api/cargar/<id>/` `completado 0 nuevos` si duplicado.
- **Radares RF-36..38 DONE (18/09):** `RadarSerializer` valida `palabras_clave` no vacía y `rango_min <= max` + `filtros_extras` JSON contra campos Contrato (95 elegibles). Endpoints `POST /api/radares/` 201, `GET /api/radares/` 200 paginado solo del usuario, `PUT/DELETE /api/radares/<id>/` 404 si no es dueño. Probado `Boyaca/pavimento/10M-50M` 201 + `{"ciudad":"Sogamoso","modalidad":"Licitación pública"}` 201 + `Duitama` 201. Total 5 Radares activos para `stevenldssaac@gmail.com` (ids 2,3,4,5,7).
- **Bandeja RF-39/40 DONE (18/09):** `GET /api/mis-oportunidades/` 200 paginado solo del usuario + `?estado=Nueva/Guardada/Postulado` + `OportunidadSerializer` con `contrato` embebido. `PATCH /api/mis-oportunidades/<id>/ {"estado":"Guardada"}` 200. Probado 3 Nuevas (`TEST-MATCH-001` pavimento, `TEST-EMAIL-001` emailtest, `TEST-PUENTE-001` puente) → filtrado `Nueva 3` / `Guardada 1` OK.
- **Email RF-41 DONE (18/09):** `settings.py` env-driven `EMAIL_BACKEND` (`console` dev / `smtp.gmail.com` prod) + `.env` `EMAIL_HOST_USER=stevenldssaac@gmail.com` + `EMAIL_HOST_PASSWORD=<APP_PASSWORD_16_SIN_ESPACIOS_NO_VERSIONAR>` (App Password 16 chars, sin espacios, solo local). `send_mail` best-effort en `cargar_secop.py` (no bloquea ETL). Probado `send_mail` a `stevenldssaac@gmail.com` `Subject: Nueva oportunidad: puente` → `email enviado OK` + recibido en Gmail. En `runserver` anterior `console`, tras reinicio `smtp`.
- **Filtros 95 RF-42 DONE (18/09):** `Radar.filtros_extras` JSON + `RadarSerializer.validate_filtros_extras` contra `Contrato._meta` + `matchmaking` loop con `getattr(contrato, k)`. Probado `{"ciudad":"Sogamoso","modalidad":"Licitación pública"}` → `TEST-85-SI Sogamoso MATCH` y `TEST-85-NO Tunja NO MATCH`.
- **API RF-08..14 DONE:** `optimized/resumen` y `naive/resumen` con `tiempo_bd_ms` + `top` GROUP BY + `contratos` paginado 20 + `serie-mensual` DATE_TRUNC + `mapa-directa` + `buscar` debounce 300ms + `banderas/predominio` con umbrales + `entidades` + `grafo` force-graph + `exportar` BOM. Todo `IsAuthenticated`, `check 0`.
- **Frontend V3 DONE:** `Frontend/secop_frontend/src/pages/` con `Dashboard.jsx` + `ProfilerDual.jsx` (4 barras + toggle) + `DataTableSECOP.jsx` (TanStack Table 8.21 + virtual 44px, sorting, 60 FPS, solo 50 nodos) + `ActualizacionMasiva.jsx` + `Login.jsx` con `AuthGuard` (`App.jsx` redirige sin token, expulsa sin pedir) + `MapaDirecta` + `Buscador` + `Banderas` + `Umbrales` + `Entidades` + `Grafo`. Tailwind 3.4.17 config `content src/**/*` + `@tailwind` + `postcss` + build 37KB OK. `QueryClient` 5min + `keepPreviousData` (no destruye Leaflet) + `motion` springs + `sonner`.
- **Auditoría dashboard DONE (09/10/2026, commit `021d5ee`, tag `v1.5-dashboard`, migración 0018):** P0-1 profiler real (2 `perf_counter`, fin `×0.15/×0.85`, `Decimal→float`) + P0-2 `/exportar/` con scope throttle `20/min` (era `[]` con comentario falso) + P0-3 queryKeys con `modo` + `staleTime` 5min en 5 secciones (Banderas/Predominio/Entidades/Umbrales/Grafo) + P0-4 `obtenerTokenVigente()` valida `exp` antes de las 5 queries (0×401, sin expulsar a `/login`) + P1-1 `buscar` en tablas chicas (frío 1.34s, caché 4ms) + P1-2 `0018 idx_contrato_nitent/val` + P1-3 debounce 300ms Entidades + clamp umbrales/limit + P1-4 KPIs honestos (`—` en error, conteo real 9.3M, 95 cols) + P1-5 `ErrorBoundary.jsx` + Reintentar por sección + P2 fechas→400, páginas→400, grafo limit→400, ping respeta `reduced-motion`. `pytest 17/17` (8 contratos + 9 users) + `vitest 14/14` + `check 0` + `build 0` + `lint 0`. Despliegue exige `migrate` (0018 indexa 9.3M, minutos, 1 vez).
- **Calidad:** `pytest.ini` + `contratos/tests.py` 5 tests (modelo, servicio, ETL sin fecha + no duplicados) + `users/tests.py` 9 tests (anti-oráculo, throttle, rotación, política) `pytest users 9 passed`, `vitest` 14 passed (Login 3 + Registro 7 + PrivateDashboard 4), `check 0`, `build 2.16s` OK, `drf-spectacular` `/api/docs/` 34 endpoints.
- **Seguridad P0 fixes (17/09):** `settings.py` `SECRET_KEY/DEBUG/ALLOWED_HOSTS` por `os.getenv` + nueva key `<SECRET_KEY_GENERADA_NO_VERSIONAR>` en `.env` + hardening `SECURE_SSL_REDIRECT` si `DEBUG=False` + `docker-compose.yml` `postgres:16` + `Dockerfile` `python:3.12-slim` reproducibles. `.env` no versionado, `.env.example` con placeholder.
- **Backlog y Word:** `SECOP_Backlog_Producto.xlsx` 57 filas (56 historias: 42 base + 7 frontend + 7 Freemium RF-36..42, estandarizado header #1A3C5E, freeze A2) + `SECOP_Backlog_Producto.csv` único 70KB (16 cols Notion, Hecho/Steven Araque) + `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V3.1 Freemium 13 secciones, 85 cols, único sin réplicas (47KB) — redactado previo a esquema 95 del 27/09/2026.
- **BD:** PostgreSQL local `secop_db` con **470.540 contratos** (creció vía ETL desde los 4.972 base), **6 Radares** activos de `steven` (pavimento 10M-50M, puente Sogamoso+Licitación, salud min 5M, emailtest, test/Duitama), oportunidades TEST + email SMTP. `TrabajoCarga` con `0010` + `0011` OK.

> **Nota:** Para la retroalimentación constante, se celebra el acierto y se corrige el detalle sin tocar carpetas sin autorización.

## 5. Cómo enseñamos (acuerdo con Steven)

- Explicación en párrafos cortos con ejemplo literal, teoría → ejemplo → paso a paso.
- No se toca carpeta sin "sí, autorizo". Cada `makemigrations`, `migrate` o escritura se pide permiso y se verifica con ejecución.
- Todo error se documenta en `ERRORES.md` con causa y solución.
- ADHD mode activo: lead con next action, pasos numerados, estado cada turno, tiempo concreto, wins visibles.

## 6. Próximos pasos inmediatos (Sprint 4 Buffer + Freemium)

### Sesión 24/09/2026 — Rediseño dashboard + radar CRUD + fondo + loader (DONE)
1. **Dashboard rediseñado:** hero con CTAs + KPIs con iconos/skeleton + `ScrubChart` con scrub continuo (una serie manda, rangos 6M/1A/Todo, `serie-mensual` real, spring solo al soltar) + `MiniDataTable` (sort + 8 fijas + relleno) en Banderas/Predominio + `LazySection` (4 queries al abrir, resto al scroll) + `PageBackground` (aurora CSS + metal WebGL `ogl`, paleta por tema) en `/`, `/login`, `/app` + `PantallaCarga` (100ms mín + tema congelado) + `public/tema.js` anti-flash + `vite polling` (OneDrive) + dinero compacto (`$1,5 billones`, `lib/formato.js`) + estándar blanco en claro.
2. **Radar CRUD completo:** pausar/activar, editar inline, eliminar con confirmación, skeletons, reintentar, paginación 4+5, toasts `sonner`, Ciudad/Modalidad con sugerencias + JSON avanzado, dark legible, `vitest 11 passed`.
3. **Backend naive alineado:** guard 413 por total FILTRADO (COUNT optimizado) + servicio filtra con WHERE antes de `list()` → Boyacá 200 real (BD 29ms vs Python 167ms), Todos 413 omitido sin ruido (`ERRORES.md #32/#33`).
4. **Calidad sesión:** `check 0` + `pytest 5 passed` + `vitest 11 passed` + lint 0 + build 1.6s.

### Sesión 25/09–07/10 — Carga total 9.3M + perf + auditoría + pulido (DONE)
1. **ETL total + migraciones 0012..0017:** `Decimal` cuantizado a 2 decimales (SODA trae 6) + script descarga 6M paginado + carga total SECOP II **9.3M vía COPY** + migración **0013 sin unique** en `id_contrato` (API adaptada: no-unique + 404s + paginación SaaS) + **0014 índices covering 9M** + **0015 resúmenes precalculados** + **0016 top/serie/depto** + **0017 banderas precalculadas**.
2. **Perf dashboard 34s → ms:** resúmenes precalculados + covering idx + banderas precalculadas + SPA sin parpadeo (layout persistente, WebGL no se desmonta, intensidad por ruta).
3. **Auth + Freemium real:** refresh JWT single-flight sin delay 800ms + `api` central + registro 200 genérico sin oracle por clave/usuario (anti-enumeración) + reset token hash SHA-256 + observatorio público `AllowAny` + privado `IsAuthenticated` + throttle anon 100/min + fondo Frost/metal con `reduced-motion`.
4. **Frontend pulido:** tildes insensibles (depto/modalidad/buscador + matchmaking + backfill bandeja) + bandeja card con detalle + modal Info liviano + Dashboard legacy eliminado + `VITE_API_URL` env + `react-router` + vite chunks + CSP prod + lint + auditoría P0/P1 (`AUDITORIA_2026-09-18.md`, tags `v1.2-privado` + `v1.3-auditoria`, HEAD `df83925` 07/10). Pendiente: video 3min pitch 45s + `EstructuraSesion` V3 + reflexión 3.1 (ver §9).

### Sesión 08/10/2026 — Login página por página + esquema SECOP 85→95 (DONE)
1. **Login funcional (E1–E6):** redirect post-login `/`→`/app` + lee `non_field_errors` + `trim` + valida vacíos + timeout 15s + mensaje 429 + sin `checked` muerto ni `reload` (router) + registro muestra detalle genérico backend (anti-enumeración intacta).
2. **Login diseño (D1–D5):** stats honestos (`<50KB`, `85→95`, `29×`, `60 FPS`) + LivePulse sin ms falsos + testimonio con tag ejemplo + footer con `API` var + badge V3.3 + registro duplicado eliminado (`/login` solo entra, registro vive en `/registro`) + form siempre montado con spinner (320→230 líneas). `vitest 3/3` + `build` OK.
3. **Esquema SECOP 95 verificado + Apify:** sin changelog oficial → `/api/views/jbjy-vk9h.json` (`columns` 1–95) + fecha estimada 27/09/2026 (`viewLastModified` + lote IDs 172M) + origen Decreto 0997 04/08/2026 + ABC CCE 10/09/2026 + Guía MinAmbiente/CCE + Circular 003/2025 (pos. 83–84) + `count(*)` 6.111.521 + `max(ultima_actualizacion)` 2026-10-06 + frecuencia diaria. ETL por nombre intacto, `filtros_extras` cubre las 95 sin migración. README con sección `85→95` + CONTEXT actualizado.
4. **Entidades vacías corregido (RF-28):** `cargar_secop` nunca poblaba tabla `entidad` (0 filas con 9.3M contratos) → backfill SQL `DISTINCT` por NIT (11.582 entidades) + upsert por lote en ETL (`bulk_create ignore_conflicts`, mismo `atomic`) + test regresión. `pytest 8/8`.

### Sesión 09/10/2026 — Auditoría dashboard P0/P1/P2 + entidades en vivo (DONE)
1. **P0 backend:** profiler con tiempos reales (Boyacá BD 126ms medido) + `/exportar/` throttle `20/min` anti-DoS + fechas→400 + páginas→400 + grafo `limit`→400.
2. **P1 perf:** `buscar` 0 GROUP BY 9.3M (tablas chicas, frío 1.34s) + migración **0018** (`nit_entidad`, `-valor_contrato`) + `por-entidad` 60s→3.7s (`GROUPING SETS`, total verificado 182.316 idéntico) + grafo 0.75s.
3. **P0/P1 frontend:** queryKeys con `modo` en 5 secciones + `obtenerTokenVigente()` (0×401) + debounce Entidades 300ms + clamp umbrales + KPIs honestos (`—` en error, `9,3M` real, `95 cols`) + `ErrorBoundary.jsx` + Reintentar por sección + ping respeta `reduced-motion`.
4. **Entidades en vivo:** `/api/entidades/` devolvía `count 0` con 9.320.519 contratos (upsert ETL solo cubre cargas nuevas) → backfill `DISTINCT ON (nit_entidad)` con `ON CONFLICT DO NOTHING` → **11.582** verificadas por API. `pytest 17/17` + `vitest 14/14` + `check 0` + `build 0` + `lint 0`. Commit `021d5ee` + tag `v1.5-dashboard` en `main`.
5. **Pendiente:** video 3min pitch 45s (ahora defendible con profiler honesto) + `EstructuraSesion` V3 + reflexión 3.1 (ver §9).

### Sesión 09/10/2026 — Auditoría radar P0/P1/P2 + ETL abierto a logueados (DONE)
1. **P0 radar:** matchmaking por `pk__in` (fin re-match histórico por `id_contrato` no-unique, PKs verificadas) + bandeja paginada en servidor (total real, retroceso si el PATCH vacía la página) + queryKeys con `sub` JWT (fin fuga entre cuentas).
2. **P1 radar:** emails ETL en thread daemon por PK (fin +5-12min con SMTP caído) + `filtros_extras` con alias SODA→campo + números (verificado en shell) + throttle `radar 20/min` en 4 vistas + `obtenerTokenVigente()` en queries y 5 mutations de `/app` (tests con JWT futuro).
3. **P2 radar:** DELETE oportunidad propia (ajena 404 verificado) + rango `min<=max` en front + `?estado=` inválido→400. `pytest 17/17` + `vitest 14/14` + `check 0` + `build 0` + `lint 0`. Commits `835194e` + `9fc555b` + `c6039b1` en `main`.
4. **ETL abierto (pedido explícito):** trigger + estado ETL `IsAdminUser→IsAuthenticated` + scope `cargar 10/min` (iniciar/listar/config/backups siguen admin); CSV anon intacto + errores por estado + panel sin-login guía al CSV. Verificado no-admin real (login 200, trigger 202, estado 200). Commits `85eb143` + `e8958aa`.
5. **Pendiente:** video 3min pitch 45s + `EstructuraSesion` V3 + reflexión 3.1 (ver §9).

### Sesión 09/10/2026 — Auditoría solo-diseño dashboard D1-D8 (DONE)
1. **D1-D4:** tabs Profiler sin `dark:` duplicado + hover visible + 7 secciones a `rounded-[24px]` + táctiles 44px en móvil + mapa pergamino atenuado en dark (`brightness(.82)`, VER TODO legible). Commit `bbcb0cc`.
2. **D5-D8:** Guardar umbral píldora `h-10` + dark en alerta amber/scrub/inputs + Banderas/Predominio sin `whileInView` (LazySection ya difiere) + 1 ping vivo + skeletons a medida (140/480/520, vidrio) + microtexto `xs` + focos en sorts/CTAs/CSV. Commit `959317b`. `build 0` + `lint 0`.
3. **Pendiente:** video 3min pitch 45s + `EstructuraSesion` V3 + reflexión 3.1 (ver §9).

### Historial previo (conservado)
1. **RF-36..42 Freemium DONE (18/09)** — 5 Radares + 4 Oportunidades + email SMTP + filtros 95 `filtros_extras` + matchmaking 2 fases. Probado `Sogamoso MATCH` vs `Tunja NO MATCH` + `Duitama` 201.
2. **P0-1..3 Fixes DONE (17/09)** — secretos por env + `postgres:16`/`python:3.12` + Tailwind 37KB + build OK.
3. **Portero React DONE:** `App.jsx` `AuthGuard` con `react-router` mental: público `/` + CTA → `Login` → privado `/app` bandeja. JWT en `localStorage` (explicado trade-off HttpOnly), expulsa sin token sin pedir al backend, `TanStack Query` cachea, `virtualización` no colapsa con 5.000 visibles.
4. **Pendiente cierre Guía 4 (18/09):** `EstructuraSesion_v2.xlsx` actualizar a 56 historias + 5Sprints, video 3min pitch 45s (público 280ms + privado Radar→Match), tag `v1.1-profiler` ya en `main` (4407e72) + `e9efb7d` con RF-42, reflexión 3.1, `main` al día con 85 cols.

> **Nota histórica:** Para la retroalimentación constante, se celebra el acierto y se corrige el detalle sin tocar carpetas sin autorización.

## 7. Fuentes y artefactos (V3.1 Freemium)

- `Observatorio_SECOP_II_Definicion_Proyecto.pdf` (6 págs base)
- `GFPI-F-135-Guia4-DesarrolloExplicación.pdf` (GFPI-F-135 V04)
- `EstructuraSesion_v2.xlsx` (5 sesiones × 6h, debe actualizarse a 56)
- `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V3.1 Freemium 13 secciones (85 cols, único, 47KB) — redactado previo a esquema 95 del 27/09/2026
- `SECOP_Backlog_Producto.xlsx` (57 filas, 56 historias, estandarizado) + `SECOP_Backlog_Producto.csv` (70KB, Hecho/Steven, único)
- Dataset SODA 2.1 `jbjy-vk9h` — 6.11M × 95 cols (verificado 08/10/2026 vía `/api/views/jbjy-vk9h.json`, `columns` pos. 1–95, actualización diaria; 85 hasta 27/09/2026, +10 sostenibilidad por Decreto 0997 del 04/08/2026 + ABC CCE 10/09/2026)
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

- **Proyecto de software OK:** 56 requisitos Freemium (42 base + 7 frontend + 7 SaaS) con Django 6M 95 cols + React DataTable 60 FPS + SaaS bandeja + email SMTP.
- **Código fuente OK:** P0-1/2/3 fixes + SOLID/DRY, `check 0` + `build 37KB` OK, manejo masivo con virtualización (50 visibles, no 5.000).
- **Repositorio OK (09/10):** `main` al día + tags `v1.0-sprint4` + `v1.1-profiler` + `v1.2-privado` + `v1.3-auditoria` + `v1.4-auth` + `v1.5-dashboard`, migraciones 0001..0018 (radar P0/P1/P2: `835194e` + `9fc555b` + `c6039b1`; ETL logueados: `85eb143` + `e8958aa`; diseño D1-D8: `bbcb0cc` + `959317b`). `git config` `steven araque`.
- **Herramienta de gestión OK:** Notion 56/56 Hecho, `SECOP_Backlog_Producto.xlsx` 57 filas estandarizado + CSV 70KB único, `SECOP_Insight_Planificacion...docx` V3.1 13 secciones único.
- **Pruebas OK:** 17 pytest (8 contratos + 9 users) + 14 vitest (Login 3 + Registro 7 + PrivateDashboard 4) = 31 passing (RF-22 email console/SMTP probado).
- **Autoría OK:** historial con `steven araque <stevenldssaac@gmail.com>` desde 17/09.
- **Proceso B — 5 sesiones UNA idea por día (V3):** S1 Django (Contrato 15+Radar JSON, migrate, admin) → S2 ETL 2 fases + JWT + resumen dual → S3 React (AuthGuard Portero, DataTable 60 FPS, filtros 95) → S4 Profiler dual + Matchmaking + email + bandeja SaaS → S5 demo Freemium 10min + video. Criterio: "React es Portero (expulsa sin token), Virtualizador (50 nodos), Gestor async (polling), Profiler (280ms vs 8s)".
- **Hallazgos estilo 18/09 ( resueltos):** Tailwind 37KB OK, routing `pathname` sin React Router (pendiente migrar a `react-router-dom` — explicado como trade-off), profiler dual en pantalla, DataTable 6 cols con sorting, 95 cols vía JSON sin recorte.

---
*Actualizado: 09/10/2026 — Auditoría radar P0/P1/P2 + ETL logueados + auditoría diseño D1-D8 (commits `bbcb0cc` + `959317b`) — Pendiente video 3min + EstructuraSesion V3 + reflexión 3.1 (ver §9).*
