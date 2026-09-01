# SECOP Insight — Observatorio de Contratación Pública SECOP II

> Inteligencia de negocios sobre 5.98M de contratos electrónicos | Django + PostgreSQL local + React
> Grupo 8 — ADSO 3171062 — Steven Alejandro Araque Castro | Yesid Amaya — Instructor Gustavo Jiménez Suancha — CIMM — Agosto-Septiembre 2026

## Objetivo del proyecto
Construir un Observatorio Ciudadano que ingiera masivamente contratos SECOP II desde `datos.gov.co` (dataset `j13v-233n`, 5.98M filas x 85 cols), los agregue en base de datos y los exponga en un dashboard React con KPIs, filtros, mapa coroplético, grafo de redes y banderas rojas, sin congelar el navegador. El patrón central es **agregar en BD y enviar solo <50KB** al frontend, no traer filas completas (anti-patrón de 100MB).

**Objetivo General (Guía 4 GFPI-F-135 V04)** — Construir la estructura de datos y la interfaz del software bajo arquitectura decoupled, demostrando el Stack completo en sesiones de explicación paso a paso.

## Stack Tecnológico
- **Backend:** Django 6.1 (CRM, ORM, Admin) + Django REST Framework
- **Base de datos:** PostgreSQL 18 local (localhost:5432) — *decisión del 01/09/2026: se descartó Supabase free 500MB por techo para 5.98M filas*
- **Frontend:** React 19.2.8 + Vite 5.4.21 + TanStack Query + Recharts + Leaflet
- **Control de versiones:** Git + GitHub
- **Gestión:** Notion (4 Sprints, 42 requisitos, 124 pts) + EstructuraSesion_v2.xlsx (5 sesiones)

## Estado actual — Cómo estamos trabajando
Metodología **Scrum** + **Guía 4: Proceso A (Desarrollo) + Proceso B (Transferencia de conocimiento)**.

- **Guía 4 completada en papel:** Product Backlog, requisitos y 5 sesiones de explicación ya diligenciadas en `EstructuraSesion_v2.xlsx` (Portada + Sesión 1 a 5) y 4 Sprints en Notion.
- **Infraestructura base lista (01/09/2026):**
  - `django-admin startproject secop_backend` ejecutado en `Backend/secop_backend/secop_backend/`
  - App `contratos` creada y registrada en `INSTALLED_APPS`
  - Conexión Postgres local configurada en `settings.py:DATABASES` (HOST localhost, PORT 5432, vía `.env`)
  - Migraciones base aplicadas (`admin`, `auth`, `contenttypes`, `sessions`)
- **RF-01 — Crear el modelo de datos — COMPLETADO y VALIDADO (01/09/2026):**
  - Modelo `Contrato` con 15 columnas en `contratos/models.py:1` — `nombre_entidad`, `nit_entidad`, `departamento`, `ciudad`, `orden`, `sector`, `id_contrato` (unique), `estado_contrato`, `codigo_categoria_principal`, `descripcion_del_proceso`, `valor_contrato` (Decimal 18,2), `fecha_firma` (DateField), `modalidad`, `contratista_nit`, `contratista_nombre`
  - 4 índices B-tree: `idx_contrato_depto`, `idx_contrato_modalidad`, `idx_contrato_fecha`, `idx_contrato_nit` — validado con `sqlmigrate` y `Django shell`
  - Pruebas en shell: creación válida `CO1-TEST-001` OK + rechazo de 3 decimales y fecha texto OK
  - Migración `0002_contrato_idx_*` aplicada — tabla `contrato` operativa con 1 registro de prueba

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

## Roadmap — Qué sigue (según EstructuraSesion_v2 + Backlog Notion)
- **Sesión 2 / Sprint 2:** ETL `cargar_secop` (SODA `$limit=50k/$offset` + `X-App-Token`) + `ProcessingJob` + endpoints agregados `/api/resumen`, `/api/top-contratistas` (<50KB)
- **Sesión 3 / Sprint 3:** Dashboard React + filtros + `serie-mensual` + mapa Leaflet + búsqueda tipo Google (debounce 300ms)
- **Sesión 4 / Sprint 4:** Grafo `react-force-graph` + banderas rojas (HAVING) + export CSV
- **Sesión 5 / Buffer:** Deploy local/producción + video 3 min + retro

## Fuentes
- Dataset: https://www.datos.gov.co/resource/j13v-233n.json (SECOP II Estadísticas Nacionales)
- Documentación Socrata: https://dev.socrata.com/docs/datatypes/text.html
- Guía SENA GFPI-F-135 V04 — Fase Desarrollo — ADSO 3171062

---
*Última actualización: 01/09/2026 — RF-01 validado — Autor: Steven Araque + Jarvis ⚡*
