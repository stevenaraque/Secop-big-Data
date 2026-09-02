# SECOP Insight — Observatorio de Contratación Pública SECOP II

> Inteligencia de negocios sobre 5.98M de contratos electrónicos | Django + PostgreSQL local + React | **V2 — ETL + Migraciones + Profiler Dual**
> Grupo 8 — ADSO 3171062 — Steven Alejandro Araque Castro | Yesid Amaya — Instructor Gustavo Jiménez Suancha — CIMM — Agosto-Septiembre 2026

## Objetivo del proyecto
Construir un Observatorio Ciudadano que ingiera masivamente contratos SECOP II desde `datos.gov.co` (dataset `j13v-233n`, 5.98M filas x 85 cols), los agregue en base de datos y los exponga en un dashboard React con KPIs, filtros, mapa coroplético, grafo de redes y banderas rojas, sin congelar el navegador. El patrón central es **agregar en BD y enviar solo <50KB** al frontend, no traer filas completas (anti-patrón de 100MB).

**Objetivo General (Guía 4 GFPI-F-135 V04)** — Construir la estructura de datos y la interfaz del software bajo arquitectura decoupled, demostrando el Stack completo en sesiones de explicación paso a paso.

**Pitch 45s (V2):** *“Filtro 500k contratos y el profiler marca Naive 8s en rojo vs Optimizado 280ms en verde — 29× más rápido — demostrando que Django agrega y React virtualiza, no mueven datos brutos.”*

## Stack Tecnológico (V2 actualizado)
- **Backend:** Django 6.1 instalado (doc target Django 5.0.14) + Django REST Framework 3.17.2
- **Base de datos:** PostgreSQL 18 local (pgAdmin, localhost:5432) — *V2: Supabase descartado por techo 500MB; local permite 5.98M completos (100 páginas SODA de 50k)*
- **Frontend:** React 19.2.8 + Vite 5.4.21 + TanStack Query + Recharts + Leaflet + @tanstack/react-virtual (60 FPS)
- **Control de versiones:** Git + GitHub
- **Gestión:** Notion (4 Sprints, 42 requisitos, 124 pts) + `EstructuraSesion_v2.xlsx` V2 (5 sesiones × 6h 6:00-11:30 = 30h, Día 1-5) + `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V2 + `SECOP_Backlog_Producto.xlsx` (Product Backlog + 42 Historias con criterios)

## Estado actual — Cómo estamos trabajando
Metodología **Scrum** + **Guía 4: Proceso A (Desarrollo) + Proceso B (Transferencia de conocimiento)**.

- **Guía 4 completada en papel (V2 02/09):** Product Backlog y 42 Historias con criterios ya diligenciados en `SECOP_Backlog_Producto.xlsx` (Product Backlog + Historias de Usuario, verificado 02/09) y 5 sesiones de 6h (6:00-11:30 Día 1-5 = 30h) en `EstructuraSesion_v2.xlsx` V2. Notion con 4 Sprints sincronizado.
- **Infraestructura base lista (01/09/2026):**
  - `django-admin startproject secop_backend` ejecutado en `Backend/secop_backend/secop_backend/`
  - App `contratos` creada y registrada en `INSTALLED_APPS`
  - Conexión PostgreSQL 18 local (pgAdmin, PORT 5432) configurada en `settings.py:DATABASES` vía `.env` (sin hardcodear)
  - Migraciones base aplicadas (`admin`, `auth`, `contenttypes`, `sessions`)
- **RF-01 — Crear el modelo de datos — COMPLETADO y VALIDADO (01/09/2026):**
  - Modelo `Contrato` con 15 columnas en `contratos/models.py:1` — `nombre_entidad`, `nit_entidad`, `departamento`, `ciudad`, `orden`, `sector`, `id_contrato` (unique), `estado_contrato`, `codigo_categoria_principal`, `descripcion_del_proceso`, `valor_contrato` (Decimal 18,2), `fecha_firma` (DateField), `modalidad`, `contratista_nit`, `contratista_nombre`
  - 4 índices B-tree: `idx_contrato_depto`, `idx_contrato_modalidad`, `idx_contrato_fecha`, `idx_contrato_nit` — validado con `sqlmigrate` y `Django shell`
  - Pruebas en shell: creación válida `CO1-TEST-001` OK + rechazo de 3 decimales y fecha texto OK
  - Migración `0002_contrato_idx_*` aplicada — tabla `contrato` operativa con 1 registro de prueba
  - **Pendiente RF-25 (mismo Sprint 1):** Modelo `Entidad` separado con FK `Contrato → Entidad` (5h) — definido en `SECOP_Backlog_Producto.xlsx:RF-25`, debe crearse antes de seguir a ETL para evitar refacto en Sprint 3

## Estructura de carpetas
```
Big data/
├── Backend/secop_backend/
│   ├── secop_backend/        # proyecto Django (settings.py, urls.py, wsgi.py)
│   │   ├── contratos/        # app RF-01 (models.py, migrations/, admin.py)
│   │   └── manage.py
│   ├── venv/                 # entorno virtual (Python 3.14.5, Django 6.1)
│   └── .vscode/settings.json # intérprete apuntando a venv
├── Frontend/secop_frontend/  # Vite + React (App.jsx, main.jsx)
└── README.md / CONTEXT.md
```

## Cómo levantar el proyecto (Postgres local)
1. Crear BD en Postgres: `createdb secop_db` (usuario `postgres`)
2. Crear `.env` en `secop_backend/secop_backend/` con `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST=localhost`, `DB_PORT=5432`
3. Activar venv y migrar:
   ```
   venv\Scripts\activate
   cd secop_backend/secop_backend
   python manage.py migrate
   python manage.py shell  # para probar Contrato
   ```
4. Frontend:
   ```
   cd Frontend/secop_frontend
   npm install
   npm run dev
   ```

## Arquitectura V2 — Decoupled + Flujo migrate → ETL → API
```
[datos.gov.co SODA 2.1 j13v-233n 5.98M] --$limit=50k & $offset + $order=:id + X-App-Token--> [Django Thread bulk_create 1000] --> [PostgreSQL local 15 cols indexadas]
[React filtros] --GET /api/optimized/resumen?depto=Boyaca--> [Django DRF] --JSON 50KB--> [React Recharts/Mapa/Tabla Virtual + Profiler 4 barras]
```
**Regla de oro V2:** `migrate` crea tabla vacía + índices → `cargar_secop` la llena (ETL Extract-Transform-Load) → `/api/resumen` la consulta. Sin `migrate` falla `relation does not exist`; sin ETL responde 0.

## Roadmap — Qué sigue (V2 + Backlog Notion)
- **Sesión 2 / Sprint 2:** ETL `cargar_secop` (SODA 2.1 `$limit=50k/$offset/$order=:id` + `X-App-Token` 10k req/h) + `ProcessingJob` Thread 202 Accepted + polling 1s + endpoints dual `/optimized/*` vs `/naive/*` + timing middleware
- **Sesión 3 / Sprint 3:** Dashboard React + filtros + `serie-mensual` (DATE_TRUNC) + mapa Leaflet coroplético + búsqueda tipo Google (debounce 300ms, abort) + cache TanStack Query
- **Sesión 4 / Sprint 4:** Grafo `react-force-graph` + **Profiler Dual 4 barras (BD | Python | TTFB | Render) + toggle Usuario/Ingeniería** + banderas rojas (NIT >30%, Directa >80%)
- **Sesión 5 / Buffer (Semana 5):** Pulido Tailwind, flujo demo en vivo, README/Swagger `/api/docs/`, video 3 min + pitch 45s, deploy local-first luego Render/Vercel

## ETL y Paginación SODA 2.1 (V2)
No descargar 5.98M de golpe. SODA 2.1 exige paginación: `?$limit=50000&$offset=50000&$order=:id&$where=departamento='Boyaca'` — 100 requests para 5M. Con `X-App-Token` en `.env` pasas de 1k a 10k req/h. Índices `CREATE INDEX idx_contrato_depto ON contrato(departamento)` pasan agregaciones de segundos a ms.

## Fuentes y Artefactos V2
- Dataset: https://www.datos.gov.co/resource/j13v-233n.json (SECOP II, 5.98M, 2.72M vistas, CC BY-SA 4.0)
- SODA 2.1 paginación: https://support.socrata.com (Tyler Tech, 2025 — $limit 50k + $offset)
- Guía SENA GFPI-F-135 V04 — Fase Desarrollo — ADSO 3171062
- Planificación local: `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V2 (ETL + Migraciones + Profiler Dual)
- Backlogs: `EstructuraSesion_v2.xlsx` (5 sesiones 6h) + `SECOP_Insight_Backlog_Notion.md`

---
*Última actualización: 02/09/2026 — V2 leída (ETL + Migraciones + Profiler Dual, pgAdmin 5432, SODA 2.1) + RF-01 validado — Autor: Steven Araque + Jarvis ⚡*
