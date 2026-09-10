from django.db.models import Count, Sum, Avg, Q
from .models import Contrato, UmbralAlerta

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
        if not depto:
            return None
        k = self._clave(depto)
        todos = self.modelo.objects.values_list("departamento", flat=True).distinct()
        vals = [v for v in todos if self._clave(v) == k]
        return vals or [depto]

    def _filtrar_depto(self, qs, depto):
        vals = self._variantes(depto)
        if vals:
            qs = qs.filter(departamento__in=vals)
        return qs

    def resumen_optimizado(self, depto=None, anio=None, modalidad=None):
        qs = self.modelo.objects.all()
        qs = self._filtrar_depto(qs, depto)
        if anio:
            qs = qs.filter(fecha_firma__year=int(anio))
        if modalidad:
            qs = qs.filter(modalidad=modalidad)
        return qs.aggregate(total=Count("id"), suma_valor=Sum("valor_contrato"), promedio_valor=Avg("valor_contrato"))

    def resumen_naive(self, depto=None, anio=None, modalidad=None):
        contratos = list(self.modelo.objects.all())
        if depto:
            k = self._clave(depto)
            contratos = [c for c in contratos if self._clave(c.departamento) == k]
        if anio:
            contratos = [c for c in contratos if c.fecha_firma and str(c.fecha_firma.year) == str(anio)]
        if modalidad:
            contratos = [c for c in contratos if c.modalidad == modalidad]
        total = len(contratos)
        suma = sum((c.valor_contrato or 0) for c in contratos)
        promedio = suma / total if total else 0
        return {"total": total, "suma_valor": suma, "promedio_valor": promedio}

    def top_contratistas_optimizado(self, depto=None, limite=5):
        qs = self.modelo.objects.all()
        qs = self._filtrar_depto(qs, depto)
        return list(
            qs.values("contratista_nit", "contratista_nombre")
            .annotate(total_contratos=Count("id"), suma_valor=Sum("valor_contrato"))
            .order_by("-suma_valor")[:limite]
        )

    def top_contratistas_naive(self, depto=None, limite=5):
        contratos = list(self.modelo.objects.all())
        if depto:
            k = self._clave(depto)
            contratos = [c for c in contratos if self._clave(c.departamento) == k]
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
        base = (
            Q(contratista_nombre__icontains=q)
            | Q(contratista_nit__icontains=q)
            | Q(nombre_entidad__icontains=q)
            | Q(descripcion_del_proceso__icontains=q)
        )
        contratos = list(
            self.modelo.objects.filter(base).values(
                "id_contrato", "contratista_nombre", "nombre_entidad", "departamento"
            )[:limite]
        )
        empresas = list(
            self.modelo.objects.filter(base)
            .values("contratista_nit", "contratista_nombre")
            .annotate(total=Count("id"))
            .order_by("-total")[:limite]
        )
        entidades = list(
            self.modelo.objects.filter(base)
            .values("nombre_entidad", "departamento")
            .annotate(total=Count("id"))
            .order_by("-total")[:limite]
        )
        return {"contratos": contratos, "empresas": empresas, "entidades": entidades}

    def banderas_concentracion(self, umbral=30, depto=None):
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

servicio_contratos = ServicioContratos()
