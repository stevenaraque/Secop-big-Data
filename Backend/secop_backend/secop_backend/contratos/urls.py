from django.urls import path
from .views import VistaIniciarCarga, VistaEstadoCarga, VistaResumenOptimizado, VistaResumenNaive, VistaListarCargas, VistaTopContratistasOptimizado, VistaTopContratistasNaive, VistaListaContratos, VistaDetalleContrato, VistaSerieMensualOptimizado, VistaMapaDirectaOptimizado, VistaBuscar, VistaBanderasConcentracion

urlpatterns = [
    path("cargar/", VistaIniciarCarga.as_view(), name="iniciar_carga"),
    path("cargar/listar/", VistaListarCargas.as_view(), name="listar_cargas"),
    path("cargar/<int:pk>/", VistaEstadoCarga.as_view(), name="estado_carga"),
    path("optimized/resumen/", VistaResumenOptimizado.as_view(), name="resumen_optimizado"),
    path("naive/resumen/", VistaResumenNaive.as_view(), name="resumen_naive"),
    path("optimized/top-contratistas/", VistaTopContratistasOptimizado.as_view(), name="top_optimizado"),
    path("naive/top-contratistas/", VistaTopContratistasNaive.as_view(), name="top_naive"),
    path("contratos/", VistaListaContratos.as_view(), name="lista_contratos"),
    path("contratos/<str:id_contrato>/", VistaDetalleContrato.as_view(), name="detalle_contrato"),
    path("optimized/serie-mensual/", VistaSerieMensualOptimizado.as_view(), name="serie_mensual"),
    path("optimized/mapa-directa/", VistaMapaDirectaOptimizado.as_view(), name="mapa_directa"),
    path("buscar/", VistaBuscar.as_view(), name="buscar"),
    path("banderas-concentracion/", VistaBanderasConcentracion.as_view(), name="banderas_concentracion"),

]