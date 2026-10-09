from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Sum, Avg, Q, CharField, TextField, Transform


class Unaccent(Transform):
    # V3.4: lookup `campo__unaccent__icontains` insensible a tildes. Requiere
    # extensión unaccent en Postgres (CREATE EXTENSION unaccent).
    lookup_name = "unaccent"
    function = "unaccent"


CharField.register_lookup(Unaccent)
TextField.register_lookup(Unaccent)
from .models import Contrato, Entidad, UmbralAlerta, ResumenGlobal, ResumenDepto, ContratistaTotal, SerieMensual, TopDepto, SerieDepto, BanderaDet, EntidadDepto, PredominioEnt

class ServicioContratos:
    """Service Layer para SECOP - evita vistas gordas y centraliza ORM (Repository + Service)"""

    def __init__(self, modelo=Contrato):
        self.modelo = modelo

    def _clave(self, s):
        import unicodedata
        s = unicodedata.normalize("NFD", (s or "").upper())
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return " ".join("".join(c if c.isalpha() else " " for c in s).split())

    def _variantes(self, depto):
        # RF-16: el clic del mapa manda el nombre canónico con tilde,
        # pero la BD tiene variantes (Boyaca/Boyacá). Filtra por todas.
        # V3.4: 34 deptos salen de resumen_depto (instantáneo), no DISTINCT 9.3M.
        if not depto:
            return None
        k = self._clave(depto)
        todos = cache.get("deptos_distintos")
        if todos is None:
            todos = list(ResumenDepto.objects.values_list("departamento", flat=True))
            if not todos:
                todos = list(self.modelo.objects.values_list("departamento", flat=True).distinct())
            cache.set("deptos_distintos", todos, 3600)
        vals = [v for v in todos if self._clave(v) == k]
        return vals or [depto]

    def _filtrar_depto(self, qs, depto):
        vals = self._variantes(depto)
        if vals:
            qs = qs.filter(departamento__in=vals)
        return qs

    def _variantes_modalidad(self, modalidad):
        # V3.4: modalidad insensible a tildes (contratacion == Contratación).
        # Conjunto cerrado (~10): DISTINCT una vez + cache 1h.
        if not modalidad:
            return None
        k = self._clave(modalidad)
        todas = cache.get("modalidades_distintas")
        if todas is None:
            todas = list(self.modelo.objects.values_list("modalidad", flat=True).distinct())
            cache.set("modalidades_distintas", todas, 3600)
        vals = [v for v in todas if v and self._clave(v) == k]
        return vals or [modalidad]

    def _filtrar_modalidad(self, qs, modalidad):
        vals = self._variantes_modalidad(modalidad)
        if vals:
            qs = qs.filter(modalidad__in=vals)
        return qs

    def resumen_optimizado(self, depto=None, anio=None, modalidad=None):
        # V3.4: sin filtros → ResumenGlobal. Solo depto → ResumenDepto. El resto → vivo.
        if not depto and not anio and not modalidad:
            g = ResumenGlobal.objects.first()
            if g is not None:
                return {"total": g.total, "suma_valor": g.suma, "promedio_valor": g.promedio}
        if depto and not anio and not modalidad and ResumenDepto.objects.exists():
            vals = self._variantes(depto)
            agg = ResumenDepto.objects.filter(departamento__in=vals).aggregate(
                total=Sum("total"), suma_valor=Sum("suma"))
            total = agg["total"] or 0
            suma = agg["suma_valor"] or 0
            return {"total": total, "suma_valor": suma,
                    "promedio_valor": (suma / total) if total else 0}
        qs = self.modelo.objects.all()
        qs = self._filtrar_depto(qs, depto)
        if anio:
            qs = qs.filter(fecha_firma__year=int(anio))
        if modalidad:
            qs = self._filtrar_modalidad(qs, modalidad)
        return qs.aggregate(total=Count("id"), suma_valor=Sum("valor_contrato"), promedio_valor=Avg("valor_contrato"))

    def resumen_naive(self, depto=None, anio=None, modalidad=None):
        # Naive = trae FILAS y agrega en Python (sin COUNT/SUM en BD: esa es la demo).
        # Filtra con WHERE antes de materializar: con 470k globales, list(all())
        # tumbaría RAM aunque el filtro (Boyacá ~11k) sí cabe. El guard 413 vive en la vista.
        qs = self.modelo.objects.all()
        if depto:
            vals = self._variantes(depto)
            if vals:
                qs = qs.filter(departamento__in=vals)
            else:
                return {"total": 0, "suma_valor": 0, "promedio_valor": 0}
        if anio:
            qs = qs.filter(fecha_firma__year=int(anio))
        if modalidad:
            qs = self._filtrar_modalidad(qs, modalidad)
        contratos = list(qs)
        total = len(contratos)
        suma = sum((c.valor_contrato or 0) for c in contratos)
        promedio = suma / total if total else 0
        return {"total": total, "suma_valor": suma, "promedio_valor": promedio}

    def top_contratistas_optimizado(self, depto=None, limite=5):
        # V3.4: tablas preagregadas (vacías en tests → vivo como fallback).
        if not depto and ContratistaTotal.objects.exists():
            return list(
                ContratistaTotal.objects.order_by("-suma_valor").values(
                    "contratista_nit", "contratista_nombre", "total_contratos", "suma_valor"
                )[:limite]
            )
        if depto and TopDepto.objects.exists():
            vals = self._variantes(depto)
            return list(
                TopDepto.objects.filter(departamento__in=vals).order_by("-suma_valor").values(
                    "contratista_nit", "contratista_nombre", "total_contratos", "suma_valor"
                )[:limite]
            )
        qs = self.modelo.objects.all()
        qs = self._filtrar_depto(qs, depto)
        return list(
            qs.values("contratista_nit", "contratista_nombre")
            .annotate(total_contratos=Count("id"), suma_valor=Sum("valor_contrato"))
            .order_by("-suma_valor")[:limite]
        )

    def top_contratistas_naive(self, depto=None, limite=5):
        # Igual que resumen_naive: WHERE en BD, agrupación en Python.
        qs = self.modelo.objects.all()
        if depto:
            vals = self._variantes(depto)
            if vals:
                qs = qs.filter(departamento__in=vals)
            else:
                return []
        contratos = list(qs)
        acumulado = {}
        for c in contratos:
            k = (c.contratista_nit, c.contratista_nombre)
            if k not in acumulado:
                acumulado[k] = {"contratista_nit": k[0], "contratista_nombre": k[1], "total_contratos": 0, "suma_valor": 0}
            acumulado[k]["total_contratos"] += 1
            acumulado[k]["suma_valor"] += float(c.valor_contrato or 0)
        return sorted(acumulado.values(), key=lambda x: x["suma_valor"], reverse=True)[:limite]
    
    def buscar(self, q, limite=10):
        q = (q or "").strip()
        if len(q) < 2:
            return {"contratos": [], "empresas": [], "entidades": []}
        # V3.4: cache 10min por query (3 full-scans en frío duelen con 9.3M + 8GB RAM).
        ck = f"buscar:{q[:80]}:{limite}"
        hit = cache.get(ck)
        if hit is not None:
            return hit
        # P1: 0 GROUP BY sobre 9.3M. empresas/entidades salen de tablas chicas
        # (contratista_total / entidad 11.5k + conteo por NIT con índice).
        # Con tablas vacías (tests) fallback al vivo. `contratos` conserva 1 query
        # con LIMIT (corta al hallar N, sin agregación total) + cache 10min.
        import unicodedata
        q_plano = "".join(
            c for c in unicodedata.normalize("NFD", q) if unicodedata.category(c) != "Mn")
        if ContratistaTotal.objects.exists():
            empresas = [
                {"contratista_nit": r["contratista_nit"],
                 "contratista_nombre": r["contratista_nombre"],
                 "total": r["total_contratos"]}
                for r in ContratistaTotal.objects.filter(
                    Q(contratista_nombre__unaccent__icontains=q_plano)
                    | Q(contratista_nit__icontains=q_plano)
                ).order_by("-total_contratos").values(
                    "contratista_nit", "contratista_nombre", "total_contratos"
                )[:limite]
            ]
        else:
            empresas = list(
                self.modelo.objects.filter(
                    Q(contratista_nombre__unaccent__icontains=q_plano)
                    | Q(contratista_nit__icontains=q_plano)
                ).values("contratista_nit", "contratista_nombre")
                .annotate(total=Count("id"))
                .order_by("-total")[:limite]
            )
        if Entidad.objects.exists():
            matches = list(Entidad.objects.filter(
                Q(nombre_entidad__unaccent__icontains=q_plano)
                | Q(nit_entidad__icontains=q_plano)
            ).values("nombre_entidad", "nit_entidad", "departamento")[:limite])
            totales = {
                r["nit_entidad"]: r["total"]
                for r in self.modelo.objects.filter(
                    nit_entidad__in=[m["nit_entidad"] for m in matches]
                ).values("nit_entidad").annotate(total=Count("id"))
            } if matches else {}
            entidades = [
                {"nombre_entidad": m["nombre_entidad"],
                 "departamento": m["departamento"],
                 "total": totales.get(m["nit_entidad"], 0)}
                for m in matches
            ]
        else:
            entidades = list(
                self.modelo.objects.filter(
                    Q(nombre_entidad__unaccent__icontains=q_plano)
                ).values("nombre_entidad", "departamento")
                .annotate(total=Count("id"))
                .order_by("-total")[:limite]
            )
        base = (
            Q(contratista_nombre__unaccent__icontains=q_plano)
            | Q(contratista_nit__icontains=q_plano)
            | Q(nombre_entidad__unaccent__icontains=q_plano)
            | Q(descripcion_del_proceso__icontains=q)
        )
        contratos = list(
            self.modelo.objects.filter(base).values(
                "id_contrato", "contratista_nombre", "nombre_entidad", "departamento"
            )[:limite]
        )
        out = {"contratos": contratos, "empresas": empresas, "entidades": entidades}
        cache.set(ck, out, 600)
        return out

    def _banderas_fast(self, umbral=30, depto=None):
        umbral = float(umbral)
        vals = self._variantes(depto) if depto else None
        if vals:
            sql = (
                "SELECT d.nombre_entidad, d.contratista_nit, d.contratista_nombre, "
                "SUM(d.monto) AS monto, SUM(d.contratos) AS contratos, "
                "SUM(d.monto)*100/NULLIF(SUM(e.total),0) AS pct "
                "FROM bandera_det d JOIN entidad_depto e "
                "ON e.departamento = ANY(%s) AND e.nombre_entidad = d.nombre_entidad "
                "WHERE d.departamento = ANY(%s) "
                "GROUP BY d.nombre_entidad, d.contratista_nit, d.contratista_nombre "
                "HAVING SUM(d.monto)*100/NULLIF(SUM(e.total),0) >= %s "
                "ORDER BY pct DESC"
            )
            params = [vals, vals, umbral]
        else:
            sql = (
                "SELECT d.nombre_entidad, d.contratista_nit, d.contratista_nombre, "
                "SUM(d.monto) AS monto, SUM(d.contratos) AS contratos, "
                "SUM(d.monto)*100/NULLIF(SUM(e.total),0) AS pct "
                "FROM bandera_det d JOIN entidad_depto e ON e.nombre_entidad = d.nombre_entidad "
                "GROUP BY d.nombre_entidad, d.contratista_nit, d.contratista_nombre "
                "HAVING SUM(d.monto)*100/NULLIF(SUM(e.total),0) >= %s "
                "ORDER BY pct DESC"
            )
            params = [umbral]
        banderas = []
        with connection.cursor() as cur:
            cur.execute(sql, params)
            for ent, nit, nom, monto, n, pct in cur.fetchall():
                banderas.append({
                    "contratista_nit": nit,
                    "contratista_nombre": nom,
                    "entidad": ent,
                    "porcentaje": round(float(pct or 0), 2),
                    "monto": float(monto or 0),
                    "contratos": n,
                })
        return {"umbral": umbral, "total": len(banderas), "banderas": banderas}

    def banderas_concentracion(self, umbral=30, depto=None):
        # V3.4: tablas precalculadas (vacías en tests → vivo como fallback).
        if BanderaDet.objects.exists():
            return self._banderas_fast(umbral, depto)
        qs = self.modelo.objects.all()
        qs = self._filtrar_depto(qs, depto)
        totales = {
            r["nombre_entidad"]: float(r["total"] or 0)
            for r in qs.values("nombre_entidad").annotate(total=Sum("valor_contrato"))
        }
        por_contratista = (
            qs.values("nombre_entidad", "contratista_nit", "contratista_nombre")
            .annotate(monto=Sum("valor_contrato"), contratos=Count("id"))
        )
        banderas = []
        for r in por_contratista:
            total_ent = totales.get(r["nombre_entidad"]) or 0
            if not total_ent:
                continue
            pct = float(r["monto"] or 0) * 100 / total_ent
            if pct >= float(umbral):
                banderas.append({
                    "contratista_nit": r["contratista_nit"],
                    "contratista_nombre": r["contratista_nombre"],
                    "entidad": r["nombre_entidad"],
                    "porcentaje": round(pct, 2),
                    "monto": float(r["monto"] or 0),
                    "contratos": r["contratos"],
                })
        banderas.sort(key=lambda x: x["porcentaje"], reverse=True)
        return {"umbral": float(umbral), "total": len(banderas), "banderas": banderas}

    def predominio_directa(self, umbral=80, depto=None):
        # RF-20: bandera por entidad si % directa supera umbral. Qué: GROUP BY entidad en BD. Por qué: detectar fraccionamiento.
        # V3.4: tabla precalculada (vacía en tests → vivo como fallback).
        if PredominioEnt.objects.exists():
            umbral = float(umbral)
            qs = PredominioEnt.objects.filter(pct__gte=umbral)
            if depto:
                qs = qs.filter(departamento__in=self._variantes(depto))
            banderas = [{
                "entidad": r.nombre_entidad,
                "porcentaje_directa": float(r.pct or 0),
                "total": r.total,
                "directas": r.directas,
                "suma_total": float(r.suma_total or 0),
                "suma_directa": float(r.suma_directa or 0),
            } for r in qs.order_by("-pct")]
            return {"umbral": umbral, "total": len(banderas), "banderas": banderas}
        qs = self.modelo.objects.all()
        qs = self._filtrar_depto(qs, depto)
        directas_q = Q(modalidad__in=["Contratación directa", "Contratacion directa"])
        filas = (
            qs.values("nombre_entidad")
            .annotate(
                total=Count("id"),
                directas=Count("id", filter=directas_q),
                suma_total=Sum("valor_contrato"),
                suma_directa=Sum("valor_contrato", filter=directas_q),
            )
            .order_by("-total")
        )
        banderas = []
        for r in filas:
            total = r["total"] or 0
            if not total:
                continue
            pct = float(r["directas"] or 0) * 100 / total
            if pct >= float(umbral):
                banderas.append({
                    "entidad": r["nombre_entidad"],
                    "porcentaje_directa": round(pct, 2),
                    "total": total,
                    "directas": r["directas"],
                    "suma_total": float(r["suma_total"] or 0),
                    "suma_directa": float(r["suma_directa"] or 0),
                })
        banderas.sort(key=lambda x: x["porcentaje_directa"], reverse=True)
        return {"umbral": float(umbral), "total": len(banderas), "banderas": banderas}

    def mapa_directa_optimizado(self):
        import unicodedata
        # V3.4: 34 filas precalculadas en vez de GROUP BY 9.3M.
        datos = [
            {"departamento": r.departamento, "total": r.total, "directas": r.directas,
             "suma_total": r.suma, "suma_directa": r.suma_directa}
            for r in ResumenDepto.objects.all()
        ]
        if not datos:
            datos = list(
                self.modelo.objects.values("departamento")
                .annotate(
                    total=Count("id"),
                    directas=Count("id", filter=Q(modalidad__in=["Contratación directa", "Contratacion directa"])),
                    suma_total=Sum("valor_contrato"),
                    suma_directa=Sum("valor_contrato", filter=Q(modalidad__in=["Contratación directa", "Contratacion directa"])),
                )
                .order_by("-total")
            )
        def arreglar(s):
            # Corrige mojibake tipo BogotÃ¡ -> Bogotá (UTF-8 leído como latin1)
            if s and "Ã" in s:
                try:
                    return s.encode("latin1").decode("utf8")
                except Exception:
                    pass
            return s
        def clave(s):
            s = arreglar(s or "")
            s = unicodedata.normalize("NFD", s.upper())
            s = "".join(c for c in s if unicodedata.category(c) != "Mn")
            return " ".join("".join(c if c.isalpha() else " " for c in s).split())
        # Nombre bonito para mostrar en tooltip
        bonitos = {
            "DISTRITO CAPITAL DE BOGOTA": "Distrito Capital de Bogotá",
            "BOYACA": "Boyacá",
            "BOLIVAR": "Bolívar",
            "ATLANTICO": "Atlántico",
            "CORDOBA": "Córdoba",
            "CAQUETA": "Caquetá",
            "CHOCO": "Chocó",
            "GUAINIA": "Guainía",
            "VAUPES": "Vaupés",
            "NARINO": "Nariño",
            "QUINDIO": "Quindío",
        }
        combinado = {}
        for d in datos:
            k = clave(d["departamento"])
            if k not in combinado:
                combinado[k] = {"departamento": bonitos.get(k, arreglar(d["departamento"])), "total": 0, "directas": 0, "suma_total": 0.0, "suma_directa": 0.0}
            c = combinado[k]
            c["total"] += d["total"] or 0
            c["directas"] += d["directas"] or 0
            c["suma_total"] += float(d["suma_total"] or 0)
            c["suma_directa"] += float(d["suma_directa"] or 0)
        salida = list(combinado.values())
        for d in salida:
            d["porcentaje_directa"] = round(d["directas"] * 100 / d["total"], 2) if d["total"] else 0
        return sorted(salida, key=lambda x: -x["total"])

    # RF-24: umbrales persistentes
    UMBRALES_DEFECTO = {
        "concentracion": (30, "Bandera si contratista supera % del presupuesto de la entidad"),
        "predominio_directa": (80, "Bandera si entidad supera % en contratación directa"),
    }

    def obtener_umbral(self, nombre, defecto=None):
        nombre = (nombre or "").strip()
        if nombre in self.UMBRALES_DEFECTO and defecto is None:
            defecto = self.UMBRALES_DEFECTO[nombre][0]
        obj, creado = UmbralAlerta.objects.get_or_create(
            nombre=nombre,
            defaults={"valor": defecto if defecto is not None else 30,
                      "descripcion": self.UMBRALES_DEFECTO.get(nombre, ("", ""))[1]},
        )
        return float(obj.valor)

    def listar_umbrales(self):
        # Asegura que existan los 2 base y los devuelve ordenados
        for nombre, (valor, desc) in self.UMBRALES_DEFECTO.items():
            UmbralAlerta.objects.get_or_create(nombre=nombre, defaults={"valor": valor, "descripcion": desc})
        return list(UmbralAlerta.objects.all().order_by("nombre").values("nombre", "valor", "descripcion", "actualizado_en"))

    def actualizar_umbral(self, nombre, valor):
        nombre = (nombre or "").strip()
        try:
            v = float(valor)
        except (TypeError, ValueError):
            raise ValueError("Umbral inválido, use un número entre 0 y 100.")
        if not 0 < v <= 100:
            raise ValueError("Umbral inválido, use un número entre 0 y 100.")
        obj, _ = UmbralAlerta.objects.get_or_create(nombre=nombre, defaults={"valor": v})
        obj.valor = v
        obj.save()
        return {"nombre": obj.nombre, "valor": float(obj.valor)}

    def estadisticas_por_entidad(self, nit=None, entidad_id=None, depto=None, fecha_desde=None, fecha_hasta=None):
        # RF-27: stats por entidad agrupando por MODELO (criterio 3), con fallback a texto ETL sin FK.
        # Qué: total + distribución modalidad + top contratistas. Por qué: ver desempeño y concentración por entidad.
        entidad = None
        if entidad_id:
            try:
                entidad = Entidad.objects.get(id=int(entidad_id))
            except (Entidad.DoesNotExist, TypeError, ValueError):
                entidad = None
        if entidad is None and nit:
            entidad = Entidad.objects.filter(nit_entidad=str(nit).strip()).first()
        if entidad is not None:
            nit_str = entidad.nit_entidad
            info = {"id": entidad.id, "nombre_entidad": entidad.nombre_entidad, "nit_entidad": entidad.nit_entidad,
                    "departamento": entidad.departamento, "ciudad": entidad.ciudad, "sector": entidad.sector}
        elif nit:
            nit_str = str(nit).strip()
            primero = self.modelo.objects.filter(nit_entidad=nit_str).order_by("id").first()
            info = {"id": None, "nombre_entidad": primero.nombre_entidad if primero else "",
                    "nit_entidad": nit_str, "departamento": "", "ciudad": "", "sector": ""}
        else:
            return {"entidad": None, "total_contratos": 0, "total_contratado": 0.0,
                    "por_modalidad": [], "top_contratistas": []}
        # P1: 1 pasada con GROUPING SETS (total + modalidad + contratista).
        # Antes eran 3 scans de ~182k filas (22s en disco); ahora 1.
        conds = ["nit_entidad = %s"]
        params = [nit_str]
        if depto:
            vals = self._variantes(depto)
            if vals:
                conds.append("departamento IN (%s)" % ",".join(["%s"] * len(vals)))
                params.extend(vals)
        if fecha_desde:
            conds.append("fecha_firma >= %s")
            params.append(fecha_desde)
        if fecha_hasta:
            conds.append("fecha_firma <= %s")
            params.append(fecha_hasta)
        sql = (
            "SELECT modalidad, contratista_nit, contratista_nombre,"
            " COUNT(*) AS total, SUM(valor_contrato) AS suma,"
            " GROUPING(modalidad, contratista_nit, contratista_nombre) AS grp"
            " FROM %s WHERE %s"
            " GROUP BY GROUPING SETS ((), (modalidad), (contratista_nit, contratista_nombre))"
            % (self.modelo._meta.db_table, " AND ".join(conds))
        )
        with connection.cursor() as cur:
            cur.execute(sql, params)
            filas = cur.fetchall()
        total = 0
        suma_total = 0.0
        por_modalidad = []
        contratistas = []
        for modalidad, cnit, cnombre, t, s, grp in filas:
            if grp == 7:
                total = t or 0
                suma_total = float(s or 0)
            elif grp == 3:
                por_modalidad.append({"modalidad": modalidad, "total": t, "suma": float(s or 0)})
            elif grp == 4:
                contratistas.append({"contratista_nit": cnit, "contratista_nombre": cnombre,
                                     "total": t, "suma": float(s or 0)})
        if total == 0:
            return {"entidad": info, "total_contratos": 0, "total_contratado": 0.0,
                    "por_modalidad": [], "top_contratistas": []}
        por_modalidad.sort(key=lambda r: -r["total"])
        contratistas.sort(key=lambda r: -r["suma"])
        return {"entidad": info, "total_contratos": total, "total_contratado": suma_total,
                "por_modalidad": por_modalidad, "top_contratistas": contratistas[:5]}

    COLORES_MODALIDAD = {
        "Contratación directa": "#dc2626",
        "Contratacion directa": "#dc2626",
        "Licitación pública": "#059669",
        "Licitacion publica": "#059669",
        "Concurso de méritos": "#2563eb",
        "Selección abreviada": "#d97706",
        "Mínima cuantía": "#7c3aed",
    }

    def _color_modalidad(self, modalidad):
        # Grafo legible: las modalidades reales (régimen especial, subasta inversa…)
        # no estaban en el mapa exacto y todo salía gris. Match por palabra clave.
        import unicodedata
        m = "".join(c for c in unicodedata.normalize("NFD", str(modalidad or "").lower()) if unicodedata.category(c) != "Mn")
        if "directa" in m:
            return "#dc2626"
        if "licitacion" in m or "obra publica" in m:
            return "#059669"
        if "merito" in m:
            return "#2563eb"
        if "abreviada" in m or "subasta" in m:
            return "#d97706"
        if "minima" in m or "menor cuantia" in m:
            return "#7c3aed"
        if "especial" in m or "regimen" in m:
            return "#0891b2"
        return "#6b7280"

    def grafo_red(self, limite=50, depto=None):
        # RF-17: nodos entidad/contratista + aristas contrato. Qué: top montos para no congelar.
        # Por qué: el grosor muestra monto y el color la modalidad de un vistazo.
        import math
        try:
            limite = int(limite)
        except (TypeError, ValueError):
            limite = 50
        limite = max(1, min(limite, 200))
        qs = self.modelo.objects.all().order_by("-valor_contrato")
        qs = self._filtrar_depto(qs, depto)
        filas = list(qs.values("nombre_entidad", "nit_entidad", "contratista_nit",
                               "contratista_nombre", "modalidad", "valor_contrato")[:limite])
        if not filas:
            return {"nodos": [], "aristas": [], "total": 0}
        max_monto = max(float(f["valor_contrato"] or 0) for f in filas) or 1.0
        nodos, vistos = [], set()
        aristas = []
        for i, f in enumerate(filas):
            ent_id = "E:" + (f["nit_entidad"] or f["nombre_entidad"] or "?")
            con_id = "C:" + (f["contratista_nit"] or f["contratista_nombre"] or "?")
            if ent_id not in vistos:
                vistos.add(ent_id)
                nodos.append({"id": ent_id, "tipo": "entidad", "nombre": f["nombre_entidad"]})
            if con_id not in vistos:
                vistos.add(con_id)
                nodos.append({"id": con_id, "tipo": "contratista", "nombre": f["contratista_nombre"]})
            monto = float(f["valor_contrato"] or 0)
            grosor = round(1 + 7 * (math.log1p(monto) / math.log1p(max_monto)), 2)
            aristas.append({"source": ent_id, "target": con_id, "monto": monto,
                            "modalidad": f["modalidad"],
                            "color": self._color_modalidad(f["modalidad"]),
                            "grosor": grosor})
        return {"nodos": nodos, "aristas": aristas, "total": len(aristas)}

    # RF-26: actualización periódica reutilizando paginación
    def obtener_config_actualizacion(self):
        from .models import ConfigActualizacion
        cfg, _ = ConfigActualizacion.objects.get_or_create(id=1, defaults={"intervalo_horas": 24, "activo": False})
        return cfg

    def actualizar_config_actualizacion(self, intervalo_horas=None, activo=None):
        from .models import ConfigActualizacion
        cfg = self.obtener_config_actualizacion()
        if intervalo_horas is not None:
            try:
                iv = int(intervalo_horas)
            except (TypeError, ValueError):
                raise ValueError("Intervalo inválido, use horas entre 1 y 720.")
            if not 1 <= iv <= 720:
                raise ValueError("Intervalo inválido, use horas entre 1 y 720.")
            cfg.intervalo_horas = iv
        if activo is not None:
            cfg.activo = bool(activo)
        cfg.save()
        return cfg

    def programar_actualizacion_periodica(self, limite=50, offset=0, depto=None):
        """Crea TrabajoCarga periódica. Qué: reutiliza bulk_create con ignore_conflicts. Por qué: sin duplicar."""
        from .models import TrabajoCarga, ConfigActualizacion
        from django.utils import timezone
        # Validar que no haya una en_progreso periódica activa (no mezclar)
        if TrabajoCarga.objects.filter(estado="en_progreso", origen="periodica").exists():
            raise ValueError("Ya hay una actualización periódica en curso.")
        trabajo = TrabajoCarga.objects.create(estado="pendiente", origen="periodica", offset_actual=offset, total_registros=0)
        # Actualizar config última ejecución pendiente
        cfg = self.obtener_config_actualizacion()
        cfg.ultima_ejecucion = timezone.now()
        cfg.ultimo_estado = "pendiente"
        cfg.save(update_fields=["ultima_ejecucion", "ultimo_estado", "actualizado_en"])
        return trabajo

    def ultima_actualizacion(self):
        from .models import TrabajoCarga, ConfigActualizacion
        cfg = self.obtener_config_actualizacion()
        ultimo = TrabajoCarga.objects.order_by("-creado_en").first()
        return {
            "config": {
                "intervalo_horas": cfg.intervalo_horas,
                "activo": cfg.activo,
                "ultima_ejecucion": cfg.ultima_ejecucion.isoformat() if cfg.ultima_ejecucion else None,
                "ultimo_estado": cfg.ultimo_estado,
            },
            "ultimo_trabajo": {
                "id": ultimo.id if ultimo else None,
                "estado": ultimo.estado if ultimo else None,
                "origen": ultimo.origen if ultimo else None,
                "registros_procesados": ultimo.registros_procesados if ultimo else 0,
                "nuevos_registros": ultimo.nuevos_registros if ultimo else 0,
                "total_registros": ultimo.total_registros if ultimo else 0,
                "offset_actual": ultimo.offset_actual if ultimo else 0,
                "creado_en": ultimo.creado_en.isoformat() if ultimo and ultimo.creado_en else None,
                "actualizado_en": ultimo.actualizado_en.isoformat() if ultimo and ultimo.actualizado_en else None,
                "mensaje_error": ultimo.mensaje_error if ultimo else None,
            } if ultimo else None,
        }

    # RNF-09: backup 7 días con retención
    def crear_backup(self):
        """Crea JSON dump de contratos + registra y purga >7 días. Qué: respaldo. Por qué: recuperar ante pérdida."""
        import json
        import os
        from pathlib import Path
        from datetime import timedelta
        from django.conf import settings
        from django.utils import timezone
        from .models import BackupRegistro

        base = Path(settings.BASE_DIR) / "backups"
        base.mkdir(parents=True, exist_ok=True)
        ts = timezone.now().strftime("%Y%m%d_%H%M%S")
        archivo = base / f"secop_backup_{ts}.json"
        # dump contratos (solo campos clave para no pesar 5M en dev)
        datos = list(self.modelo.objects.all().values(
            "id_contrato", "nombre_entidad", "nit_entidad", "departamento", "ciudad",
            "valor_contrato", "fecha_firma", "modalidad", "contratista_nit", "contratista_nombre"
        ).order_by("id")[:100000])  # cap 100k para no colapsar en 5M
        # convertir Decimals/dates a str
        for r in datos:
            if r["valor_contrato"] is not None:
                r["valor_contrato"] = str(r["valor_contrato"])
            if r["fecha_firma"] is not None:
                r["fecha_firma"] = r["fecha_firma"].isoformat()
        try:
            with open(archivo, "w", encoding="utf-8") as f:
                json.dump(datos, f, ensure_ascii=False, indent=2)
            tamaño = archivo.stat().st_size
            reg = BackupRegistro.objects.create(archivo=str(archivo), tamano_bytes=tamaño, registros=len(datos), estado="completado")
            # retención 7 días: borrar archivos y registros viejos
            limite = timezone.now() - timedelta(days=7)
            viejos = BackupRegistro.objects.filter(creado_en__lt=limite)
            for v in viejos:
                try:
                    Path(v.archivo).unlink(missing_ok=True)
                except Exception:
                    pass
                v.delete()
            return reg
        except Exception as e:
            reg = BackupRegistro.objects.create(archivo=str(archivo), tamano_bytes=0, registros=0, estado="error", mensaje_error=str(e))
            raise ValueError(f"Backup falló: {e}") from e

    def listar_backups(self, limite=20):
        from .models import BackupRegistro
        # P1: campo ascii tamano_bytes, sin alias ñ.
        return list(BackupRegistro.objects.all().order_by("-creado_en").values("id", "archivo", "tamano_bytes", "registros", "estado", "creado_en")[:limite])

    # RNF-08: auditoría
    def registrar_auditoria(self, usuario, accion, detalle=""):
        from .models import Auditoria
        # nunca loguear contraseñas
        detalle = (detalle or "")[:500].replace("contrasena", "***").replace("password", "***")
        usuario_str = ""
        if hasattr(usuario, "username"):
            usuario_str = usuario.username
        elif isinstance(usuario, str):
            usuario_str = usuario
        else:
            usuario_str = str(usuario)[:150]
        return Auditoria.objects.create(usuario=usuario_str, accion=accion, detalle=detalle)

servicio_contratos = ServicioContratos()
