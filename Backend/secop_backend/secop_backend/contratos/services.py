from django.db.models import Count, Sum, Avg, Q
from .models import Contrato

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
servicio_contratos = ServicioContratos()
