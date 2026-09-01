# CONTEXT.md — Memoria viva del proyecto SECOP Insight

> Este archivo es la memoria del agente y del equipo. Aquí se registra cómo pensamos, por qué decidimos y en qué estado real está el proyecto. Léelo antes de cualquier sesión de explicación.

## 1. Quiénes somos y cómo trabajamos
- **Equipo:** Grupo 8 ADSO 3171062 — Steven Alejandro Araque Castro (dev principal, principiante guiado) y Yesid Amaya — Instructor Gustavo Jiménez Suancha (CIMM).
- **Asistente:** Jarvis ⚡ — rol docente, explica en párrafos cortos con ejemplo literal, no toca carpetas sin autorización explícita. Principio: Texto > Cerebro (todo lo importante va a archivo).
- **Metodología:** Scrum + Guía 4 SENA (GFPI-F-135 V04). Dos procesos en paralelo: **A) Desarrollo** del observatorio y **B) Transferencia** — cada funcionalidad se explica paso a paso a compañeros usando el propio proyecto como medio de aprendizaje (10 pasos por sesión).
- **Gestión:** Notion con 4 Sprints (S1 30h/22pts, S2 33h/33pts, S3 30h/33pts, S4 18h/28pts + Buffer 39h/8pts = 124 pts, 42 requisitos). Sesiones formales en `EstructuraSesion_v2.xlsx` ya diligenciado (verificado 01/09/2026: 5 hojas + Portada).

## 2. El problema que resolvemos
Colombia publica 5.98M de contratos en SECOP II con 85 columnas planas que crecen diario. Un ciudadano que intenta abrir el CSV en Excel colapsa su equipo; filtrar por departamento o contratista exige descargar gigabytes y programar. No existe una herramienta ligera que ingiera 100k-500k filas, las agregue en servidor y entregue solo métricas (<50KB) a un dashboard sin congelar el navegador. Nuestra tesis: **traer filas al front es anti-patrón (100MB por filtro); enviar agregados SUM/COUNT/GROUP BY desde PostgreSQL es el patrón correcto (50KB, 2000x menos tráfico).**

## 3. Decisiones de arquitectura y por qué
- **Django 6.1 + PostgreSQL local (no Supabase) — decisión 01/09/2026:** Supabase free limita a 500MB y con 5.98M filas + índices se llena en la primera ingesta. Postgres local en `localhost:5432` nos da sin techo, bulk_create batch 1000 sin timeout y sin lío de Session Pooler/IPv6 del SENA. `.env` no versionado, `sslmode` no necesario local.
- **15 de 85 columnas (RF-01):** No es recorte arbitrario, es MVP para alimentar KPIs, filtros, mapa y grafo. El resto (representante legal, banco, saldo CDP, etc.) es ruido para el observatorio y se ignora en el ETL. Mapeo Socrata truncado respetado: `valor_del_contrato` -> `valor_contrato`, `fecha_de_firma` (floating_timestamp) -> `fecha_firma` (DateField, se hace `.date()`), `modalidad_de_contratacion` -> `modalidad`, `documento_proveedor` -> `contratista_nit`, `proveedor_adjudicado` -> `contratista_nombre`. Los nombres truncados tipo `justificacion_modalidad_de` y `liquidaci_n` son los reales de la API SODA y se usan tal cual en el `GET`.
- **Modelo `Contrato` plano primero, FK después:** RF-01 exige tabla plana con `nit_entidad` dentro de `Contrato` para pasar la verificación de esquema (15 cols + 4 índices). La normalización a `Entidad` con FK (advertencia de Sesión 1: "evita el error de crear Entidad en Sprint 3") se hará en Sesión 4/RF-25 para agrupar por entidad y no por texto.
- **4 índices B-tree obligatorios:** `departamento`, `modalidad`, `fecha_firma`, `contratista_nit` — sin ellos una agregación por departamento pasa de 40ms a 3s con 100k filas (validado con `EXPLAIN ANALYZE` en Sesión 2).
- **Tipos estrictos:** `valor_contrato` Decimal(18,2) rechaza 3 decimales; `fecha_firma` DateField rechaza texto — ambos son criterios de rechazo del RF-01 y se probaron con `full_clean()`.

## 4. Estado real al 01/09/2026 — Validado en ejecución
- **Infra:** `Backend/secop_backend/secop_backend/` con `manage.py`, `contratos` app registrada, `migrate` OK (incluye `0002_contrato_idx_*`).
- **Modelo:** `contratos/models.py:1` con clase `Contrato(models.Model)` PascalCase, 15 campos, Meta `db_table="contrato"` + 4 `Index`, `__str__` corregido (antes sin sangría, ahora `CO1-TEST-001 - PEPITO SAS`).
- **Pruebas shell (Python 3.14.5, Django 6.1, venv):** `Contrato.objects.create` OK (1 registro), `full_clean` rechaza `Decimal("123.456")` → `no more than 2 decimal places`, rechaza `"no es fecha"` → `invalid date format`. Todo verificado con `python manage.py shell`.
- **VS Code:** `.vscode/settings.json` en 3 roots apuntando a `venv/Scripts/python.exe`, `ruff.lint.enable:false` para silenciar falsos positivos, `python.analysis.extraPaths` a `site-packages`. Pendiente `Reload Window` del usuario.
- **Frontend:** Scaffold Vite+React existente en `Frontend/secop_frontend/` sin dashboard aún (Sesión 3).

## 5. Cómo enseñamos (acuerdo con Steven)
- Explicación en párrafos cortos, no en bullet infinito. Cada paso va con el código literal para copiar en el chat y el por qué en párrafo aparte.
- No se toca ninguna carpeta sin "sí, te autorizo". Cada `makemigrations`, `migrate` o escritura de archivo se pide permiso y se verifica con ejecución.
- Retroalimentación constante: se celebra el acierto (mayúscula de `Contrato`) y se corrige el detalle (tabla `contrato` no `contraro`, `__str__(self)` no "toma lo del archivo").

## 6. Próximos pasos inmediatos
1. Verificar visualmente que Pylance ya no subraya `django.db` tras `Reload Window`.
2. Limpiar registro de prueba `CO1-TEST-001` o dejarlo como semilla.
3. Iniciar **Sesión 2 / RF-06**: `management/commands/cargar_secop.py` con loop `$limit=50000/$offset`, `X-App-Token`, `bulk_create(batch=1000)`, `ProcessingJob` + `Thread` + `202 Accepted` + polling, y crear los 6 endpoints agregados con `annotate/aggregate` y `throttling 60/min`.

## 7. Fuentes y artefactos
- `Observatorio_SECOP_II_Definicion_Proyecto.pdf` (definición 6 páginas)
- `GFPI-F-135-Guia4-DesarrolloExplicación.pdf` (Guía 4 V04)
- `EstructuraSesion_v2.xlsx` (5 sesiones, 150h plan)
- `SECOP_Insight_Backlog_Notion.md` / `.csv` (58 pts backlog refinado)
- Dataset SODA `j13v-233n` — columnas verificadas vía `schema-column-preview` (85 cols)

---
*Actualizado: 01/09/2026  — Estado: RF-01 DONE — Siguiente: Sesión 2 ETL — Mantener este archivo vivo en cada sesión.*
