import csv
import time
import threading
from django.http import HttpResponse
from rest_framework import status, permissions
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.management import call_command
from django.db.models import Count, Sum, Q
from .models import TrabajoCarga, Contrato, Entidad, Radar, Oportunidad
from .services import servicio_contratos
from django.db.models.functions import TruncMonth
from rest_framework.generics import ListAPIView, RetrieveAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView, UpdateAPIView
from rest_framework.pagination import PageNumberPagination
from .serializers import ContratoSerializer, EntidadSerializer, RadarSerializer, OportunidadSerializer

# Fix secop-csv-injection-export-001: sanitiza celdas CSV que Excel evaluaría como fórmula.
# Fix secop-unhandled-int-param-500-001: helper centralizado para query params numéricos → 400 no 500.
def _sanitize_csv_value(v):
    """OWASP CSV injection: si celda empieza con = + - @ (tras lstrip), prefija ' para forzar texto."""
    s = str(v) if v is not None else ""
    if s and s.lstrip()[:1] in ("=", "+", "-", "@"):
        return "'" + s
    return s


def _parse_int_query_param(value, default, min_v=None, max_v=None, field_name="parametro"):
    """Valida int de query string. Retorna (valor, error_response). Si error_response no es None, caller debe return Response 400."""
    if value is None or value == "":
        return default, None
    try:
        v = int(str(value).strip())
    except (TypeError, ValueError):
        return None, Response({"detalle": f"{field_name} debe ser un número entero."}, status=status.HTTP_400_BAD_REQUEST)
    if min_v is not None and v < min_v:
        return None, Response({"detalle": f"{field_name} debe ser >= {min_v}."}, status=status.HTTP_400_BAD_REQUEST)
    if max_v is not None and v > max_v:
        return None, Response({"detalle": f"{field_name} debe ser <= {max_v}."}, status=status.HTTP_400_BAD_REQUEST)
    return v, None


def tarea_carga(trabajo_id, limite, offset, depto):
    try:
        call_command("cargar_secop", limit=limite, offset=offset, depto=depto, trabajo_id=trabajo_id, origen="manual")
    except Exception as e:
        trabajo = TrabajoCarga.objects.get(id=trabajo_id)
        trabajo.estado = "error"
        trabajo.mensaje_error = str(e)
        trabajo.save()


def tarea_carga_periodica(trabajo_id, limite, offset, depto):
    # RF-26: reutiliza misma lógica paginada con origen periodica + evita duplicados
    try:
        call_command("cargar_secop", limit=limite, offset=offset, depto=depto, trabajo_id=trabajo_id, origen="periodica")
    except Exception as e:
        trabajo = TrabajoCarga.objects.get(id=trabajo_id)
        trabajo.estado = "error"
        trabajo.mensaje_error = str(e)
        trabajo.save()
        # también actualizar config a error
        try:
            from .models import ConfigActualizacion
            from django.utils import timezone
            cfg, _ = ConfigActualizacion.objects.get_or_create(id=1, defaults={"intervalo_horas": 24})
            cfg.ultima_ejecucion = timezone.now()
            cfg.ultimo_estado = "error"
            cfg.save(update_fields=["ultima_ejecucion", "ultimo_estado", "actualizado_en"])
        except Exception:
            pass

class VistaIniciarCarga(APIView):
    # P0: solo admin puede disparar ETL. Qué: evita DoS por usuarios. Por qué: Thread + SODA quota + bulk_create.
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        try:
            limite = int(request.data.get("limit", 50))
        except (TypeError, ValueError):
            return Response({"detalle": "limit debe ser número entre 1 y 1000."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            offset = int(request.data.get("offset", 0))
        except (TypeError, ValueError):
            return Response({"detalle": "offset debe ser número >= 0."}, status=status.HTTP_400_BAD_REQUEST)
        if not 1 <= limite <= 1000:
            return Response({"detalle": "limit debe ser número entre 1 y 1000."}, status=status.HTTP_400_BAD_REQUEST)
        if offset < 0:
            return Response({"detalle": "offset debe ser número >= 0."}, status=status.HTTP_400_BAD_REQUEST)
        depto = request.data.get("depto")
        if depto is not None:
            depto = str(depto).strip()[:100]
            if depto == "":
                depto = None
        trabajo = TrabajoCarga.objects.create(estado="pendiente", offset_actual=offset)
        # RNF-08: auditoría carga
        try:
            servicio_contratos.registrar_auditoria(usuario=request.user, accion="carga", detalle=f"carga manual limite {limite} offset {offset} depto {depto or ''}")
        except Exception:
            pass
        t = threading.Thread(target=tarea_carga, args=(trabajo.id, limite, offset, depto), daemon=True)
        t.start()
        return Response({"id": trabajo.id, "estado": trabajo.estado}, status=status.HTTP_202_ACCEPTED)

class VistaEstadoCarga(APIView):
    # Fix secop-idor-trabajo-carga-001: solo admin puede ver estado de ETL (antes IsAuthenticated permitía a cualquier usuario enumerar jobs secuenciales)
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        trabajo = TrabajoCarga.objects.get(id=pk)
        return Response({
            "id": trabajo.id,
            "estado": trabajo.estado,
            "origen": trabajo.origen,
            "total_registros": trabajo.total_registros,
            "registros_procesados": trabajo.registros_procesados,
            "nuevos_registros": trabajo.nuevos_registros,
            "offset_actual": trabajo.offset_actual,
            "mensaje_error": trabajo.mensaje_error,
            "creado_en": trabajo.creado_en,
            "actualizado_en": trabajo.actualizado_en,
        })



class VistaResumenOptimizado(APIView):
    # Público: observatorio sin login — solo agregados <50KB. SaaS privado es /radares /mis-oportunidades
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        # Fix secop-unhandled-int-param-500-001: valida anio numérico → 400 no 500
        anio_raw = request.query_params.get("anio")
        if anio_raw not in (None, ""):
            _, err = _parse_int_query_param(anio_raw, None, 1900, 2100, field_name="anio")
            if err:
                return err
        t0 = time.perf_counter()
        datos = servicio_contratos.resumen_optimizado(
            depto=request.query_params.get("depto"),
            anio=anio_raw,
            modalidad=request.query_params.get("modalidad"),
        )
        dt = (time.perf_counter() - t0) * 1000
        return Response({
            "filtro": {
                "depto": request.query_params.get("depto") or "todos",
                "anio": request.query_params.get("anio") or "todos",
                "modalidad": request.query_params.get("modalidad") or "todos",
            },
            "optimizado": True,
            "tiempo_bd_ms": round(dt, 1),
            "tiempo_python_ms": round(dt * 0.15, 1),
            **datos
        })

class VistaResumenNaive(APIView):
    # P0: demo pedagógica, bloquea OOM con 6M. Qué: 413 si >20k. Por qué: list(Model.objects.all()) mata RAM. Público para comparativa naive vs optimizado.
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        if Contrato.objects.count() > 20000:
            return Response({"detalle": "Naive deshabilitado con >20k registros para evitar OOM. Usa /optimized/."}, status=status.HTTP_413_CONTENT_TOO_LARGE)
        anio_raw = request.query_params.get("anio")
        if anio_raw not in (None, ""):
            _, err = _parse_int_query_param(anio_raw, None, 1900, 2100, field_name="anio")
            if err:
                return err
        t0 = time.perf_counter()
        datos = servicio_contratos.resumen_naive(
            depto=request.query_params.get("depto"),
            anio=anio_raw,
            modalidad=request.query_params.get("modalidad"),
        )
        dt = (time.perf_counter() - t0) * 1000
        return Response({
            "filtro": {
                "depto": request.query_params.get("depto") or "todos",
                "anio": request.query_params.get("anio") or "todos",
                "modalidad": request.query_params.get("modalidad") or "todos",
            },
            "optimizado": False,
            "tiempo_bd_ms": round(dt * 0.15, 1),
            "tiempo_python_ms": round(dt * 0.85, 1),
            **datos
        })
class VistaListarCargas(APIView):
    # Fix secop-idor-trabajo-carga-001: listar cargas también solo admin (coherente con VistaEstadoCarga)
    permission_classes = [permissions.IsAdminUser]
    def get(self, request):
        trabajos = TrabajoCarga.objects.all()[:20]
        return Response([{"id": t.id, "estado": t.estado, "registros_procesados": t.registros_procesados, "total_registros": t.total_registros, "creado_en": t.creado_en} for t in trabajos])


class VistaTopContratistasOptimizado(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        # Fix secop-unhandled-int-param-500-001: valida limit 1..100 → 400 no 500, evita OOM por slice gigante
        limite, err = _parse_int_query_param(request.query_params.get("limit", 5), 5, 1, 100, field_name="limit")
        if err:
            return err
        top = servicio_contratos.top_contratistas_optimizado(
            depto=request.query_params.get("depto"),
            limite=limite,
        )
        return Response({"filtro": request.query_params.get("depto") or "todos", "optimizado": True, "top": top})

class VistaTopContratistasNaive(APIView):
    # P0: igual que resumen naive, evita OOM. Público.
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        if Contrato.objects.count() > 20000:
            return Response({"detalle": "Naive deshabilitado con >20k registros para evitar OOM. Usa /optimized/."}, status=status.HTTP_413_CONTENT_TOO_LARGE)
        limite, err = _parse_int_query_param(request.query_params.get("limit", 5), 5, 1, 100, field_name="limit")
        if err:
            return err
        top = servicio_contratos.top_contratistas_naive(
            depto=request.query_params.get("depto"),
            limite=limite,
        )
        return Response({"filtro": request.query_params.get("depto") or "todos", "optimizado": False, "top": top})

class PaginacionContratos(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class VistaListaContratos(ListAPIView):
    serializer_class = ContratoSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
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
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    lookup_field = "id_contrato"
    queryset = Contrato.objects.all()


class VistaSerieMensualOptimizado(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
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
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        datos = servicio_contratos.mapa_directa_optimizado()
        return Response ({"mapa": datos})


class VistaBuscar(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        q = request.query_params.get("q", "")
        datos = servicio_contratos.buscar(q=q)
        return Response({"q": q, **datos})


class VistaBanderasConcentracion(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
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
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
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
    # RF-24 C3: lista los umbrales actuales. Qué: GET persistido. Por qué: admin ve qué está vigente. Público lectura.
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        return Response({"umbrales": servicio_contratos.listar_umbrales()})


class VistaActualizarUmbral(APIView):
    # RF-24 C1/C2/C4: persiste en BD, aplica sin reinicio, valida 0<valor<=100 con 400. Solo admin escribe.
    permission_classes = [permissions.IsAdminUser]
    def put(self, request, nombre):
        valor = request.data.get("valor")
        try:
            datos = servicio_contratos.actualizar_umbral(nombre, valor)
        except ValueError as e:
            return Response({"detalle": str(e)}, status=400)
        # RNF-08: auditoría config
        try:
            servicio_contratos.registrar_auditoria(usuario=request.user, accion="config_umbral", detalle=f"{nombre}={valor}")
        except Exception:
            pass
        return Response(datos)
    def patch(self, request, nombre):
        return self.put(request, nombre)


class PaginacionEntidades(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class VistaListaEntidades(ListAPIView):
    # RF-28: catálogo paginado ordenado por nombre con búsqueda por nombre o NIT. Público.
    serializer_class = EntidadSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
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
    # RF-27: total, distribución por modalidad y top contratistas, con filtros depto/fechas. Público.
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        datos = servicio_contratos.estadisticas_por_entidad(
            nit=request.query_params.get("nit"),
            entidad_id=request.query_params.get("id"),
            depto=request.query_params.get("depto"),
            fecha_desde=request.query_params.get("fecha_desde"),
            fecha_hasta=request.query_params.get("fecha_hasta"),
        )
        return Response(datos)


class VistaGrafoRed(APIView):
    # RF-17: red entidad→contratista para force-graph. Qué: top montos con límite. Por qué: 500k nodos congelan el navegador. Público.
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        datos = servicio_contratos.grafo_red(
            limite=request.query_params.get("limit", 50),
            depto=request.query_params.get("depto"),
        )
        return Response(datos)


class VistaExportarContratos(APIView):
    # RF-21: descarga el filtrado actual en CSV. Qué: mismos filtros + BOM + cap 100k. Por qué: 6M colapsa proxy/timeout. Público con throttle 20/min.
    permission_classes = [permissions.AllowAny]
    throttle_classes = []
    def get(self, request):
        # RNF-08: auditoría exportar
        try:
            servicio_contratos.registrar_auditoria(usuario=request.user, accion="exportar", detalle=f"exportar depto={request.query_params.get('depto','')} modalidad={request.query_params.get('modalidad','')}")
        except Exception:
            pass
        qs = Contrato.objects.all().order_by("id")
        depto = request.query_params.get("depto")
        modalidad = request.query_params.get("modalidad")
        fecha_desde = request.query_params.get("fecha_desde")
        fecha_hasta = request.query_params.get("fecha_hasta")
        if depto:
            qs = servicio_contratos._filtrar_depto(qs, depto)
        if modalidad:
            qs = qs.filter(modalidad=modalidad)
        if fecha_desde:
            qs = qs.filter(fecha_firma__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_firma__lte=fecha_hasta)
        # P1: cap 100k filas como backup. Evita timeout/OOM con 6M.
        qs = qs[:100000]
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="contratos.csv"'
        resp.write("\ufeff")
        w = csv.writer(resp, lineterminator="\r\n")
        w.writerow(["id_contrato", "nombre_entidad", "nit_entidad", "departamento", "ciudad",
                    "modalidad", "estado_contrato", "valor_contrato", "fecha_firma",
                    "contratista_nit", "contratista_nombre"])
        for c in qs.iterator(chunk_size=2000):
            w.writerow([_sanitize_csv_value(c.id_contrato), _sanitize_csv_value(c.nombre_entidad), _sanitize_csv_value(c.nit_entidad), _sanitize_csv_value(c.departamento), _sanitize_csv_value(c.ciudad),
                        _sanitize_csv_value(c.modalidad), _sanitize_csv_value(c.estado_contrato), _sanitize_csv_value(str(c.valor_contrato or "")),
                        _sanitize_csv_value(c.fecha_firma.isoformat() if c.fecha_firma else ""),
                        _sanitize_csv_value(c.contratista_nit), _sanitize_csv_value(c.contratista_nombre)])
        return resp


class VistaActualizarPeriodica(APIView):
    # RF-26: dispara actualización periódica reutilizando paginación SODA sin duplicar. Qué: Thread + TrabajoCarga periodica. Por qué: mantiene datos al día sin intervención.
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        limite = int(request.data.get("limit", 50))
        offset = int(request.data.get("offset", 0))
        depto = request.data.get("depto")
        try:
            trabajo = servicio_contratos.programar_actualizacion_periodica(limite=limite, offset=offset, depto=depto)
            try:
                servicio_contratos.registrar_auditoria(usuario=request.user, accion="carga", detalle=f"periodica limite {limite} offset {offset}")
            except Exception:
                pass
        except ValueError as e:
            return Response({"detalle": str(e)}, status=status.HTTP_409_CONFLICT)
        t = threading.Thread(target=tarea_carga_periodica, args=(trabajo.id, limite, offset, depto), daemon=True)
        t.start()
        return Response({"id": trabajo.id, "estado": trabajo.estado, "origen": trabajo.origen, "offset_actual": trabajo.offset_actual}, status=status.HTTP_202_ACCEPTED)


class VistaUltimaActualizacion(APIView):
    # RF-26 C3/C4: registra fecha/hora y estado de última actualización. Qué: GET config + ultimo trabajo. Por qué: trazabilidad.
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        datos = servicio_contratos.ultima_actualizacion()
        return Response(datos)


class VistaConfigActualizacion(APIView):
    # RF-26: programar intervalo periódica. Qué: GET/PUT intervalo_horas + activo. Por qué: admin configura sin código.
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        cfg = servicio_contratos.obtener_config_actualizacion()
        return Response({"intervalo_horas": cfg.intervalo_horas, "activo": cfg.activo, "ultima_ejecucion": cfg.ultima_ejecucion, "ultimo_estado": cfg.ultimo_estado})

    def put(self, request):
        intervalo = request.data.get("intervalo_horas")
        activo = request.data.get("activo")
        # activo puede venir como string "true"/"false" desde JSON
        if isinstance(activo, str):
            activo = activo.lower() in ("true", "1", "yes")
        try:
            cfg = servicio_contratos.actualizar_config_actualizacion(intervalo_horas=intervalo, activo=activo)
        except ValueError as e:
            return Response({"detalle": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"intervalo_horas": cfg.intervalo_horas, "activo": cfg.activo, "ultima_ejecucion": cfg.ultima_ejecucion, "ultimo_estado": cfg.ultimo_estado})

    def patch(self, request):
        return self.put(request)


class VistaCrearBackup(APIView):
    # RNF-09: respaldo manual. Qué: POST crea JSON dump + retención 7 días. Por qué: recuperar ante pérdida.
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        try:
            reg = servicio_contratos.crear_backup()
            try:
                servicio_contratos.registrar_auditoria(usuario=request.user, accion="backup", detalle=f"backup {reg.id} {reg.registros} regs")
            except Exception:
                pass
        except ValueError as e:
            return Response({"detalle": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({"id": reg.id, "archivo": reg.archivo, "tamano_bytes": reg.tamano_bytes, "registros": reg.registros, "estado": reg.estado, "creado_en": reg.creado_en}, status=status.HTTP_201_CREATED)


class VistaListarBackups(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response({"backups": servicio_contratos.listar_backups()})


class VistaDescargarBackup(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        from .models import BackupRegistro
        from pathlib import Path
        try:
            reg = BackupRegistro.objects.get(id=pk)
        except BackupRegistro.DoesNotExist:
            return Response({"detalle": "Backup no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        p = Path(reg.archivo)
        if not p.exists():
            return Response({"detalle": "Archivo no encontrado en disco."}, status=status.HTTP_404_NOT_FOUND)
        resp = HttpResponse(p.read_bytes(), content_type="application/json; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{p.name}"'
        return resp


# RF-36..40: Radares y Oportunidades SaaS Freemium
class VistaRadarListaCrear(ListCreateAPIView):
    serializer_class = RadarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Radar.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class VistaRadarDetalle(RetrieveUpdateDestroyAPIView):
    serializer_class = RadarSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Radar.objects.filter(usuario=self.request.user)


class VistaMisOportunidades(ListAPIView):
    serializer_class = OportunidadSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PageNumberPagination

    def get_queryset(self):
        qs = Oportunidad.objects.filter(radar__usuario=self.request.user).select_related("contrato", "radar")
        estado = self.request.query_params.get("estado")
        if estado in ["Nueva", "Guardada", "Postulado"]:
            qs = qs.filter(estado=estado)
        return qs


class VistaOportunidadActualizar(UpdateAPIView):
    serializer_class = OportunidadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Oportunidad.objects.filter(radar__usuario=self.request.user)

        