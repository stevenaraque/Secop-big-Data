# Auditoría SECOP Insight V3.1 — 18/09/2026

**Autor:** Jarvis 🤖 — Senior Full Stack 20 años | **Proyecto:** `C:/Users/PC_03/OneDrive/Desktop/Big data` — SECOP Insight V3.1 Freemium (Django + PostgreSQL + React) | **Metodología:** Teoría → Ejemplo → Paso a paso

## Estado verificado
- `manage.py check: 0 issues` ✅
- `pytest: 5 passed` ✅
- `vitest: 3 passed` ✅
- `vite build: 1.39s, 49.57 kB CSS, 1229 kB JS (369 kB gzip)` ⚠️ >500kB
- `migrations: 0011_radar_filtros_extras [X] aplicadas` ✅ (0010 untracked en git)
- `DB local: 4972 contratos + 5 Radares + 3 Oportunidades` ✅
- `main: af42b8a` + tags `v1.0-sprint4, v1.1-profiler, v1.2-privado` ✅

---

## 🔴 P0 — Bloquea deploy / entrega (45 min)

1. **Falta `drf-spectacular` en `Backend/secop_backend/requirements.txt:1`** — `secop_backend/settings.py:54` y `secop_backend/urls.py:19` lo usan pero `pip install` en Render/Docker fallará. **Fix:** `drf-spectacular==0.28.0` a requirements.
2. **Migración sin versionar `Backend/secop_backend/secop_backend/contratos/migrations/0010_radar_oportunidad_radar_idx_radar_usuario_and_more.py:1`** — `git status ??` pero `showmigrations [X]`. Clone limpio no crea tablas `radar/oportunidad`. **Fix:** `git add .../migrations/0010*.py .../migrations/0011*.py`.
3. **Bundle 1.23 MB `Frontend/secop_frontend/dist/assets/index-CEAIbSvV.js:1`** — Vite warn `>500 kB`. Causa `recharts + leaflet + react-force-graph-2d` sin split. **Fix:** `Frontend/secop_frontend/vite.config.js:6` → `manualChunks: { vendor: ['react','recharts'], map:['leaflet'], graph:['react-force-graph-2d'] }`.
4. **API hardcode `Frontend/secop_frontend/src/pages/DashboardModern.jsx:17` y `PrivateDashboard.jsx:5` `http://127.0.0.1:8000/api`** — prod CORS/404. **Fix:** `VITE_API_URL` env: `const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"`.
5. **Emails deprecados `Backend/secop_backend/secop_backend/secop_backend/settings.py:193` `EMAIL_*`** — 7 warnings `RemovedInDjango70Warning: EMAIL_USE_TLS ... deprecated, migrate to MAILERS before Django 7.0`. **Fix:** pin `Django==6.1` con comentario o migrar a `MAILERS`.

## 🟡 P1 — Importante pre-Guía 4 (2h)

1. **Router frágil `Frontend/secop_frontend/src/App.jsx:9` `window.location.pathname`** — sin `react-router-dom` (no en `Frontend/secop_frontend/package.json:21`). **Fix:** `npm i react-router-dom` + `BrowserRouter/Routes`.
2. **Dirty working tree** — 5 modificados `contratos/views.py:10`, `contratos/urls.py:1`, `secop_backend/settings.py:1`, `DashboardModern.jsx:1`, `index.html:1` + `~$SECOP_Backlog_Producto.xlsx` lock + `SECOP_Backlog_Producto.csv ??`. **Fix:** `git add -A; git commit; git tag v1.3-auditoria`.
3. **CSV/XLSX duplicados** — `SECOP_Backlog_Producto.csv:1` 391 líneas untracked vs `SECOP_Backlog_Producto.xlsx:57` filas. **Fix:** commitear ambos o elegir 1.
4. **Servicio banderas `Backend/secop_backend/secop_backend/contratos/services.py:107` 2 queries + loop** — con 6M lento. Ya OK con `idx_contrato_depto/modalidad` pero falta doc `idx_contrato_valor` para `SUM`.
5. **CORS prod `secop_backend/settings.py:71` solo localhost** — agregar `Vercel` via env: `os.getenv("CORS_ALLOWED_ORIGINS")`.

## 🟢 P2 — Pulido (30 min)

1. Campo `contratos/models.py:108` `tamaño_bytes` con `ñ` — ya mitigado `services.py:457` alias `tamano_bytes` ✅, renombrar a ascii.
2. `EstructuraSesion_v2.xlsx: 02/09` desactualizado vs 5 sprints.
3. `docker-compose.yml:5` falta `SODA_APP_TOKEN` required.
4. Docs duplican estado pero ya coherente `README 18/09` + `CONTEXT 18/09`.

---

## ✅ Wins visibles
- Freemium 2 en 1 + ETL 2 fases + matchmaking `cargar_secop.py:123` con `filtros_extras` 85 cols + email best-effort OK — `Backend/secop_backend/secop_backend/contratos/management/commands/cargar_secop.py:142`
- Virtualización `DataTableSECOP.jsx:93` `estimateSize 44 + overscan 8` + `keepPreviousData` OK — `Frontend/secop_frontend/src/pages/DataTableSECOP.jsx:93`
- Profiler Dual `ProfilerDual.jsx:10` toggle + `views.py:91` `perf_counter` OK — `Frontend/secop_frontend/src/pages/ProfilerDual.jsx:10`
- Seguridad `users/models.py:12` Token 30min un solo uso + `settings.py:32` hardening prod OK

## Plan de cierre (3h)
1. P0-1 + P0-2 (10 min) — `requirements.txt` + `git add migrations/`
2. P0-3 + P0-4 (20 min) — `vite.config.js` chunks + `VITE_API_URL`
3. P1-1 (15 min) — `react-router-dom`
4. Commit + tag (5 min) — `git commit -m "chore(auditoria): informe 18/09 + P0"` + `git tag v1.3-auditoria` + push
5. Docs (30 min) — `EstructuraSesion_v2.xlsx` + video 3min

---
*Generado 18/09/2026 — Auditoría solicitada por Steven — `AUDITORIA_2026-09-18.md` — dejar resto a casa*
