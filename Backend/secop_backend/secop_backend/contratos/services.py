from django.db.models import Count, Sum, Avg
from .models import Contrato

class ServicioContratos:
    """Service Layer para SECOP - evita vistas gordas y centraliza ORM (Repository + Service)"""

    def __init__(self, modelo=Contrato):
        self.modelo = modelo

    def resumen_optimizado(self, depto=None, anio=None, modalidad=None):
        qs = self.modelo.objects.all()
        if depto:
            qs = qs.filter(departamento=depto)
        if anio:
            qs = qs.filter(fecha_firma__year=int(anio))
        if modalidad:
            qs = qs.filter(modalidad=modalidad)
        return qs.aggregate(total=Count("id"), suma_valor=Sum("valor_contrato"), promedio_valor=Avg("valor_contrato"))

    def resumen_naive(self, depto=None, anio=None, modalidad=None):
        contratos = list(self.modelo.objects.all())
        if depto:
            contratos = [c for c in contratos if c.departamento == depto]
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
        if depto:
            qs = qs.filter(departamento=depto)
        return list(
            qs.values("contratista_nit", "contratista_nombre")
            .annotate(total_contratos=Count("id"), suma_valor=Sum("valor_contrato"))
            .order_by("-suma_valor")[:limite]
        )

    def top_contratistas_naive(self, depto=None, limite=5):
        contratos = list(self.modelo.objects.all())
        if depto:
            contratos = [c for c in contratos if c.departamento == depto]
        acumulado = {}
        for c in contratos:
            k = (c.contratista_nit, c.contratista_nombre)
            if k not in acumulado:
                acumulado[k] = {"contratista_nit": k[0], "contratista_nombre": k[1], "total_contratos": 0, "suma_valor": 0}
            acumulado[k]["total_contratos"] += 1
            acumulado[k]["suma_valor"] += float(c.valor_contrato or 0)
        return sorted(acumulado.values(), key=lambda x: x["suma_valor"], reverse=True)[:limite]

servicio_contratos = ServicioContratos()
