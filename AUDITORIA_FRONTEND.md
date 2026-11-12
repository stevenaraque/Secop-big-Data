# Auditoría completa del frontend — SECOP Insight

**Proyecto:** `Frontend/secop_frontend` (React 19.2.8 + Vite 8.2.2 + Tailwind 3.4 + TanStack Query 5 + React Router 7)
**Fecha:** 12/11/2026
**Alcance:** calidad de código, arquitectura, seguridad, rendimiento, accesibilidad, tests, dependencias, configuración.
**Método:** revisión estática de todo `src/` (16 páginas, ~30 componentes/hooks), configs, `package.json`, `nginx.conf`, `Dockerfile`, tests. Sin ejecución de la app.

> Nota: la seguridad del frontend ya se auditará en run-4 (hallazgos `secop-jwt-localstorage-xss-theft-001`, `secop-prod-ssl-redirect-*`). Esta auditoría es complementaria y más amplia.

---

## 1. Resumen ejecutivo

El frontend está **bien estructurado para un proyecto académico**: rutas lazy, code-splitting manual por librería pesada, virtualización en la tabla grande, un único sink de `innerHTML` correctamente escapado (`esc()`), CSP estricta, skip-link, modal con foco y Escape, y un cliente de API con refresh single-flight. Los principales problemas son de **consistencia y mantenibilidad**: `authFetch` (con refresh, timeout y errores tipados) está definido pero **no se usa**; 7 páginas duplican la URL del API y hacen `fetch` a mano; hay una página muerta (`Buscador.jsx`); dependencias de Jest conviven con Vitest; y los tests cubren solo 3 de 16 páginas. Nada bloquea producción, pero la deuda técnica crece con cada nueva página.

## 2. Fortalezas (mantener)

- `src/App.jsx:8-15` — todas las páginas lazy con `Suspense` (`App.jsx:150`); `DashboardModern.jsx:14-15` lazy-load de MapaDirecta/Grafo.
- `vite.config.js:23-32` — `manualChunks` separa recharts, leaflet, graph, motion, tanstack, vendor; `chunkSizeWarningLimit: 600`.
- `src/pages/DataTableSECOP.jsx:97-102` — virtualización con `@tanstack/react-virtual`.
- `src/pages/MapaDirecta.jsx:39` — único sink HTML pasa por `esc()` (escapa `& < > " '`); interpolaciones de estilo acotadas por `Math.min` y paleta fija.
- `index.html:11` + `nginx.conf:9` — CSP `script-src 'self'` sin `unsafe-inline`; `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.
- `src/App.jsx:36-43` — skip link + `main#contenido` en Login/Registro/DashboardModern.
- `src/pages/PrivateDashboard.jsx:101-111` — modal con foco en botón cerrar, bloqueo de scroll del body, cierre con Escape.
- `src/components/ScrubChart.jsx:143-157` — slider con `role="slider"` y soporte de teclado (Arrow/Home/End).
- `src/lib/api.js:103-142` — refresh single-flight (`_refreshPromise`) con manejo de `definitivo`.
- Sin `console.log`/`console.error` en `src/`.

## 3. Hallazgos por prioridad

### 🔴 Alta

**F-1. `authFetch` definido pero no usado (inconsistencia de capa de red).**
`src/lib/api.js:45-91` implementa `authFetch` (JWT, timeout 45s, errores tipados), pero 7 páginas lo ignoran y redefinen `const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"` y llaman `fetch` directo: `Buscador.jsx:4`, `Banderas.jsx:8`, `ActualizacionMasiva.jsx:4`, `Grafo.jsx:17`, `Entidades.jsx:6`, `PredominioDirecta.jsx:8`, `Umbrales.jsx:6`. Consecuencia: el refresh automático en 401, el timeout y el manejo uniforme de errores **no aplican** en la mayoría de vistas; cada página reimplementa estados de carga/error de forma distinta. Recomendación: migrar todas las páginas a `authFetch` (o a un hook `useApi`) y eliminar los fallbacks duplicados.

**F-2. Página muerta `Buscador.jsx`.**
`src/pages/Buscador.jsx` no está importada en ningún lado (solo auto-referencia en línea 6). Es código muerto que aumenta el bundle si se importa por error y confunde el mantenimiento. Acción: eliminar o registrar la ruta en `App.jsx`.

**F-3. CSP con hosts de desarrollo en producción.**
`index.html:11` y `nginx.conf:9` incluyen `http://127.0.0.1:8000` y `http://localhost:8000` en `connect-src`. En un despliegue real esto permite que un script inyectado exfiltre a localhost (menor impacto) pero, sobre todo, indica que la CSP no es específica por entorno. Acción: generar la CSP por entorno (Vite define `import.meta.env.PROD`) o quitar los hosts dev del build de producción.

**F-4. `index.html` CSP sin `frame-ancestors`.**
Mitigado por `X-Frame-Options: DENY` en nginx, pero si el bundle se sirve sin nginx (p. ej. preview de Vite, CDN estático), la protección desaparece. Acción: añadir `frame-ancestors 'none'` a la CSP de `index.html`.

**F-5. Promesas sin manejo de error.**
`DashboardModern.jsx:144` (`obtenerTokenVigente().then(...)`), `PrivateDashboard.jsx:174`, `StatusMark.jsx:56`. Si fallan, la excepción queda sin capturar. Acción: `.catch` o `try/await` con toast.

### 🟠 Media

**F-6. Dependencias de Jest conviviendo con Vitest.**
`package.json:34,40-41` incluye `@types/jest`, `identity-obj-proxy`, `jest` mientras el runner es Vitest (`vitest.config.js`). Código muerto en devDependencies que infla instalación y confunde. Acción: eliminar las tres.

**F-7. Sin configuración de lint/format/typecheck.**
No hay ESLint, Prettier ni tsconfig/jsconfig. Solo `oxlint` (`package.json:9`). Sin reglas de a11y ni hooks. Acción: añadir `eslint-plugin-jsx-a11y` y `eslint-plugin-react-hooks` al menos.

**F-8. Sin error boundary raíz.**
`ErrorBoundary` solo envuelve secciones en `DashboardModern.jsx:253,274,353,356,359,362,365,369`. Un error en Login/Registro/PrivateDashboard tumba toda la app sin fallback. Acción: envolver `<App/>` en `main.jsx`.

**F-9. Tests compartiendo un `QueryClient` global.**
`Login.test.jsx`/`Registro.test.jsx` usan un `QueryClient` compartido → fuga de caché entre tests. Acción: instanciar por test.

**F-10. Cobertura de tests muy baja.**
Solo 3 archivos para 16 páginas: no hay tests de `api.js`, `useTheme`, componentes ni de rutas de error/mutaciones. Acción: priorizar `api.js` (refresh, timeout) y `PrivateDashboard` mutaciones.

**F-11. Modal sin trap de foco ni restauración.**
`PrivateDashboard.jsx:101-111` enfoca el botón cerrar y bloquea scroll, pero no hay trap ni restauración del foco al cerrar. Acción: usar `focus-trap` o implementar ciclo Tab.

**F-12. Contraste en textos pequeños.**
`text-zinc-500` / `dark:text-white/60` a 11px sobre superficies glass (`DashboardModern.jsx:228,237,262,374`, `ScrubChart.jsx:65,126,189,206`, `MiniDataTable.jsx:112`). Verificar WCAG AA (4.5:1). Acción: auditar con herramienta de contraste; subir a `zinc-400`/`white/70` si falla.

**F-13. Etiquetas de formulario sin `htmlFor` en varias páginas.**
`UiverseInput.jsx:136-138` usa `htmlFor={id}` (bien), pero `PrivateDashboard.jsx` envuelve inputs en `<label>` (implícito, aceptable) y otras páginas (`Banderas`, `Grafo`, `PredominioDirecta`, `Umbrales`) usan `<label>` suelto sobre un `<select>` sin asociación. Acción: verificar cada uno; convertir a `htmlFor`+`id` donde falte.

**F-14. `Dockerfile` con `node:20-alpine` y Vite 8.**
Vite 8 requiere Node ≥20.19 (o 22.12). `node:20-alpine` puede ser 20.10 → build falla en CI. Acción: fijar `node:20.19-alpine` o `node:22-alpine`.

### 🟢 Baja

**F-15. GeoJSON cargado en runtime** (`MapaDirecta.jsx:137`) — aceptable, pero podría precargarse con `?url` de Vite para caché de build.

**F-16. Sin `build.target` en Vite** — por defecto `modules` (ES2020). Fine para navegadores modernos; documentar soporte.

**F-17. `nginx.conf` sin gzip/brotli directives** — la compresión se hace en build (`.gz`/`.br`), pero nginx debe servirla (módulo `ngx_http_gzip_static_module` o `brotli`). Verificar que el Dockerfile de nginx lo soporte.

**F-18. Prop drilling de `token`/`depto`** en `DashboardModern` → secciones. Considerar Context o pasar por props tipadas (sin TS, documentar).

**F-19. `StatusMark.jsx:56` `.then` sin catch** y `DashboardModern.jsx:144`, `PrivateDashboard.jsx:174`.

**F-20. `Buscador.jsx` página muerta** (ver F-2).

## 4. Deuda técnica destacada (no bloqueante)

- `authFetch` vs `fetch` manual: la mayor inconsistencia. Migrar a `authFetch` unifica refresh, timeout y errores.
- `localStorage` para JWT (trade-off documentado en `index.html:10` y `CONTEXT.md`): sin sink XSS ejecutable hoy (único innerHTML pasa por `esc()`), pero la migración a HttpOnly cookies ya está anotada. Prioridad planificación.
- `VITE_API_URL` duplicada en 7 páginas en vez de centralizar (ya existe `lib/api.js:5`).
- Sin virtualización en `MiniDataTable` (solo 8 filas por página, aceptable).
- `useTheme` es el único hook; la lógica de auth (refresh, expiración) vive en `api.js` y `App.jsx` sin hook reutilizable.

## 5. Plan de acción sugerido

1. **Semana 1 (alto impacto, bajo riesgo):** F-1 (migrar a `authFetch`), F-2 (eliminar Buscador), F-5 (catch en promesas), F-6 (limpiar deps Jest).
2. **Semana 2 (calidad):** F-7 (lint + a11y), F-8 (error boundary raíz), F-9/F-10 (tests + QueryClient por test).
3. **Semana 3 (a11y + perf):** F-11 (focus trap), F-12 (contraste), F-13 (labels), F-3/F-4 (CSP por entorno).
4. **Backlog:** F-14 (Node version), F-15/16/17 (build), F-18 (prop drilling), migración a HttpOnly cookies.

## 6. Lo que está bien y no tocar

- Lazy loading + manualChunks, virtualización en DataTableSECOP, `esc()` en el único innerHTML, CSP estricta, skip-link, modal accesible, refresh single-flight, ausencia de `console.*` y de sinks peligrosos (`dangerouslySetInnerHTML`, `eval`, etc.), `target="_blank"` con `rel="noreferrer"`, sin `window.open`/`postMessage`/storage listeners.

---

**Métricas rápidas:** 16 páginas, ~30 componentes, 3 archivos de test, 0 `console.*` en `src/`, 1 sink HTML (escapado), 1 página muerta, 7 duplicaciones de `VITE_API_URL`, 1 dependencia muerta (Jest).
