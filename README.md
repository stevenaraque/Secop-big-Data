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
- **RF-08 — resumen optimizado vs naive — COMPLETADO y VALIDADO completo (07/09/2026):**
  - `contratos/views.py:45` `VistaResumenOptimizado` `aggregate Count/Sum/Avg` con `idx_contrato_depto/modalidad/fecha` vs `VistaResumenNaive` `sum()` Python, `contratos/urls.py:1` `optimized/resumen/` + `naive/resumen/` → `GET /api/optimized/resumen/?depto=Boyacá&anio=2025&modalidad=Contratación directa` `Bearer` `optimizado True total 0` + `naive False total 7` + `todos total 10 suma 224M` `filtro {depto,anio,modalidad}` verificado `Invoke-RestMethod` OK, 3 filtros validado. Patrón 50KB vs 100MB `CONTEXT.md:12` validado
- **RF-09 — top contratistas — COMPLETADO y VALIDADO (07/09/2026):**
  - `contratos/views.py:92` `VistaTopContratistasOptimizado` `values contratista_nit/nombre + annotate Count/Sum GROUP BY` con `idx_contrato_nit` `order_by -suma_valor` vs `VistaTopContratistasNaive` `dict+sorted` Python, `contratos/urls.py:1` `optimized/top-contratistas/` + `naive/top-contratistas/` `?depto&limit` → `GET /api/optimized/top-contratistas/?limit=3` `Bearer` `top CONSORCIO PRUEBA RF25 75M` + `naive Boyacá METRICS Biomedical 18M` verificado `Invoke-RestMethod` OK. `GROUP BY` en BD validado
- **RF-11 — lista paginada + RF-10 — detalle — COMPLETADO y VALIDADO (07/09/2026):**
  - `contratos/serializers.py:1` `ContratoSerializer` 12 cols `ModelSerializer` + `contratos/views.py:103` `PaginacionContratos PageNumberPagination page_size 20 max 100` `LIMIT 20 OFFSET` en BD + `VistaListaContratos ListAPIView IsAuthenticated` `GET /api/contratos/?page=1` `?depto&modalidad` `filter order_by id` con `idx_contrato_depto` + `VistaDetalleContrato RetrieveAPIView lookup_field id_contrato` `GET /api/contratos/<str:id_contrato>/`, `contratos/urls.py:1` `contratos/` + `contratos/<str:id_contrato>/` verificado `Invoke-RestMethod` `Bearer` `count 10` y `count 1 Boyacá` OK. RNF-03 paginación en BD validado
- **RF-13 — filtros tabla — COMPLETADO y VALIDADO completo (07/09/2026):**
  - `contratos/views.py:115` `VistaListaContratos.get_queryset` `?depto&modalidad&fecha_desde&fecha_hasta` con `fecha_firma__gte/lte` `idx_contrato_fecha` en BD, `UnboundLocalError` por indentación (`fecha_desde` dentro de `if modalidad`) corregido a 4 espacios, verificado `Invoke-RestMethod` `Bearer` `?fecha_desde=2025-02-01&fecha_hasta=2025-02-28` `count 0` correcto y `?fecha_desde=2024-01-01&fecha_hasta=2024-12-31` `count 3` OK. Filtros `RF-13` validados
- **RF-14 — serie mensual — COMPLETADO y VALIDADO (08/09/2026):**
  - `contratos/views.py:147` `VistaSerieMensualOptimizado` `TruncMonth fecha_firma` `DATE_TRUNC month` con `idx_contrato_fecha` `values mes` `annotate Count/Sum` `GROUP BY mes` `order_by mes`, `contratos/urls.py:1` `optimized/serie-mensual/` `?depto` `IsAuthenticated` `Bearer`, `NameError Count` por falta de `import Count, Sum` corregido por Steven `views.py:1` `from django.db.models import Count, Sum`, verificado `Invoke-RestMethod` `Bearer` `GET api/optimized/serie-mensual/?depto=Boyacá` `serie [{mes:2022-09-01, total:1, suma:18992400}]` OK. Tendencia mensual en BD validada
- **RF-07 — monitoreo ingesta — COMPLETADO y VALIDADO (07/09/2026):**
  - `contratos/admin.py:12` `TrabajoCargaAdmin` `list_display id/estado/procesados/total/offset/creado_en` `list_filter estado` + `contratos/views.py:92` `VistaListarCargas` `GET api/cargar/listar/` + `VistaEstadoCarga` `GET api/cargar/<id>/` `IsAuthenticated` polling 1s, `contratos/urls.py:1` `cargar/listar/` verificado `Invoke-RestMethod` `Bearer` `listar 9 completado 2/2` + `admin` `9 trabajo cargas` `Completado 2/2` `7 Completado 0/0` bug `--trabajo-id` corregido. Monitoreo + `offset_actual` para reanudar validado
- **RF-15 — mapa contratación directa — COMPLETADO y VALIDADO (09/09/2026):**
  - `contratos/services.py:55` `mapa_directa_optimizado` `GROUP BY departamento` + `Count filter directa` + `Sum` con fusión por clave normalizada (Boyaca+Boyacá → total 2, 50%) y nombres bonitos con tilde + `contratos/views.py:158` `VistaMapaDirectaOptimizado` + `contratos/urls.py:15` `optimized/mapa-directa/` verificado `Invoke-RestMethod` `Bearer` `Bogotá 3/66.67%` + `Boyacá 2/50%` + `Meta/Antioquia/Cesar/Valle/Bolívar 100%` OK
  - `Frontend/secop_frontend/src/pages/MapaDirecta.jsx:1` Leaflet 1.9.4 + `STOPS` papel→rojo oscuro + `POR_ID` 33 territorios (evita Ñ rota) + tooltip monto/% + `fitBounds` vista completa + zoom rueda/botones + clic filtra dashboard (RF-16), `MapaRF15.css` transparente solo territorios, `Dashboard.jsx` organizado en secciones KPIs→mapa→detalle con `tabular-nums` y estados error/vacío, verificado `npm run build` 356ms + `manage.py check` 0 issues + visual Ctrl+F5 OK
- **RF-16 — clic en mapa filtra dashboard — COMPLETADO y VALIDADO (09/09/2026):**
  - `MapaDirecta.jsx` selección con `selKeyRef` + resaltado borde oscuro 2.4 + `VER TODO` + clic en mar limpia (`setDepto("")`), `Dashboard.jsx` `deptoActivo` sincroniza mapa↔select, dropdown dinámico desde `mapa-directa` (7 territorios con conteo, antes solo 4 fijos), `services.py` `_variantes/_filtrar_depto` tolera tildes (`Boyacá` cuenta `Boyaca+Boyacá` → resumen `total 2`) y `views.py` lista combina `depto` con `modalidad/fechas`, verificado `check` 0 issues + `build` 369ms + clic Meta/Boyacá con KPIs recalculados OK. Errores del día en `ERRORES.md`
- **RF-18 — búsqueda global — COMPLETADO y VALIDADO (09/09/2026):**
  - `contratos/services.py` `buscar` `Q icontains` en `contratista_nombre/nit` + `nombre_entidad` + `descripcion` con `LIMIT 10` por grupo + `contratos/views.py` `VistaBuscar` `IsAuthenticated` + `contratos/urls.py` `buscar/`, `Frontend/secop_frontend/src/pages/Buscador.jsx` debounce 300ms + `AbortController` + vacío sin error integrado arriba del Dashboard, verificado `metric` 200/435B 1 petición + `zzz` 200/51B + `check` 0 issues + `build` OK
- **RF-19 — banderas rojas de concentración — COMPLETADO y VALIDADO (10/09/2026):**
  - `contratos/services.py` `banderas_concentracion(umbral=30, depto=None)` doble `GROUP BY` (total por entidad + monto por contratista) + `% = monto×100/total` solo `>= umbral` ordenado desc + `_filtrar_depto` con tildes, `contratos/views.py` `VistaBanderasConcentracion` `IsAuthenticated` `?umbral=&?depto=` + 400 si umbral inválido, `contratos/urls.py` `banderas-concentracion/`, `Frontend/secop_frontend/src/pages/Banderas.jsx` tabla contratista/entidad/%/monto/contratos + input umbral 1-100 con TanStack Query + vacío sin banderas, verificado umbral 30 → 10 banderas + umbral 50 recalcula + `abc` 400 + Nariño total 0 + Boyacá total 2 + `check` 0 issues + `build` 2.35s OK
- **RF-20 — predominio contratación directa — COMPLETADO y VALIDADO (10/09/2026):**
  - `contratos/services.py:137` `predominio_directa(umbral=80, depto=None)` `GROUP BY nombre_entidad` + `Count filter directa` + `% = directas×100/total` solo `>= umbral` ordenado desc + `_filtrar_depto`, `contratos/views.py:189` `VistaPredominioDirecta` `IsAuthenticated` `?umbral=&?depto=` + 400 si inválido, `contratos/urls.py:18` `predominio-directa/`, `Frontend/secop_frontend/src/pages/PredominioDirecta.jsx` tabla entidad/% directa/directas/monto + input 1-100 + TanStack `["predominio", umbral, depto]` + vacío sin banderas integrado en `Dashboard.jsx`, verificado 80→8 + 50→8 + Boyacá→1 + `abc` 400 + `check` 0 issues + `build` 362ms OK
- **RF-24 — umbrales admin persistentes — COMPLETADO y VALIDADO (11/09/2026):**
  - `contratos/models.py` `UmbralAlerta` `umbral_alerta` + `0006_umbralalerta.py` OK, `contratos/services.py` `obtener/listar/actualizar_umbral` con `get_or_create` + valida `0<valor<=100`, `contratos/views.py` `VistaListarUmbrales` + `VistaActualizarUmbral` PUT/PATCH + `VistaBanderas/Predominio` usan BD si no mandan `?umbral=`, `contratos/urls.py` `umbrales/` + `umbrales/<nombre>/`, `Frontend/.../Umbrales.jsx` lista + Guardar + invalida `banderas/predominio` sin reinicio integrado en `Dashboard.jsx`, verificado listar 30/80 + guardar 58/59 + `abc` 400 + `check` 0 issues + `build` 2.36s OK
- **RF-28 — lista de entidades — COMPLETADO y VALIDADO (11/09/2026):**
  - `contratos/serializers.py` `EntidadSerializer`, `contratos/views.py` `VistaListaEntidades` orden `nombre_entidad` + `?q=` nombre/NIT + `PaginacionEntidades` 20 máx 100 + 400 fuera de rango, `contratos/urls.py` `entidades/`, `Frontend/.../Entidades.jsx` tabla + buscador + paginación en `Dashboard.jsx`
- **RF-27 — estadísticas por entidad — COMPLETADO y VALIDADO (11/09/2026):**
  - `contratos/services.py` `estadisticas_por_entidad(nit/id/depto/fechas)` por MODELO con fallback texto ETL + `total/total_contratado/por_modalidad/top5`, `contratos/views.py` `VistaEstadisticasEntidad`, `contratos/urls.py` `por-entidad/`, clic en entidad muestra stats + 0 sin error si no existe, verificado `q=TUNJA` 1 + `nit=891800123` 1/75M directa + `NOEXISTE` 0 + `page=9999` 400 + `check` 0 + `build` 2.23s OK
- **RF-17 — grafo de conexiones — COMPLETADO y VALIDADO (11/09/2026):**
  - `contratos/services.py` `grafo_red(limit=50/depto)` top montos máx 200 + `grosor log` + `color por modalidad` (roja directa, verde licitación), `contratos/views.py` `VistaGrafoRed`, `contratos/urls.py` `grafo/`, `Frontend/.../Grafo.jsx` `react-force-graph-2d` con zoom/drag/pan + tooltip monto + input límite en `Dashboard.jsx`, verificado limit 5→5 aristas/10 nodos + `check` 0 + `build` 4.73s OK
- **RF-21 — exportar CSV — COMPLETADO y VALIDADO (11/09/2026):**
  - `contratos/views.py` `VistaExportarContratos` mismos filtros tabla + `utf-8 BOM` + punto decimal + `iterator chunk 2000`, `contratos/urls.py` `exportar/`, botón ⬇ CSV en `Dashboard.jsx` con `depto` actual, verificado `Boyacá`→cabecera+2 filas (fusiona Boyaca+Boyacá) + `NarniaXYZ`→solo cabecera + `check` 0 + `build` 466ms OK

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
*Última actualización: 11/09/2026 — V2 + RF-01/02/25 + RF-03/04/05 DONE + RF-06 DONE + RF-08/09/11/10/13 DONE + RF-07 DONE + RF-12 DONE + RF-14 DONE + RF-15 mapa DONE + RF-16 clic-filtra DONE + RF-18 búsqueda DONE + RF-19 banderas DONE + RF-20 predominio DONE + RF-24 umbrales DONE + RF-28 entidades DONE + RF-27 por-entidad DONE + RF-17 grafo DONE + RF-21 exportar DONE (Boyacá 2 filas, vacío cabecera) — Sprint 4 — Siguiente: RF-22 recuperar contraseña — Autor: Steven Araque*
