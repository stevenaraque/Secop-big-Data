"""
poblar_secop — Carga masiva SECOP II (9M rows, 5-7 GB CSV) via COPY PostgreSQL.

Que hace:
  1. Descarga en streaming (requests stream=True, bloques 1 MB, nunca RAM completa).
  2. Lee por chunks con pandas.read_csv(chunksize=100_000).
  3. Inserta ultrarrapido con COPY via psycopg2 copy_expert + tabla TEMP + INSERT ON CONFLICT DO NOTHING.
  4. Barra tqdm + gc.collect() por chunk + reintentos red.

Uso:
  python manage.py poblar_secop
  python manage.py poblar_secop --chunksize 100000 --max-chunks 2   # prueba 200k
  python manage.py poblar_secop --csv C:\\tmp\\secop.csv --no-download  # reutiliza archivo
"""
import gc
import io
import time
import unicodedata
from pathlib import Path

import requests
from django.conf import settings
from django.core.management.base import BaseCommand

CSV_URL = "https://www.datos.gov.co/api/views/p6dx-8zbt/rows.csv?accessType=DOWNLOAD"
TABLA = "contrato"

# Columnas DB destino (sin id autoincremental ni entidad_id nullable).
COLUMNAS_DB = [
    "nombre_entidad",
    "nit_entidad",
    "departamento",
    "ciudad",
    "orden",
    "sector",
    "id_contrato",
    "estado_contrato",
    "codigo_categoria_principal",
    "descripcion_del_proceso",
    "valor_contrato",
    "fecha_firma",
    "modalidad",
    "contratista_nit",
    "contratista_nombre",
]

# Longitudes max segun contratos/models.py Contrato (evita error COPY por truncate).
MAXLEN = {
    "nombre_entidad": 255,
    "nit_entidad": 50,
    "departamento": 100,
    "ciudad": 100,
    "orden": 100,
    "sector": 100,
    "id_contrato": 100,
    "estado_contrato": 100,
    "codigo_categoria_principal": 100,
    "descripcion_del_proceso": 500,
    "modalidad": 100,
    "contratista_nit": 50,
    "contratista_nombre": 255,
}

# Alias de cabeceras reales del CSV Socrata (variantes con/(_)/sin tildes).
# Cubre 2 esquemas: Procesos p6dx-8zbt (59 cols: "ID del Proceso", "Precio Base", ...)
# y Contratos jbjy-vk9h ("id_contrato", "valor_del_contrato", ...). Gana el primero hallado.
ALIAS = {
    "nombre_entidad": ["nombre de la entidad", "nombre_entidad", "entidad", "nombre entidad"],
    "nit_entidad": ["nit de la entidad", "nit_entidad", "nit entidad", "nitentidad"],
    "departamento": ["departamento entidad", "departamento", "departamento_entidad", "departamento proveedor"],
    "ciudad": ["ciudad entidad", "ciudad", "municipio", "ciudad de la unidad de contratacion"],
    "orden": ["orden entidad", "orden", "orden_entidad", "ordenentidad"],
    "sector": ["sector entidad", "sector"],
    "id_contrato": ["id del proceso", "id_contrato", "id proceso", "idcontrato", "referencia del proceso", "id del contrato", "id contrato", "id proceso", "pci"],
    "estado_contrato": ["estado del procedimiento", "estado_contrato", "estado del contrato", "estado contrato", "estado", "estado resumen", "fase", "estado de apertura del proceso"],
    "codigo_categoria_principal": ["codigo principal de categoria", "codigo de categoria principal", "codigo_categoria_principal", "codigo categoria"],
    "descripcion_del_proceso": ["descripcion del procedimiento", "nombre del procedimiento", "descripcion_del_proceso", "descripcion del proceso", "descripcion proceso", "objeto del contrato", "objeto"],
    "valor_contrato": ["precio base", "valor total adjudicacion", "valor del contrato", "valor_contrato", "valor contrato", "valor_del_contrato", "valor"],
    "fecha_firma": ["fecha de publicacion del proceso", "fecha adjudicacion", "fecha de firma", "fecha_firma", "fecha firma", "fecha_de_firma", "fecha del contrato", "fecha de publicacion del proceso", "fecha de publicacion"],
    "modalidad": ["modalidad de contratacion", "modalidad_de_contratacion", "modalidad", "modalidad de seleccion"],
    "contratista_nit": ["nit del proveedor adjudicado", "documento proveedor", "nit proveedor", "documento_proveedor", "contratista_nit", "nit adjudicatario", "documento adjudicatario", "codigoproveedor"],
    "contratista_nombre": ["nombre del proveedor adjudicado", "proveedor adjudicado", "proveedor_adjudicado", "contratista_nombre", "nombre adjudicatario", "contratista", "adjudicatario", "nombre del adjudicador"],
}


def norm(txt: str) -> str:
    """Normaliza cabecera: minusculas, sin tildes, _ -> espacio, colapsa espacios."""
    t = str(txt or "").strip().lower().replace("_", " ")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    return " ".join(t.split())


def mapear_chunk(df, estricto=True) -> "pd.DataFrame":
    """Convierte chunk crudo (cabeceras Socrata) a COLUMNAS_DB limpias.
    estricto=True: descarta sin fecha valida (carga inicial).
    estricto=False: conserva todo (recuperacion V3.3, fecha='' -> NULL)."""
    import pandas as pd

    mapa = {norm(c): c for c in df.columns}
    out = pd.DataFrame()
    for campo in COLUMNAS_DB:
        real = None
        for a in ALIAS.get(campo, []):
            if a in mapa:
                real = mapa[a]
                break
        if real is None:
            out[campo] = ""
        else:
            out[campo] = df[real].astype(str).fillna("").str.strip().replace({"nan": "", "None": "", "NaT": ""})
    # Truncar textos a MAXLEN (evita value too long en COPY).
    for campo, n in MAXLEN.items():
        out[campo] = out[campo].str.slice(0, n)
    # id_contrato obligatorio: descartar vacios.
    out = out[out["id_contrato"].str.strip() != ""]
    if out.empty:
        return out
    # valor_contrato -> numerico, 2 decimales como texto (COPY castea a numeric 30,2 V3.3).
    # Sin clip superior: numeric(30,2) acepta los valores gigantes reales del SECOP.
    v = pd.to_numeric(out["valor_contrato"].str.replace(",", "", regex=False).str.strip(), errors="coerce")
    out["valor_contrato"] = v.map(lambda x: "" if pd.isna(x) else f"{x:.2f}")
    # fecha_firma -> YYYY-MM-DD. Estricto: descarta invalidas. Recuperacion: las conserva como '' (NULL).
    f = pd.to_datetime(out["fecha_firma"].str.slice(0, 10), errors="coerce", format="mixed")
    out["fecha_firma"] = f.dt.strftime("%Y-%m-%d").fillna("")
    if estricto:
        out = out[out["fecha_firma"] != ""]
    return out


def get_raw_conn():
    """Conexion psycopg2 directa (COPY no va por el cursor Django)."""
    import psycopg2

    db = settings.DATABASES["default"]
    return psycopg2.connect(
        dbname=db.get("NAME"),
        user=db.get("USER"),
        password=db.get("PASSWORD"),
        host=db.get("HOST") or "localhost",
        port=db.get("PORT") or "5432",
    )


def copy_chunk(conn, df) -> int:
    """COPY a tabla TEMP (todo TEXT) + INSERT con CAST + ON CONFLICT DO NOTHING. Retorna insertados."""
    if df.empty:
        return 0
    import pandas as pd  # noqa: F401  (tipado diferido)

    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False)
    buf.seek(0)
    cols = ", ".join(f'"{c}"' for c in COLUMNAS_DB)
    with conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS tmp_poblar")
        cur.execute(f"CREATE TEMP TABLE tmp_poblar ({', '.join(f'{c} TEXT' for c in COLUMNAS_DB)}) ON COMMIT DROP")
        cur.copy_expert(f"COPY tmp_poblar ({cols}) FROM STDIN WITH (FORMAT CSV, NULL '\\N')", buf)
        cur.execute(
            f"""
            INSERT INTO {TABLA} ({cols})
            SELECT
              LEFT(nombre_entidad,255),
              LEFT(nit_entidad,50),
              LEFT(departamento,100),
              LEFT(ciudad,100),
              LEFT(orden,100),
              LEFT(sector,100),
              id_contrato,
              LEFT(estado_contrato,100),
              LEFT(codigo_categoria_principal,100),
              LEFT(descripcion_del_proceso,500),
              NULLIF(valor_contrato,'')::numeric(30,2),
              NULLIF(fecha_firma,'')::date,
              LEFT(modalidad,100),
              LEFT(contratista_nit,50),
              LEFT(contratista_nombre,255)
            FROM tmp_poblar
            WHERE NULLIF(id_contrato,'') IS NOT NULL
            """  # V3.3: INSERT plano sin ON CONFLICT (id_contrato ya no es unique: dups reales permitidos)
        )
        insertados = cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    conn.commit()
    return insertados


def descargar_streaming(url: str, destino: Path, timeout: int = 60, reintentos: int = 3) -> Path:
    """Descarga 5-7 GB en bloques de 1 MB con tqdm. Reintenta ante cortes de red."""
    from tqdm import tqdm

    if destino.exists() and destino.stat().st_size > 0:
        return destino  # reanuda: no re-descarga
    ultimo_error = None
    for intento in range(1, reintentos + 1):
        try:
            with requests.get(url, stream=True, timeout=timeout) as r:
                r.raise_for_status()
                total = int(r.headers.get("Content-Length", 0)) or None
                tmp = destino.with_suffix(".part")
                descargado = tmp.stat().st_size if tmp.exists() else 0
                headers = {"Range": f"bytes={descargado}-"} if descargado else {}
                if descargado:  # re-solicita desde donde quedo
                    r.close()
                    with requests.get(url, stream=True, timeout=timeout, headers=headers) as r2:
                        r2.raise_for_status()
                        total2 = int(r2.headers.get("Content-Length", 0)) or None
                        with open(tmp, "ab" if descargado else "wb") as f, tqdm(
                            total=(total2 + descargado) if total2 else None,
                            initial=descargado,
                            unit="B",
                            unit_scale=True,
                            desc=f"Descargando SECOP (intento {intento})",
                        ) as bar:
                            for bloque in r2.iter_content(chunk_size=1024 * 1024):
                                if bloque:
                                    f.write(bloque)
                                    bar.update(len(bloque))
                    tmp.rename(destino)
                    return destino
                with open(tmp, "wb") as f, tqdm(
                    total=total, unit="B", unit_scale=True, desc=f"Descargando SECOP (intento {intento})"
                ) as bar:
                    for bloque in r.iter_content(chunk_size=1024 * 1024):
                        if bloque:
                            f.write(bloque)
                            bar.update(len(bloque))
                tmp.rename(destino)
                return destino
        except (requests.exceptions.ConnectionError, requests.exceptions.ChunkedEncodingError, requests.exceptions.Timeout) as e:
            ultimo_error = e
            time.sleep(5 * intento)
            continue
    raise RuntimeError(f"Fallo descarga tras {reintentos} intentos: {ultimo_error}")


class Command(BaseCommand):
    help = "Descarga CSV SECOP II 9M en streaming y carga masiva con COPY (chunks pandas, sin saturar RAM)."

    def add_arguments(self, parser):
        parser.add_argument("--url", type=str, default=CSV_URL)
        parser.add_argument("--csv", type=str, default=str(Path.home() / "secop_9m.csv"), help="Ruta local del CSV")
        parser.add_argument("--no-download", action="store_true", help="No descargar, usar --csv existente")
        parser.add_argument("--chunksize", type=int, default=100000)
        parser.add_argument("--max-chunks", type=int, default=0, help="0 = todos; N = solo N chunks (prueba)")
        parser.add_argument("--encoding", type=str, default="utf-8")
        parser.add_argument("--recuperar", action="store_true",
                            help="V3.3: reinserta solo lo faltante (chunks 23/43 + fechas malas + dups). Requiere migracion 0013.")
        parser.add_argument("--chunks-fallidos", type=int, nargs="*", default=[23, 43],
                            help="Chunks abortados a reponer completos (1-based, chunksize 100000).")
        parser.add_argument("--recuperar2", action="store_true",
                            help="V3.3b: inserta dups intra-chunk omitidos (w>=2 y g==w, fecha valida, sin replay).")

    def handle(self, *args, **opciones):
        try:
            import pandas as pd
            from tqdm import tqdm
        except ImportError:
            self.stderr.write(self.style.ERROR("Falta pandas/tqdm. Corre: pip install pandas tqdm psycopg2-binary requests"))
            return
        t0 = time.time()
        ruta_csv = Path(opciones["csv"])
        chunksize = opciones["chunksize"]
        max_chunks = opciones["max_chunks"]

        # 1. Descarga streaming (salta si --no-download y el archivo existe).
        if not opciones["no_download"]:
            self.stdout.write(f"Bajando {opciones['url']} -> {ruta_csv} ...")
            try:
                descargar_streaming(opciones["url"], ruta_csv)
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error red: {e}"))
                return
        if not ruta_csv.exists():
            self.stderr.write(self.style.ERROR(f"No existe {ruta_csv}. Corre sin --no-download primero."))
            return
        gb = ruta_csv.stat().st_size / (1024 ** 3)
        self.stdout.write(self.style.SUCCESS(f"CSV listo: {ruta_csv} ({gb:.2f} GB)"))

        if opciones.get("recuperar"):
            self._recuperar(ruta_csv, chunksize, opciones, t0, gb)
            return
        if opciones.get("recuperar2"):
            self._recuperar2(ruta_csv, chunksize, opciones, t0)
            return

        # 2. Carga por chunks + COPY.
        conn = get_raw_conn()
        conn.autocommit = False
        total_leidas = 0
        total_insert = 0
        n_chunk = 0
        try:
            lector = pd.read_csv(
                ruta_csv,
                chunksize=chunksize,
                dtype=str,
                keep_default_na=False,
                encoding=opciones["encoding"],
                engine="python",
                on_bad_lines="skip",
            )
            with tqdm(desc="COPY chunks -> Postgres", unit="chunk") as bar:
                for crudo in lector:
                    n_chunk += 1
                    try:
                        limpio = mapear_chunk(crudo)
                        total_leidas += len(crudo)
                        nuevos = copy_chunk(conn, limpio)
                        total_insert += nuevos
                    except Exception as e:
                        conn.rollback()
                        self.stderr.write(self.style.WARNING(f"Chunk {n_chunk} omitido: {str(e)[:200]}"))
                    finally:
                        del crudo
                        try:
                            del limpio  # noqa: F821
                        except Exception:
                            pass
                        gc.collect()
                    bar.update(1)
                    bar.set_postfix(leidas=f"{total_leidas:,}", nuevas=f"{total_insert:,}")
                    if max_chunks and n_chunk >= max_chunks:
                        self.stdout.write(self.style.WARNING(f"Parada prueba: --max-chunks {max_chunks}"))
                        break
        finally:
            conn.close()

        mins = (time.time() - t0) / 60
        self.stdout.write(
            self.style.SUCCESS(f"OK {n_chunk} chunks | leidas {total_leidas:,} | insertadas {total_insert:,} | {mins:.1f} min | {gb:.2f} GB")
        )
        # V3.4: recalcula resúmenes para dashboard instantáneo (2 min con 9.3M).
        try:
            from django.core.management import call_command as _cc
            _cc("actualizar_resumenes")
        except Exception as e:
            self.stderr.write(self.style.WARNING(f"Resúmenes no recalculados: {str(e)[:200]} (corre actualizar_resumenes manual)"))

    def _recuperar(self, ruta_csv, chunksize, opciones, t0, gb):
        """V3.3: una pasada streaming que inserta SOLO lo faltante:
        - chunks abortados (23, 43: filas 2.2M-2.3M y 4.2M-4.3M) completos,
        - filas con fecha invalida (fecha NULL),
        - ocurrencias dup 2..n (la 1ra ya esta en BD).
        Todo lo demas se salta (ya existe)."""
        import pandas as pd
        from tqdm import tqdm

        fallidos = set(opciones.get("chunks_fallidos") or [])
        conn = get_raw_conn()
        conn.autocommit = False
        vistos = set()
        fila = 0
        insertados = 0
        sel_mala_fecha = sel_dup = sel_replay = 0
        pendientes = []
        PEND_MAX = 100000

        def vaciar():
            nonlocal insertados, pendientes
            if not pendientes:
                return
            lote = pd.concat(pendientes, ignore_index=True)
            pendientes = []
            try:
                insertados += copy_chunk(conn, lote)
            except Exception as e:
                conn.rollback()
                self.stderr.write(self.style.WARNING(f"Lote recuperacion omitido: {str(e)[:200]}"))
            finally:
                del lote
                gc.collect()

        try:
            lector = pd.read_csv(ruta_csv, chunksize=chunksize, dtype=str, keep_default_na=False,
                                 encoding=opciones["encoding"], engine="python", on_bad_lines="skip")
            with tqdm(desc="Recuperando faltantes", unit="chunk") as bar:
                for crudo in lector:
                    chunk_idx = fila // chunksize + 1
                    n = len(crudo)
                    if chunk_idx in fallidos:
                        # Replay completo: todo el chunk faltaba (abortado por overflow, ya corregido a numeric 30,2).
                        limpio = mapear_chunk(crudo, estricto=False)
                        sel_replay += len(limpio)
                        if len(limpio):
                            pendientes.append(limpio)
                        for i in crudo["ID del Proceso"] if "ID del Proceso" in crudo.columns else []:
                            vistos.add(norm(str(i)))
                    else:
                        mapa = {norm(c): c for c in crudo.columns}
                        col_id = next((mapa[a] for a in
                                       ["id del proceso", "id del contrato", "referencia del proceso", "pci"]
                                       if a in mapa), None)
                        col_fe = next((mapa[a] for a in
                                       ["fecha de publicacion del proceso", "fecha adjudicacion",
                                        "fecha de firma", "fecha de publicacion"] if a in mapa), None)
                        ids = crudo[col_id].astype(str).str.strip() if col_id else pd.Series([""] * n)
                        feas = pd.to_datetime(crudo[col_fe].astype(str).str.slice(0, 10),
                                              errors="coerce", format="mixed") if col_fe else pd.Series([pd.NaT] * n)
                        es_dup = ids.map(lambda x: x in vistos)
                        es_mala = feas.isna() & (ids != "")
                        mask = ((es_dup | es_mala) & (ids != "")).to_numpy()
                        vistos.update(i for i in ids if i and i not in ("nan", "None"))
                        if mask.any():
                            sub = mapear_chunk(crudo.iloc[mask], estricto=False)
                            sel_dup += int((es_dup & (ids != "")).to_numpy()[mask].sum())
                            sel_mala_fecha += int((es_mala).to_numpy()[mask].sum())
                            if len(sub):
                                pendientes.append(sub)
                    fila += n
                    if sum(len(p) for p in pendientes) >= PEND_MAX:
                        vaciar()
                    del crudo
                    gc.collect()
                    bar.update(1)
                    bar.set_postfix(rec=f"{insertados:,}")
            vaciar()
        finally:
            conn.close()
        mins = (time.time() - t0) / 60
        self.stdout.write(self.style.SUCCESS(
            f"RECUPERADO {insertados:,} (replay chunks {sorted(fallidos)}: {sel_replay:,}, "
            f"dups: {sel_dup:,}, fecha NULL: {sel_mala_fecha:,}) | {mins:.1f} min"))

    def _recuperar2(self, ruta_csv, chunksize, opciones, t0):
        """V3.3b: inserta EXACTAMENTE los dups intra-chunk omitidos en _recuperar.
        Regla por fila: w>=2 (ocurrencia dentro del chunk) Y g==w (global, sin vistos previos)
        Y fecha valida Y chunk fuera de replay. Demostrado: esos nunca entraron a BD."""
        import pandas as pd
        from tqdm import tqdm

        fallidos = set(opciones.get("chunks_fallidos") or [])
        conn = get_raw_conn()
        conn.autocommit = False
        base = {}
        fila = 0
        insertados = 0
        pendientes = []
        try:
            lector = pd.read_csv(ruta_csv, chunksize=chunksize, dtype=str, keep_default_na=False,
                                 encoding=opciones["encoding"], engine="python", on_bad_lines="skip")
            with tqdm(desc="Recuperando dups intra-chunk", unit="chunk") as bar:
                for crudo in lector:
                    chunk_idx = fila // chunksize + 1
                    n = len(crudo)
                    mapa = {norm(c): c for c in crudo.columns}
                    col_id = next((mapa[a] for a in
                                   ["id del proceso", "id del contrato", "referencia del proceso", "pci"]
                                   if a in mapa), None)
                    col_fe = next((mapa[a] for a in
                                   ["fecha de publicacion del proceso", "fecha adjudicacion",
                                    "fecha de firma", "fecha de publicacion"] if a in mapa), None)
                    if col_id and col_fe and chunk_idx not in fallidos:
                        ids = crudo[col_id].astype(str).str.strip()
                        feas = pd.to_datetime(crudo[col_fe].astype(str).str.slice(0, 10),
                                              errors="coerce", format="mixed")
                        validos = feas.notna() & (~ids.isin(["", "nan", "None"]))
                        w = ids.groupby(ids).cumcount() + 1
                        previos = ids.map(base).fillna(0).astype(int)
                        g = previos + w
                        mask = ((w >= 2) & (g == w) & validos).to_numpy()
                        if mask.any():
                            sub = mapear_chunk(crudo.iloc[mask], estricto=True)
                            if len(sub):
                                pendientes.append(sub)
                                if sum(len(p) for p in pendientes) >= 100000:
                                    lote = pd.concat(pendientes, ignore_index=True)
                                    pendientes = []
                                    try:
                                        insertados += copy_chunk(conn, lote)
                                    except Exception as e:
                                        conn.rollback()
                                        self.stderr.write(self.style.WARNING(f"Lote r2 omitido: {str(e)[:200]}"))
                                    finally:
                                        del lote
                                        gc.collect()
                    if col_id:
                        for i, c in crudo[col_id].astype(str).str.strip().value_counts().items():
                            if i and i not in ("nan", "None"):
                                base[i] = base.get(i, 0) + int(c)
                    fila += n
                    del crudo
                    gc.collect()
                    bar.update(1)
                    bar.set_postfix(rec=f"{insertados:,}")
            if pendientes:
                lote = pd.concat(pendientes, ignore_index=True)
                try:
                    insertados += copy_chunk(conn, lote)
                except Exception as e:
                    conn.rollback()
                    self.stderr.write(self.style.WARNING(f"Lote r2 final omitido: {str(e)[:200]}"))
                del lote
        finally:
            conn.close()
        mins = (time.time() - t0) / 60
        self.stdout.write(self.style.SUCCESS(f"RECUPERADO-2 {insertados:,} dups intra-chunk | {mins:.1f} min"))
