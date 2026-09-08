import threading
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.management import call_command
from .models import TrabajoCarga, Contrato
from django.db.models import Count, Sum, Avg


def tarea_carga(trabajo_id, limite, offset, depto):
    try:
        call_command("cargar_secop", limit=limite, offset=offset, depto=depto, trabajo_id=trabajo_id)
    except Exception as e:
        trabajo = TrabajoCarga.objects.get(id=trabajo_id)
        trabajo.estado = "error"
        trabajo.mensaje_error = str(e)
        trabajo.save()

class VistaIniciarCarga(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        limite = int(request.data.get("limit", 50))
        offset = int(request.data.get("offset", 0))
        depto = request.data.get("depto")
        trabajo = TrabajoCarga.objects.create(estado="pendiente", offset_actual=offset)
        t = threading.Thread(target=tarea_carga, args=(trabajo.id, limite, offset, depto), daemon=True)
        t.start()
        return Response({"id": trabajo.id, "estado": trabajo.estado}, status=status.HTTP_202_ACCEPTED)

class VistaEstadoCarga(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        trabajo = TrabajoCarga.objects.get(id=pk)
        return Response({
            "id": trabajo.id,
            "estado": trabajo.estado,
            "total_registros": trabajo.total_registros,
            "registros_procesados": trabajo.registros_procesados,
            "offset_actual": trabajo.offset_actual,
            "mensaje_error": trabajo.mensaje_error
        })



class VistaResumenOptimizado(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        depto = request.query_params.get("depto")
        anio = request.query_params.get("anio")
        modalidad = request.query_params.get("modalidad")
        qs = Contrato.objects.all()
        if depto:
            qs = qs.filter(departamento=depto)
        if anio:
            qs = qs.filter(fecha_firma__year=int(anio))
        if modalidad:
            qs = qs.filter(modalidad=modalidad)
        datos = qs.aggregate(
            total=Count("id"),
            suma_valor=Sum("valor_contrato"),
            promedio_valor=Avg("valor_contrato")
        )
        return Response({
            "filtro": {"depto": depto or "todos", "anio": anio or "todos", "modalidad": modalidad or "todos"},
            "optimizado": True, **datos
        })

class VistaResumenNaive(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        depto = request.query_params.get("depto")
        anio = request.query_params.get("anio")
        modalidad = request.query_params.get("modalidad")
        contratos = list(Contrato.objects.all())
        if depto:
            contratos = [c for c in contratos if c.departamento == depto]
        if anio:
            contratos = [c for c in contratos if c.fecha_firma and str(c.fecha_firma.year) == str(anio)]
        if modalidad:
            contratos = [c for c in contratos if c.modalidad == modalidad]
        total = len(contratos)
        suma = sum((c.valor_contrato or 0) for c in contratos)
        promedio = suma / total if total else 0
        return Response({
            "filtro": {"depto": depto or "todos", "anio": anio or "todos", "modalidad": modalidad or "todos"},
            "optimizado": False, "total": total, "suma_valor": suma, "promedio_valor": promedio
        })
class VistaListarCargas(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        trabajos = TrabajoCarga.objects.all()[:20]
        return Response([{"id": t.id, "estado": t.estado, "registros_procesados": t.registros_procesados, "total_registros": t.total_registros, "creado_en": t.creado_en} for t in trabajos])


class VistaTopContratistasOptimizado(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        depto = request.query_params.get("depto")
        limite = int(request.query_params.get("limit", 5))
        qs = Contrato.objects.all()
        if depto:
            qs = qs.filter(departamento=depto)
        datos = (qs.values("contratista_nit", "contratista_nombre")
                   .annotate(total_contratos=Count("id"), suma_valor=Sum("valor_contrato"))
                   .order_by("-suma_valor")[:limite])
        return Response({"filtro": depto or "todos", "optimizado": True, "top": list(datos)})

class VistaTopContratistasNaive(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        depto = request.query_params.get("depto")
        limite = int(request.query_params.get("limit", 5))
        contratos = list(Contrato.objects.all())
        if depto:
            contratos = [c for c in contratos if c.departamento == depto]
        acumulado = {}
        for c in contratos:
            k = (c.contratista_nit, c.contratista_nombre)
            if k not in acumulado:
                acumulado[k] = {"contratista_nit": k[0], "contratista_nombre": k[1], "total_contratos": 0, "suma_valor": 0}
            acumulado[k]["total_contratos"] += 1
            acumulado[k]["suma_valor"] += float(c.valor_contrato or 0)
        top = sorted(acumulado.values(), key=lambda x: x["suma_valor"], reverse=True)[:limite]
        return Response({"filtro": depto or "todos", "optimizado": False, "top": top})