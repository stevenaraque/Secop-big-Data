# ERRORES.md — Registro de errores del proyecto SECOP Insight

> Todo error que salga se documenta aquí con causa y solución. Acuerdo con Steven: sin excepción.

## 1. `relation does not exist` al escribir sin `migrate`
Causa: se intentó cargar datos antes de crear tablas.
Solución: `makemigrations` → `migrate` → `cargar_secop`.
Comando: `python secop_backend/manage.py migrate`

## 2. Índices duplicados `db_index` (13 en vez de 7)
Causa: `db_index=True` en campos más `Meta.Index` duplicaba.
Solución: quitar duplicados y `DROP INDEX`, dejar `pkey` + `id_contrato` + 4 `idx_contrato_*`.
Verificación: `SELECT indexname FROM pg_indexes WHERE tablename='contrato'`

## 3. `__str__` dentro de `Meta`
Causa: indentación lo metió en `class Meta`, Pyrefly marcaba `missing-attribute`.
Solución: sacarlo al nivel de la clase `Entidad`/`Contrato`.

## 4. `UnboundLocalError` en filtros de fecha (RF-13)
Causa: `fecha_desde` quedó dentro del `if modalidad` por indentación.
Solución: dedentar a 4 espacios al nivel de `get_queryset`.
Prueba: `?fecha_desde=2024-01-01&fecha_hasta=2024-12-31` → `count 3`.

## 5. `NameError: Count` en serie mensual (RF-14)
Causa: faltaba `from django.db.models import Count, Sum` en `views.py:1`.
Solución: agregarlo. Lo corrigió Steven.
Prueba: `GET api/optimized/serie-mensual/?depto=Boyacá` → `serie [{mes:2022-09-01...}]`.

## 6. SODA `j13v-233n` devolvía 404 `dataset.missing`
Causa: ID viejo del dataset.
Solución: usar `jbjy-vk9h` (SECOP II 5.98M) + `requests==2.34.2`.

## 7. `Token is expired` en `/api/optimized/mapa-directa/`
Causa: `access` dura 1h. Se reutilizó el viejo.
Solución: nuevo login y guardar bien la variable:
```powershell
$r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/auth/login/" -ContentType "application/json" -Body '{"correo":"steven@gmail.com","contrasena":"123456789"}'
$tok = $r.access
Invoke-RestMethod -Headers @{Authorization="Bearer $tok"} "http://127.0.0.1:8000/api/optimized/mapa-directa/" | ConvertTo-Json -Depth 5
```

## 8. `$tok = $r.access` con `$r` viejo
Causa: se hizo login sin `$r =` y luego se leyó `$r.access` anterior.
Solución: siempre asignar `$r =` en la misma ventana antes de `$tok = $r.access`. Verificar que el impreso sea distinto.

## 9. `Credenciales inválidas` con `TU_CLAVE` literal
Causa: se copió el ejemplo sin cambiar la clave.
Solución: usar la clave real de RF-03.

## 10. Mapa beige vacío solo con leyenda (RF-15)
Causa: retorno temprano `if (isLoading) return ...` antes de montar el div. Leaflet quedaba sin contenedor.
Solución: siempre renderizar `#rf15-map` y mostrar aviso encima con `.map-status`.

## 11. Nombres con `�` en GeoJSON (`Nari�o`, `Boyac�`)
Causa: archivo con Ñ mal codificada. El cruce por nombre fallaba.
Solución: cruce por `id` estable con `POR_ID` (`CONAR→NARINO`, `COBOY→BOYACA`, etc.).

## 12. `BogotÃ¡` en PowerShell
Causa: solo la consola mostrando mal el UTF-8. La BD tenía `0xe1` correcto.
Solución: no tocar la BD. El navegador decodifica bien.

## 13. Boyacá duplicado (`Boyaca` + `Boyacá`)
Causa: una fila de prueba sin tilde y una del ETL con tilde.
Solución: `mapa_directa_optimizado` fusiona por clave normalizada → `total 2, 50%`. `_variantes` hace lo mismo en resumen/top/lista.

## 14. Dropdown solo mostraba Antioquia (RF-16)
Causa: options fijas (Todos, Boyacá, Antioquia, Bogotá). Clic en Meta no tenía option.
Solución: options dinámicas desde `mapa-directa` ordenadas con conteo.

## 15. Build JSX `Expected ',' or ')'` / `Unexpected token`
Causa: ternario con dos hermanos sin fragmento tras agregar error/vacío.
Solución: envolver en `<>...</>` y quitar `)}` sobrante. Verificado `npm run build` 369ms.

## 16. `IndentationError` en `def buscar` (RF-18)
Causa: método pegado con 8 espacios en vez de 4.
Solución: `def` a 4 espacios, cuerpo a 8. `check` 0 issues.

## 17. Eco `"q": 1` fijo + `permissions_classes` con s (RF-18)
Causa: `return Response({"q": 1, ...})` hardcodeado y typo en `permission_classes` que desactivaba el `IsAuthenticated`.
Solución: `{"q": q, **datos}` y `permission_classes`. El buscador quedaba abierto sin Bearer.

## 18. `No es posible conectar con el servidor remoto` al probar (RF-19)
Causa: `runserver` apagado de la sesión anterior.
Solución: encenderlo en ventana aparte antes de probar:
```powershell
cd "C:\Users\PC_03\OneDrive\Desktop\Big data\Backend\secop_backend"
venv\Scripts\python.exe secop_backend\manage.py runserver
```

## 19. `bad_authorization_header` al probar entidades (RF-27/28)
Causa: `$tok` vacío porque se abrió otra PowerShell o no se hizo login en la misma ventana. El header llega como `Bearer ` sin token.
Solución: login y pruebas en la MISMA ventana, y verificar que `$tok` imprima el `eyJ...` antes de seguir:
```powershell
$r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/auth/login/" -ContentType "application/json" -Body '{"correo":"steven@gmail.com","contrasena":"123456789"}'
$tok = $r.access
$tok
```

## 20. El rojo de `page=9999` y `umbral=abc` NO es error (RF-24/27/28)
Causa: se espera HTTP 400 con `{"detalle":"Página fuera de rango."}` o `{"detalle":"Umbral inválido..."}`.
Solución: ninguna, es la validación funcionando. No tocar código ni BD.

## 21. Aristas grises en el grafo NO es error (RF-17)
Causa: solo directa (rojo) y licitación (verde) tienen color propio; régimen especial y demás van en gris `#6b7280` a propósito.
Solución: ninguna. Si quieres más colores, agrégalos en `COLORES_MODALIDAD` de `contratos/services.py`.

## 22. `MAILERS` en vez de `EMAIL_BACKEND` (RF-22)
Causa: `settings.py:174` tenía `MAILERS = { 'default': { 'BACKEND': ... } }` que Django ignora; `send_mail` no imprimía en consola.
Solución: cambiar a `EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'` + `DEFAULT_FROM_EMAIL`. Verificado shell imprime `Subject: Recupera tu contraseña`.

## 23. Política de contraseña no validada en registro (RF-22)
Causa: `RegistroSerializer` solo tenía `min_length 8`, aceptaba `password123` sin mayúscula.
Solución: agregar `validate_contrasena` + `validate_nueva_contrasena` que llaman `_validar_politica_contrasena` (8+ may/min/número) en `users/services.py:1`. Verificado `400 La contraseña debe tener al menos una mayúscula.` etc., y `201 Valida123A` OK.

## 24. `migrate` sin `makemigrations users` para TokenRecuperacion (RF-22)
Causa: se creó `users/models.py:1` `TokenRecuperacion` pero no se generó migración; `relation token_recuperacion does not exist`.
Solución: `makemigrations users` → `0001_initial.py` + `migrate` OK. Índices `token_recuperacion_pkey + token_key + idx_token_expira` verificados vía `pg_indexes`.

## 25. `DisallowedHost: testserver` en Client anon (RF-23)
Causa: `ALLOWED_HOSTS = []` bloquea `testserver` del `Client()` aunque `DEBUG=True`.
Solución: en shell poner `settings.ALLOWED_HOSTS=['*']` antes de `Client()`, o agregar `testserver` a `ALLOWED_HOSTS`. En prod `runserver` con `DEBUG True` permite `127.0.0.1` sin tocar.

## 26. VistaEstadoCarga sin `origen`/`nuevos_registros` (RF-26)
Causa: `VistaEstadoCarga` solo devolvía `estado/total/procesados/offset`, el poll no veía `0 nuevos`.
Solución: agregar `origen`, `nuevos_registros`, `creado_en`, `actualizado_en` en `contratos/views.py:62`. Verificado `poll completado nuevos 0`.

## 27. `SODA without $order=:id` duplica en periódica (RF-26)
Causa: `cargar_secop` usaba solo `$limit/$offset` sin `$order=:id`; SODA devuelve orden inestable y offset 0 traía ids distintos cada vez, `ignore_conflicts` no evitaba duplicados porque eran ids nuevos.
Solución: agregar `params["$order"]=":id"` en `cargar_secop.py:34` + contar `existentes set` + `nuevos=len-existentes`. Verificado `segunda misma carga 0 nuevos count 17==17`, `offset 1 nuevos 1`.

## 28. `Ya hay una actualización periódica en curso` es 409 no error (RF-26)
Causa: se lanza segunda `POST /cargar/actualizar-periodica/` mientras hay `estado en_progreso origen periodica`.
Solución: ninguna, es `409 {"detalle":"Ya hay..."}` esperado. Esperar a `completado` y reintentar.

## 29. `deploy.ps1` con `—` y `param` no primero (RNF-10)
Causa: comentario con `—` (em dash) antes de `param` y rutas relativas desde `Template` no desde `Big data`, `Copy-Item` fallaba con `PathNotFound`.
Solución: quitar `—`, poner `param` primero con `$PSScriptRoot` + `Join-Path $Root ...` y usar `& "..\venv\Scripts\python.exe"`. Verificado `deploy.ps1 4/4 OK` `migrate 0` `check 0` `build 406ms`.

## 30. `tamaño_bytes` con `ñ` en JSON se ve `tama��o_bytes` en PowerShell (RNF-09)
Causa: `BackupRegistro.tamaño_bytes` con `ñ` en key JSON se manglea en `Invoke-WebRequest` por codepage.
Solución: devolver ambas keys `tamano_bytes` (ASCII) y `tamaño_bytes` en `VistaCrearBackup` y mapear en `listar_backups` `r["tamano_bytes"]=r.pop("tamaño_bytes")`. PowerShell ahora lee `tamano_bytes 7912` OK.

---
*Actualizado: 11/09/2026 — RNF-10 deploy reproducible (Dockerfile, compose, gunicorn) — Steven Araque*
