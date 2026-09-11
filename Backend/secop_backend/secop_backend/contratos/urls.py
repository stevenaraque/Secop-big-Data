from django.urls import path
from .views import VistaIniciarCarga, VistaEstadoCarga, VistaResumenOptimizado, VistaResumenNaive, VistaListarCargas, VistaTopContratistasOptimizado, VistaTopContratistasNaive, VistaListaContratos, VistaDetalleContrato, VistaSerieMensualOptimizado, VistaMapaDirectaOptimizado, VistaBuscar, VistaBanderasConcentracion, VistaPredominioDirecta, VistaListarUmbrales, VistaActualizarUmbral, VistaListaEntidades, VistaEstadisticasEntidad, VistaGrafoRed, VistaExportarContratos, VistaActualizarPeriodica, VistaUltimaActualizacion, VistaConfigActualizacion, VistaCrearBackup, VistaListarBackups, VistaDescargarBackup

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
    path("predominio-directa/", VistaPredominioDirecta.as_view(), name="predominio_directa"),
    path("umbrales/", VistaListarUmbrales.as_view(), name="listar_umbrales"),
    path("umbrales/<str:nombre>/", VistaActualizarUmbral.as_view(), name="actualizar_umbral"),
    path("entidades/", VistaListaEntidades.as_view(), name="lista_entidades"),
    path("por-entidad/", VistaEstadisticasEntidad.as_view(), name="por_entidad"),
    path("grafo/", VistaGrafoRed.as_view(), name="grafo"),
    path("exportar/", VistaExportarContratos.as_view(), name="exportar"),
    path("cargar/actualizar-periodica/", VistaActualizarPeriodica.as_view(), name="actualizar_periodica"),
    path("cargar/ultima-actualizacion/", VistaUltimaActualizacion.as_view(), name="ultima_actualizacion"),
    path("cargar/config-actualizacion/", VistaConfigActualizacion.as_view(), name="config_actualizacion"),
    path("cargar/backup/", VistaCrearBackup.as_view(), name="crear_backup"),
    path("cargar/backup/listar/", VistaListarBackups.as_view(), name="listar_backups"),
    path("cargar/backup/<int:pk>/descargar/", VistaDescargarBackup.as_view(), name="descargar_backup"),

]