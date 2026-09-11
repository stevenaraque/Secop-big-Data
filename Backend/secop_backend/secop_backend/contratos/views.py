import threading
from rest_framework import status, permissions
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.management import call_command
from django.db.models import Count, Sum, Q
from .models import TrabajoCarga, Contrato, Entidad
from .services import servicio_contratos
from django.db.models.functions import TruncMonth
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from .serializers import ContratoSerializer, EntidadSerializer




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
        datos = servicio_contratos.resumen_optimizado(
            depto=request.query_params.get("depto"),
            anio=request.query_params.get("anio"),
            modalidad=request.query_params.get("modalidad"),
        )
        return Response({
            "filtro": {
                "depto": request.query_params.get("depto") or "todos",
                "anio": request.query_params.get("anio") or "todos",
                "modalidad": request.query_params.get("modalidad") or "todos",
            },
            "optimizado": True, **datos
        })

class VistaResumenNaive(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        datos = servicio_contratos.resumen_naive(
            depto=request.query_params.get("depto"),
            anio=request.query_params.get("anio"),
            modalidad=request.query_params.get("modalidad"),
        )
        return Response({
            "filtro": {
                "depto": request.query_params.get("depto") or "todos",
                "anio": request.query_params.get("anio") or "todos",
                "modalidad": request.query_params.get("modalidad") or "todos",
            },
            "optimizado": False, **datos
        })
class VistaListarCargas(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        trabajos = TrabajoCarga.objects.all()[:20]
        return Response([{"id": t.id, "estado": t.estado, "registros_procesados": t.registros_procesados, "total_registros": t.total_registros, "creado_en": t.creado_en} for t in trabajos])


class VistaTopContratistasOptimizado(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        top = servicio_contratos.top_contratistas_optimizado(
            depto=request.query_params.get("depto"),
            limite=int(request.query_params.get("limit", 5)),
        )
        return Response({"filtro": request.query_params.get("depto") or "todos", "optimizado": True, "top": top})

class VistaTopContratistasNaive(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        top = servicio_contratos.top_contratistas_naive(
            depto=request.query_params.get("depto"),
            limite=int(request.query_params.get("limit", 5)),
        )
        return Response({"filtro": request.query_params.get("depto") or "todos", "optimizado": False, "top": top})

class PaginacionContratos(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class VistaListaContratos(ListAPIView):
    serializer_class = ContratoSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PaginacionContratos
    def get_queryset(self):
        qs = Contrato.objects.all().order_by("id")
        depto = self.request.query_params.get("depto")
        modalidad = self.request.query_params.get("modalidad")
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")
        if depto:
            # RF-16: tolera tildes (Boyacá cuenta Boyaca+Boyacá) y se combina con los demás filtros
            qs = servicio_contratos._filtrar_depto(qs, depto)
        if modalidad:
            qs = qs.filter(modalidad=modalidad)
        if fecha_desde:
            qs = qs.filter(fecha_firma__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_firma__lte=fecha_hasta)
        return qs

class VistaDetalleContrato(RetrieveAPIView):
    serializer_class = ContratoSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id_contrato"
    queryset = Contrato.objects.all()


class VistaSerieMensualOptimizado(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        depto = request.query_params.get("depto")
        qs = Contrato.objects.all()
        if depto:
            qs = qs.filter(departamento=depto)
        datos = (qs.annotate(mes=TruncMonth("fecha_firma"))
                   .values("mes")
                   .annotate(total=Count("id"), suma=Sum("valor_contrato"))
                   .order_by("mes"))
        return Response({"filtro": depto or "todos", "serie": list(datos)})


class VistaMapaDirectaOptimizado(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        datos = servicio_contratos.mapa_directa_optimizado()
        return Response ({"mapa": datos})


class VistaBuscar(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        q = request.query_params.get("q", "")
        datos = servicio_contratos.buscar(q=q)
        return Response({"q": q, **datos})


class VistaBanderasConcentracion(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # RF-24: si no mandan ?umbral=, usa el persistido en BD (sin reinicio)
        raw = request.query_params.get("umbral")
        if raw is None or raw == "":
            umbral = servicio_contratos.obtener_umbral("concentracion", 30)
        else:
            try:
                umbral = float(raw)
            except (TypeError, ValueError):
                return Response({"detalle": "Umbral inválido, use un número entre 0 y 100."}, status=400)
            if not 0 < umbral <= 100:
                return Response({"detalle": "Umbral inválido, use un número entre 0 y 100."}, status=400)
        depto = request.query_params.get("depto")
        datos = servicio_contratos.banderas_concentracion(umbral=umbral, depto=depto)
        return Response(datos)


class VistaPredominioDirecta(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # RF-24: si no mandan ?umbral=, usa el persistido en BD (sin reinicio)
        raw = request.query_params.get("umbral")
        if raw is None or raw == "":
            umbral = servicio_contratos.obtener_umbral("predominio_directa", 80)
        else:
            try:
                umbral = float(raw)
            except (TypeError, ValueError):
                return Response({"detalle": "Umbral inválido, use un número entre 0 y 100."}, status=400)
            if not 0 < umbral <= 100:
                return Response({"detalle": "Umbral inválido, use un número entre 0 y 100."}, status=400)
        depto = request.query_params.get("depto")
        datos = servicio_contratos.predominio_directa(umbral=umbral, depto=depto)
        return Response(datos)


class VistaListarUmbrales(APIView):
    # RF-24 C3: lista los umbrales actuales. Qué: GET persistido. Por qué: admin ve qué está vigente.
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return Response({"umbrales": servicio_contratos.listar_umbrales()})


class VistaActualizarUmbral(APIView):
    # RF-24 C1/C2/C4: persiste en BD, aplica sin reinicio, valida 0<valor<=100 con 400.
    permission_classes = [permissions.IsAuthenticated]
    def put(self, request, nombre):
        valor = request.data.get("valor")
        try:
            datos = servicio_contratos.actualizar_umbral(nombre, valor)
        except ValueError as e:
            return Response({"detalle": str(e)}, status=400)
        return Response(datos)
    def patch(self, request, nombre):
        return self.put(request, nombre)


class PaginacionEntidades(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class VistaListaEntidades(ListAPIView):
    # RF-28: catálogo paginado ordenado por nombre con búsqueda por nombre o NIT.
    serializer_class = EntidadSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PaginacionEntidades
    def get_queryset(self):
        qs = Entidad.objects.all().order_by("nombre_entidad")
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(nombre_entidad__icontains=q) | Q(nit_entidad__icontains=q))
        return qs
    def list(self, request, *args, **kwargs):
        # Criterio 5: página fuera de rango responde 400 (DRF da 404 por defecto).
        try:
            return super().list(request, *args, **kwargs)
        except NotFound:
            return Response({"detalle": "Página fuera de rango."}, status=400)


class VistaEstadisticasEntidad(APIView):
    # RF-27: total, distribución por modalidad y top contratistas, con filtros depto/fechas.
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        datos = servicio_contratos.estadisticas_por_entidad(
            nit=request.query_params.get("nit"),
            entidad_id=request.query_params.get("id"),
            depto=request.query_params.get("depto"),
            fecha_desde=request.query_params.get("fecha_desde"),
            fecha_hasta=request.query_params.get("fecha_hasta"),
        )
        return Response(datos)
        
        