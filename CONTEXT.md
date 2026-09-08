# CONTEXT.md — Memoria viva del proyecto SECOP Insight

> Este archivo es la memoria del agente y del equipo. Aquí se registra cómo pensamos, por qué decidimos y en qué estado real está el proyecto. Léelo antes de cualquier sesión de explicación.

## 1. Quiénes somos y cómo trabajamos
- **Equipo:** Grupo 8 ADSO 3171062 — Steven Alejandro Araque Castro (dev principal, principiante guiado) y Yesid Amaya — Instructor Gustavo Jiménez Suancha (CIMM).
- **Asistente:** Jarvis ⚡ — rol docente, explica en párrafos cortos con ejemplo literal, no toca carpetas sin autorización explícita. Principio: Texto > Cerebro (todo lo importante va a archivo).
- **Metodología:** Scrum + Guía 4 SENA (GFPI-F-135 V04). Dos procesos en paralelo: **A) Desarrollo** del observatorio y **B) Transferencia** — cada funcionalidad se explica paso a paso a compañeros usando el propio proyecto como medio de aprendizaje (10 pasos por sesión).
- **Gestión:** Notion con 4 Sprints (S1 30h/22pts, S2 33h/33pts, S3 30h/33pts, S4 18h/28pts + Buffer 39h/8pts = 124 pts, 42 requisitos). Sesiones formales en `EstructuraSesion_v2.xlsx` (5 sesiones × 6h, verificado 02/09/2026) + planificación V2 en `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx`.

## 2. El problema que resolvemos (V2)
Colombia publica 5.98M de contratos en SECOP II con 85 columnas planas que crecen diario. Un ciudadano que intenta abrir el CSV en Excel colapsa su equipo; filtrar por departamento o contratista exige descargar gigabytes y programar. No existe una herramienta ligera que ingiera 500k+ registros, los procese en servidor y entregue solo métricas agregadas (<50KB) a un dashboard sin congelar el navegador **y además muestre a qué velocidad se procesó cada capa**. Nuestra tesis V2: **traer filas al front es anti-patrón (100MB por filtro); enviar agregados SUM/COUNT/GROUP BY desde PostgreSQL es el patrón correcto (50KB, 2000× menos) y el profiler dual lo demuestra (Naive 8200ms vs Optimizado 280ms).**

## 3. Decisiones de arquitectura y por qué (V2)
- **PostgreSQL 18 local pgAdmin 5432 (no Supabase) — decisión V2 02/09/2026:** Supabase free limita a 500MB y con 5.98M filas + índices se llena en la primera ingesta. Postgres local nos da sin techo, `bulk_create batch 1000` sin timeout y sin lío de Session Pooler/IPv6 del SENA, con acceso directo vía pgAdmin y 100 páginas SODA de 50k para 5.98M. `.env` no versionado. Doc V2 confirma `Django 5.0.14` target (instalado 6.1 funciona igual).
- **15 de 85 columnas (RF-01):** No es recorte arbitrario, es MVP para alimentar KPIs, filtros, mapa y grafo. El resto (representante legal, banco, saldo CDP, etc.) es ruido y se ignora en el ETL. Mapeo Socrata truncado respetado: `valor_del_contrato` -> `valor_contrato`, `fecha_de_firma` (floating_timestamp) -> `fecha_firma` (DateField, `.date()`), `modalidad_de_contratacion` -> `modalidad`, `documento_proveedor` -> `contratista_nit`, `proveedor_adjudicado` -> `contratista_nombre`. Los nombres truncados `justificacion_modalidad_de` y `liquidaci_n` son los reales SODA 2.1.
- **SODA 2.1 paginación:** `$limit=50k max` + `$offset` + `$order=:id` + `X-App-Token` (10k req/h). Para 5.98M son 120 requests; demo 100k-500k son 2-10 páginas por tiempo de clase.
- **Migraciones vs ETL — regla de oro V2:** `migrate` crea tabla vacía + índices (estructura versionada `0001_initial.py`); ETL `cargar_secop` la llena (datos, `bulk_create`). Sin `migrate` falla `relation does not exist`; sin ETL `/api/resumen` responde 0. Orden: `makemigrations` → `migrate` → `cargar_secop`.
- **Profiler dual 4 barras:** `Tiempo BD | Serialización Python | TTFB Red | Render React` — Vista Usuario ve KPIs, Vista Ingeniería ve desglose ms. Comparativa `Naive SELECT * 8200ms` vs `Optimizado aggregate 280ms` (29×).
- **Modelo `Contrato` plano primero, FK después:** RF-01 exige tabla plana para verificación. Normalización a `Entidad` FK en Sesión 4/RF-25.
- **4 índices B-tree obligatorios:** `departamento`, `modalidad`, `fecha_firma`, `contratista_nit` — sin ellos agregación pasa de 40ms a 3s con 100k.
- **Tipos estrictos:** `valor_contrato` Decimal(18,2) y `fecha_firma` DateField probados con `full_clean()`.

## 4. Estado real al 07/09/2026 — Validado en ejecución
- **Infra:** `Backend/secop_backend/secop_backend/` con `manage.py`, apps `contratos` + `contratos.Entidad` + `users` registradas, `migrate` OK (0001, 0002, 0003 limpieza, 0004 Entidad+FK). Tabla `contrato` con 7 índices finales (pkey + id_contrato + 4 idx_contrato_*), duplicados `db_index` eliminados vía `DROP INDEX`.
- **Modelos:** `contratos/models.py:1` con `Contrato` (15 cols) + `Entidad` (5 cols, `db_table="entidad"`, `idx_entidad_nit`) + `Contrato.entidad ForeignKey(Entidad, CASCADE, null=True)` + `__str__` corregido fuera de `Meta`.
- **Auth RF-03 DONE (07/09/2026):** `users/serializers.py:1` `RegistroSerializer` en español (`nombre_usuario`/`correo`/`contrasena` → `source="username/email/password"`), `validate_correo` `exists()` + `create_user` PBKDF2 `pbkdf2_sha256$1500000$` verificado en shell, `users/views.py:1` `VistaRegistro` `CreateAPIView AllowAny`, `users/urls.py:1` `register/` + `secop_backend/urls.py:21` `api/auth/` → `POST 201` `{"id":2,"nombre_usuario":"alejo","correo":"alejo@test.com"}` sin `contrasena` (`write_only`) y `400` duplicado OK. `python manage.py check` 0 issues, `runserver` OK.
- **Auth RF-04 DONE (07/09/2026):** `users/serializers.py:26` `InicioSesionSerializer` en español (`correo`/`contrasena` → `authenticate` + `RefreshToken.for_user` HS256), `users/views.py:12` `VistaLogin` `APIView AllowAny` `POST 200` `{"access":"eyJ...","refresh":"eyJ...","nombre_usuario","correo"}` + `400` `Credenciales inválidas.` sin revelar campo (OWASP), `users/urls.py:6` `login/` → `api/auth/login/` verificado `Invoke-RestMethod` `access eyJhbGciOiJIUzI1...` OK y `400` clave mala OK. `check` 0 issues. Archivo suelto `RegistroSerializer.py` borrado, `Pyrefly` limpio, `cspell.json` 40 palabras.
- **Auth RF-05 DONE (07/09/2026):** `secop_backend/settings.py:34` `INSTALLED_APPS` + `token_blacklist` + `migrate` 0001-0013 OK + `SIMPLE_JWT` `ACCESS 1h / REFRESH 1d` `HS256` `Bearer` + `REST_FRAMEWORK JWTAuthentication`, `users/serializers.py:50` `CierreSesionSerializer` `refresh` → `RefreshToken.blacklist()` + `users/views.py:22` `VistaLogout` `IsAuthenticated` `POST 205` `{"detalle":"Sesión cerrada correctamente."}`, `users/urls.py:7` `logout/` → `api/auth/logout/` verificado `Invoke-RestMethod` `205` con `Bearer eyJ...access` + `refresh eyJ...` OK y `exp-iat=3600` `jwt.io` HS256 OK. `check` 0 issues. Sprint 1 Día 1 8/8 22pts cerrado.
- **ETL RF-06 ETL base DONE (07/09/2026):** `contratos/models.py:53` `TrabajoCarga` `trabajo_carga` + `0005_trabajocarga.py` OK, `SODA_URL jbjy-vk9h` corregido (antes `j13v-233n` 404 `dataset.missing`) + `requests==2.34.2`, `management/commands/cargar_secop.py:1` `--limit/--offset/--depto/--trabajo-id` + `bulk_create 1000` `transaction.atomic` + `contratos/views.py:1` `VistaIniciarCarga 202` `Thread` + `VistaEstadoCarga` polling + `contratos/urls.py:1` `api/cargar/` verificado `POST 202 id 9 pendiente` → `GET completado 2/2` + `shell` `Contrato.objects.count()=6` (Boyacá/Bogotá/Bolívar).
- **ETL RF-06 pulido .env DONE (07/09/2026):** `.env.example:8` + `.env:8` `SODA_APP_TOKEN` plantilla vacía (RNF-02 sin hardcodear, 1k req/h sin token → 10k con token), `settings.py:16` `load_dotenv()` + `python-dotenv==1.2.3` `check 0 silenced`, `SODA v3` `https://www.datos.gov.co/api/v3/views/jbjy-vk9h/query.json` anotado (SODA 2.1 `resource/jbjy-vk9h.json` sigue vigente 200), `requirements.txt` limpio UTF-8 sin duplicados.
- **API RF-08 resumen DONE completo (07/09/2026):** `contratos/views.py:45` `VistaResumenOptimizado` `IsAuthenticated` `aggregate Count/Sum/Avg` con `idx_contrato_depto/modalidad/fecha` + `VistaResumenNaive` `sum()` Python, `contratos/urls.py:1` `optimized/resumen/` + `naive/resumen/` → `GET api/optimized/resumen/?depto=Boyacá&anio=2025&modalidad=Contratación directa` verificado `Invoke-RestMethod` `Bearer` `optimizado True total 0` + `naive False total 7` + `todos total 10 suma 224M` + `filtro {depto,anio,modalidad}` OK. RF-08 3 filtros validado.
- **Monitoreo RF-07 DONE (07/09/2026):** `contratos/admin.py:12` `TrabajoCargaAdmin` `list_display id/estado/procesados/total/offset/creado_en` `list_filter estado` + `contratos/views.py:92` `VistaListarCargas` `GET api/cargar/listar/` `IsAuthenticated` + `VistaEstadoCarga` `GET api/cargar/<id>/` polling 1s, verificado `Invoke-RestMethod` `Bearer` `listar 9 completado 2/2` + `admin` `9 trabajo cargas` `9 Completado 2/2` + `7 Completado 0/0` bug corregido con `--trabajo-id`. RF-07 monitoreo + reanudación `offset_actual` validado.
- **Top RF-09 DONE (07/09/2026):** `contratos/views.py:92` `VistaTopContratistasOptimizado` `values+annotate Count/Sum` `GROUP BY contratista_nit` con `idx_contrato_nit` + `order_by -suma_valor` vs `VistaTopContratistasNaive` `dict+sorted` Python, `contratos/urls.py:1` `optimized/top-contratistas/` + `naive/top-contratistas/` `?depto&limit` → `GET api/optimized/top-contratistas/?limit=3` verificado `Bearer` `top 3` `CONSORCIO PRUEBA RF25 75M` + `naive Boyacá 1 METRICS Biomedical 18M` OK. Patrón `GROUP BY` en BD validado.
- **Pulido PRO DONE (07/09/2026):** `users/services.py:1` `ServicioUsuarios` `registrar/autenticar/crear_tokens/invalidar_refresh` con `DIP` `modelo_usuario` inyectable + `contratos/services.py:1` `ServicioContratos` `resumen_optimizado/naive` + `top_optimizado/naive` con `DIP` `modelo` inyectable, `users/serializers.py` y `contratos/views.py` adelgazadas a 10 líneas `SRP` `Service Layer`, `secop_backend/settings.py:36` `corsheaders` `CORS_ALLOWED_ORIGINS localhost:5173` `CSRF_TRUSTED_ORIGINS` `CORS_ALLOW_CREDENTIALS True` sin `ALLOW_ALL`, `REST_FRAMEWORK` `Anon 20/min User 100/min` `RNF-06` throttling, `check 0 silenced` + `shell servicio_contratos` `total 10` OK.
- **Pruebas shell (Python 3.14.5, Django 6.1, venv, PostgreSQL 18 local pgAdmin 5432):** `Contrato.objects.create` OK, `full_clean` rechaza `Decimal 123.456` y `"no es fecha"`, `migrate zero` → `relation does not exist` → `migrate` OK, `Entidad` + `Contrato(entidad=ent)` OK, `User.objects.get(email="alejo@test.com").password` → `pbkdf2_sha256$` verificado, `cargar_secop --limit 2` OK, `jbjy-vk9h` `Boyacá` con tilde OK.
- **Calidad BD:** `SELECT indexname FROM pg_indexes WHERE tablename='contrato'` → 7 índices limpios — duplicados borrados, `trabajo_carga` con `ordering -creado_en`.
- **IDE:** `.vscode/settings.json`×3 corregidos a `C:/...` forward-slash + `cSpell.language en,es` + `cspell.json` 40 palabras, `pyproject.toml` OK. Antigravity/VS Code reload OK.
- **Frontend:** Scaffold Vite+React en `Frontend/secop_frontend/` sin dashboard aún (Sesión 3).

## 5. Cómo enseñamos (acuerdo con Steven)
- Explicación en párrafos cortos, no en bullet infinito. Cada paso va con el código literal para copiar en el chat y el por qué en párrafo aparte.
- No se toca ninguna carpeta sin "sí, te autorizo". Cada `makemigrations`, `migrate` o escritura de archivo se pide permiso y se verifica con ejecución.
- Retroalimentación constante: se celebra el acierto (mayúscula de `Contrato`) y se corrige el detalle (tabla `contrato` no `contraro`, `__str__(self)` no "toma lo del archivo").

## 6. Próximos pasos inmediatos (Sprint 1 CERRADO 8/8 + Sprint 2 RF-06/08 DONE 07/09)
1. **RF-03 Registro DONE (07/09)** — `RegistroSerializer` + `VistaRegistro` + `201/400` PBKDF2 verificado.
2. **RF-04 Login DONE (07/09)** — `InicioSesionSerializer` + `VistaLogin` + `200` `eyJ...` / `400` verificado + `SIMPLE_JWT` `1h/1d` `HS256` `Bearer` `jwt.io` `exp-iat=3600` OK.
3. **RF-05 Logout DONE (07/09)** — `CierreSesionSerializer` + `VistaLogout` `205` `Sesión cerrada` + `token_blacklist` `migrate` 0001-0013 OK.
4. **RF-06 ETL base + pulido .env DONE (07/09)** — `TrabajoCarga` `0005` + `cargar_secop` `jbjy-vk9h` `limit 2` `Boyacá` + `202 Thread` `completado 2/2` + `SODA_APP_TOKEN` `load_dotenv`.
5. **RF-08 resumen DONE (07/09)** — `VistaResumenOptimizado` `aggregate` 50KB vs `VistaResumenNaive` `sum()` 100MB verificado `Boyacá 1` y `todos 10`. Siguiente: `RF-09 top contratistas` por monto.

## 7. Fuentes y artefactos (V2)
- `Observatorio_SECOP_II_Definicion_Proyecto.pdf` (definición 6 páginas, base Guía 4)
- `GFPI-F-135-Guia4-DesarrolloExplicación.pdf` (Guía 4 V04, Fase Desarrollo)
- `EstructuraSesion_v2.xlsx` (5 sesiones × 6h, 150h plan, verificado 02/09)
- `SECOP_Insight_Planificacion_Proyecto_ADSO3171062_Grupo8.docx` V2 — ETL + Migraciones + Profiler Dual, pgAdmin 5432, SODA 2.1 (nuevo 02/09)
- `SECOP_Backlog_Producto.xlsx` (backlog actualizado, pull 02/09)
- `SECOP_Insight_Backlog_Notion.md` / `.csv` (58 pts refinado)
- Dataset SODA 2.1 `jbjy-vk9h` — 5.98M × 85 cols, columnas verificadas vía `schema-column-preview`

## 8. 🔑 Clave de Buenas Prácticas — Obligatoria para quien lea este proyecto
> **Si vas a tocar este código, léelo sí o sí. Sin esto, el proyecto se rompe en 2 sprints. Fuente: `Informe_Stack_Django_React (1).pdf` (57 págs, Guía 1, Grupo 8, Julio 2026).**

Esta clave resume tu PDF largo en 8 reglas no negociables. No son opcionales para aprobar Guía 4 — salen de los Bloques 6 a 8 del informe.

**1. Separación de dominios (Clean Arch + Capas + Hexagonal — Bloque 4):**
- Cliente-Servidor + REST es la base obligatoria: React (cliente, `localhost:3000`) ↔ Django (servidor, `localhost:8000`) vía HTTP JSON. No hay alternativa.
- `contratos` guarda `Contrato + Entidad` y su `ForeignKey` (mismo dominio SECOP, relación 1-N). No mezcles `User` aquí.
- `users` guardará `Registro/Login/Logout` y `SimpleJWT` (dominio identidad). Arquitectura en capas: presentación (vistas/serializers) → aplicación (servicios) → datos (ORM). Así evitas "vistas gordas" de 100 líneas.

**2. SOLID + DRY + KISS + YAGNI (Bloque 6):**
- **SOLID:** SRP separa `InterpretacionService` de `ProyectoRepository` y `DictadoView`; OCP permite cambiar de Gemini a otro LLM con nuevo adaptador sin tocar servicio; LSP permite intercambiar estrategias (diccionario vs IA); ISP serializador solo con campos necesarios; DIP inyecta proveedor IA para testear con mock.
- **DRY:** Un solo diccionario central para `abre paréntesis → (` y un solo hook de voz, no copias dispersas.
- **KISS:** Usa `SimpleJWT` y `Context API`, no Redux ni motor NLP complejo si no lo necesitas.
- **YAGNI:** MVP con 2 roles (`usuario` y `admin`), sin sistema de plugins ni pipeline CI/CD multi-etapa. No construyas lo que no necesitas hoy.

**3. Migraciones vs ETL — nunca al revés (Bloque 8):**
- `makemigrations` → `migrate` crea tabla vacía + índices (versiona esquema, `0001-0004` ya aplicados). `cargar_secop` la llena con `bulk_create batch 1000` (datos). Si inviertes el orden verás `relation does not exist`. Orden: `migrate` → `cargar_secop` → `/api/resumen`.

**4. Nunca hardcodees secretos (Bloque 7):**
- `DB_PASSWORD`, `SODA_TOKEN` (`X-App-Token`), `SECRET_KEY` y `JWT_SECRET` van en `.env` con `os.getenv` / `python-dotenv`. El `.env` nunca se versiona (`.gitignore`), solo `.env.example`. El commit `42dd803` ya corrigió el `PASSWORD='1057585950'` quemado. En prod, `HTTPS/TLS 1.3` obligatorio — Render/Vercel lo da con Let's Encrypt.

**5. Seguridad por defecto (Bloque 7 — OWASP Top 10):**
- **Hashing:** `PBKDF2` con 390k iteraciones (Django default, no texto plano) — RF-03/04 ya lo usa vía `create_user`.
- **JWT:** `HS256`, `access 1h / refresh 1d`, `Authorization: Bearer` — no en `localStorage` sin protección, expiración corta, refresh para renovar.
- **CORS:** `django-cors-headers` solo al dominio del frontend, nunca `ALLOW_ALL = ["*"]`.
- **CSRF:** Activo con token rotativo, aunque uses JWT sigue si usas cookies.
- **XSS:** React escapa por defecto, nunca uses `dangerouslySetInnerHTML` sin sanitizar.
- **SQLi:** Usa ORM parametrizado, nunca `.raw()` con strings formateados. Valida permisos a nivel objeto: `get_queryset().filter(user=request.user)`.

**6. Nombres, tipos e índices estrictos (PEP 8 + Clean Code + Bloque 8):**
- Clases `PascalCase` (`Contrato`, `Entidad`), tablas `snake_case` (`contrato`, `entidad`), índices `idx_contrato_*`. `Decimal(18,2)` y `DateField` con `full_clean()` — si aceptas 3 decimales o texto en fecha, fallas RF-01. Código formateado con `Ruff/Black` (Python) y `Prettier/ESLint` (React) vía pre-commit.

**7. Un índice = un propósito (Bloque 8 — Índices):**
- Sin índice → full table scan; con índice → acceso directo. Define en `Meta.Index` y evita `db_index=True` duplicado. Duplicar deja 13 índices donde bastan 7 y ralentiza `bulk_create`. Ya limpiamos 6 duplicados con `DROP INDEX`. Usa `transaction.atomic()` para integridad (Unit of Work).

**8. Trabajo profesional (Bloques 5 y 9 — Patrones + Git):**
- **Patrones que sí usamos (13/14):** `Builder` (QuerySets encadenados), `Facade` (Serializers), `Decorator` (`@api_view`), `Proxy` (Nginx/backend como proxy a IA), `Observer` (Signals/`useEffect`), `Strategy` (diccionario vs IA), `Command` (`manage.py`), `Repository` (centraliza ORM), `Unit of Work` (`atomic`), `Dependency Injection` (inyecta proveedor IA), `Service Layer` (evita vistas gordas). `CQRS` no aplica (sobreingeniería para 42 requisitos).
- **Git:** Monorepo `Big data/` con ramas `feature/*`, commits con historia, PR con code review, `requirements.txt`/`package.json` bloqueados (`pip install`/`npm install` reproducibles). Pruebas `pytest-django` (backend) y `Jest + React Testing Library` (frontend) — unitarias, integración, E2E con Playwright.

**Fuente completa:** `Informe_Stack_Django_React (1).pdf` en `Big data/` — Bloques 1-13 con historia Django/React, componentes, paradigmas (declarativa/funcional en React, OOP en Django), arquitecturas y comparación MERN/.NET/Spring.

---
*Actualizado: 07/09/2026 — V2 + RF-01/25/02 + IDE fix + cSpell 40 palabras + RF-03/04/05 DONE + RF-06 base+pulido DONE + RF-08 resumen DONE (optimizado True 1 vs naive False 1 y todos 10) — Sprint 1 CERRADO — Siguiente: RF-09 top contratistas — Clave OK.*
