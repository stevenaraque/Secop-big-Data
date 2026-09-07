# SECOP Insight — Observatorio de Contratación Pública SECOP II

> Inteligencia de negocios sobre 5.98M de contratos electrónicos | Django + PostgreSQL local + React | **V2 — ETL + Migraciones + Profiler Dual**
> Grupo 8 — ADSO 3171062 — Steven Alejandro Araque Castro | Yesid Amaya — Instructor Gustavo Jiménez Suancha — CIMM — Agosto-Septiembre 2026

## Objetivo del proyecto
Construir un Observatorio Ciudadano que ingiera masivamente contratos SECOP II desde `datos.gov.co` (dataset `jbjy-vk9h`, 5.98M filas x 85 cols), los agregue en base de datos y los exponga en un dashboard React con KPIs, filtros, mapa coroplético, grafo de redes y banderas rojas, sin congelar el navegador. El patrón central es **agregar en BD y enviar solo <50KB** al frontend, no traer filas completas (anti-patrón de 100MB).

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
  - Migraciones `0001`, `0002` aplicadas + `0003` limpieza duplicados `db_index` → 7 índices finales (`pkey` + `id_contrato` + 4 `idx_contrato_*`)
- **RF-25 — Entidad separada con FK — COMPLETADO (02/09/2026):**
  - Modelo `Entidad` con 5 cols `nombre_entidad`, `nit_entidad` (unique), `departamento`, `ciudad`, `sector` + `idx_entidad_nit` en `contratos/models.py:6`
  - `Contrato.entidad ForeignKey(Entidad, CASCADE, null=True, related_name="contratos")` + migración `0004_entidad_contrato_entidad` OK
  - Validado vía Admin: `ALCALDIA DE TUNJA - 891800123` + `CO1-RF25-001` con FK
  - `__str__` corregido fuera de `Meta` (antes dentro causaba Pyrefly `missing-attribute`)
- **RF-02 — Migraciones — COMPLETADO y LIMPIO (02/09/2026):**
  - `migrate zero` → `relation does not exist` verificado → `migrate` OK
  - `sqlmigrate 0001/0002` verificado, `DROP INDEX` duplicados ejecutado → 7 índices finales en `pg_indexes`
- **RF-03 — Registro — COMPLETADO y VALIDADO (07/09/2026):**
  - `users/serializers.py:1` `RegistroSerializer` español `nombre_usuario`/`correo`/`contrasena` → `source username/email/password` + `validate_correo` `exists()` + `create_user` PBKDF2 `pbkdf2_sha256$1500000$`
  - `users/views.py:1` `VistaRegistro` `CreateAPIView AllowAny` + `users/urls.py:1` `register/` + `secop_backend/urls.py:21` `api/auth/` → `POST 201` `{"id":2,"nombre_usuario":"alejo","correo":"alejo@test.com"}` sin `contrasena` y `400` duplicado, `python manage.py check` 0 issues, `runserver` OK, hash verificado en `shell` `User.objects.get(email="alejo@test.com")`
- **RF-04 — Login — COMPLETADO y VALIDADO (07/09/2026):**
  - `users/serializers.py:26` `InicioSesionSerializer` español `correo`/`contrasena` + `authenticate` + `RefreshToken.for_user` HS256 `users/views.py:12` `VistaLogin` `APIView AllowAny` `POST 200` `{"access":"eyJ...","refresh":"eyJ...","nombre_usuario","correo"}` + `400` `Credenciales inválidas.` sin revelar campo, `users/urls.py:6` `login/` → `api/auth/login/` verificado `Invoke-RestMethod` `access eyJhbGciOiJIUzI1...` OK y `400` clave mala OK, `SIMPLE_JWT` `ACCESS 1h / REFRESH 1d` `HS256` `Bearer` `jwt.io` `exp-iat=3600` OK, `check` 0 issues, `cspell.json` 40 palabras
- **RF-05 — Logout — COMPLETADO y VALIDADO (07/09/2026):**
  - `secop_backend/settings.py:34` `INSTALLED_APPS` + `token_blacklist` + `migrate` 0001-0013 OK + `REST_FRAMEWORK JWTAuthentication`, `users/serializers.py:50` `CierreSesionSerializer` `refresh` → `RefreshToken.blacklist()` + `users/views.py:22` `VistaLogout` `IsAuthenticated` `POST 205` `{"detalle":"Sesión cerrada correctamente."}`, `users/urls.py:7` `logout/` → `api/auth/logout/` verificado `Invoke-RestMethod` `205` con `Bearer eyJ...access` + `refresh eyJ...` OK. Sprint 1 Día 1 8/8 22pts CERRADO
- **RF-06 — ETL base — COMPLETADO y VALIDADO (07/09/2026):**
  - Ya se puede cargar datos reales: `TrabajoCarga` `trabajo_carga` `0005` + `SODA jbjy-vk9h` (antes `j13v-233n` daba 404 `dataset.missing`) + `requests==2.34.2` corregido
  - Comando `cargar_secop --limit 2` y `--limit 1 --depto Boyacá` con `bulk_create 1000` y `transaction.atomic` probados
  - `POST /api/cargar/ 202` con `Thread` y `GET /api/cargar/<id>/` con `Bearer` devuelven `pendiente → completado 2/2` verificado en `shell` `Contrato.objects.count()=6`
- **RF-06 — pulido .env — COMPLETADO (07/09/2026):**
  - `.env.example` y `.env` con `SODA_APP_TOKEN` plantilla vacía (RNF-02 sin hardcodear), `settings.py` con `load_dotenv()` y `python-dotenv==1.2.3`, `requirements.txt` limpio UTF-8, SODA v3 `api/v3/views/jbjy-vk9h/query.json` anotado (SODA 2.1 sigue vigente)

## Estructura de carpetas
```
Big data/
├── Backend/secop_backend/
│   ├── secop_backend/        # proyecto Django (settings.py, urls.py, wsgi.py)
│   │   ├── contratos/        # app RF-01+RF-25 (Contrato 15 cols + Entidad 5 cols + FK, migrations 0001-0004)
│   │   └── manage.py
│   ├── venv/                 # entorno virtual (Python 3.14.5, Django 6.1)
│   └── .vscode/settings.json # intérprete venv + pyrefly/pyproject
├── Frontend/secop_frontend/  # Vite + React (App.jsx, main.jsx)
├── SECOP_Backlog_Producto.xlsx (42 historias, RF-25)
├── SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx V2
└── README.md / CONTEXT.md (con Clave de Buenas Prácticas)
```

## Cómo levantar el proyecto en otro computador (desde cero)

**Requisitos previos:** `Git`, `Python 3.14`, `PostgreSQL 18 + pgAdmin`, `Node.js 20+` y `VS Code / Antigravity` con extensiones ya configuradas en `.vscode/settings.json`.

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

5. **Migraciones — crear tablas + índices (RF-01, RF-25, RF-02):**
   ```bash
   cd secop_backend
   python manage.py migrate
   # debe decir: Applying contratos.0001... OK hasta 0004 OK
   python manage.py createsuperuser  # para /admin
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

8. **Verificación final:** Abre `http://127.0.0.1:8000/admin`, entra con tu superuser y crea una `Entidad` y un `Contrato` de prueba (ver `CONTEXT.md:4`).

> **Nota:** No subas tu `.env` real. Solo `.env.example` está versionado. Si `migrate` falla con `relation does not exist`, revisa que tu `.env` apunta a `localhost:5432` y que `secop_db` existe en pgAdmin.

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
- **Sesión 5 / Buffer (Semana 5):** Pulido Tailwind, flujo demo en vivo, README/Swagger `/api/docs/`, video 3 min + pitch 45s, deploy local-first luego Render/Vercel

## ETL y Paginación SODA 2.1 (V2)
No descargar 5.98M de golpe. SODA 2.1 exige paginación: `?$limit=50000&$offset=50000&$order=:id&$where=departamento='Boyaca'` — 100 requests para 5M. Con `X-App-Token` en `.env` pasas de 1k a 10k req/h. Índices `CREATE INDEX idx_contrato_depto ON contrato(departamento)` pasan agregaciones de segundos a ms.

## Fuentes y Artefactos V2
- Dataset: https://www.datos.gov.co/resource/jbjy-vk9h.json (SECOP II, 5.98M, 2.72M vistas, CC BY-SA 4.0)
- SODA 2.1 paginación: https://support.socrata.com (Tyler Tech, 2025 — $limit 50k + $offset)
- Guía SENA GFPI-F-135 V04 — Fase Desarrollo — ADSO 3171062
- Planificación local: `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V2 (ETL + Migraciones + Profiler Dual)
- Backlogs: `EstructuraSesion_v2.xlsx` (5 sesiones 6h) + `SECOP_Insight_Backlog_Notion.md`
- Buenas prácticas: `Informe_Stack_Django_React (1).pdf` (57 págs, Grupo 8, Julio 2026 — SOLID, DRY, KISS, YAGNI, Clean Code, JWT/PBKDF2, CORS/CSRF, ORM, Git) — ver `CONTEXT.md:8` Clave Obligatoria

---
*Última actualización: 07/09/2026 — V2 + RF-01/02/25 + IDE fix + cSpell 40 palabras + RF-03/04/05 DONE + RF-06 ETL base DONE (TrabajoCarga 0005 + jbjy-vk9h + cargar_secop limit 2 + 202 Thread completado 2/2 + count=6) — Sprint 1 CERRADO — Siguiente: ETL pulido + resumen optimizado — Autor: Steven Araque + Jarvis ⚡*
