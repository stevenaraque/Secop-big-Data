from django.contrib import admin
from .models import Contrato, Entidad, TrabajoCarga, UmbralAlerta, ConfigActualizacion, BackupRegistro, Auditoria

# RF-23: panel admin sin SQL — Qué: admin registra Contrato/Entidad/TrabajoCarga. Por qué: soporte sin SQL + auditar + progreso.


@admin.register(Entidad)
class EntidadAdmin(admin.ModelAdmin):
    list_display = ("nombre_entidad", "nit_entidad", "departamento", "ciudad", "sector")
    list_filter = ("departamento", "sector")
    search_fields = ("nombre_entidad", "nit_entidad", "departamento", "ciudad")
    ordering = ("nombre_entidad",)
    list_per_page = 50


@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = (
        "id_contrato",
        "nombre_entidad",
        "departamento",
        "valor_contrato",
        "modalidad",
        "contratista_nombre",
        "contratista_nit",
        "fecha_firma",
        "entidad",
    )
    list_filter = ("departamento", "modalidad", "estado_contrato", "fecha_firma")
    search_fields = (
        "id_contrato",
        "contratista_nit",
        "contratista_nombre",
        "nombre_entidad",
        "nit_entidad",
        "departamento",
        "descripcion_del_proceso",
    )
    ordering = ("-fecha_firma", "-id")
    list_per_page = 50
    readonly_fields = ("id_contrato",)


@admin.register(TrabajoCarga)
class TrabajoCargaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "estado",
        "origen",
        "registros_procesados",
        "nuevos_registros",
        "total_registros",
        "progreso_pct",
        "offset_actual",
        "mensaje_corto",
        "creado_en",
        "actualizado_en",
    )
    list_filter = ("estado", "origen")
    search_fields = ("estado", "mensaje_error", "origen")
    ordering = ("-creado_en",)
    readonly_fields = ("creado_en", "actualizado_en", "offset_actual")
    list_per_page = 50

    @admin.display(description="Progreso %", ordering="registros_procesados")
    def progreso_pct(self, obj):
        if obj.total_registros and obj.total_registros > 0:
            return f"{(obj.registros_procesados * 100 / obj.total_registros):.1f}% ({obj.registros_procesados}/{obj.total_registros}) +{obj.nuevos_registros} nuevos"
        return f"{obj.registros_procesados}/{obj.total_registros or 0} +{obj.nuevos_registros} nuevos"

    @admin.display(description="Error")
    def mensaje_corto(self, obj):
        if obj.mensaje_error:
            return (obj.mensaje_error[:60] + "...") if len(obj.mensaje_error) > 60 else obj.mensaje_error
        return "-"


@admin.register(UmbralAlerta)
class UmbralAlertaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "valor", "descripcion", "actualizado_en")
    search_fields = ("nombre",)
    ordering = ("nombre",)


@admin.register(ConfigActualizacion)
class ConfigActualizacionAdmin(admin.ModelAdmin):
    list_display = ("id", "intervalo_horas", "activo", "ultima_ejecucion", "ultimo_estado", "actualizado_en")
    list_filter = ("activo",)
    readonly_fields = ("ultima_ejecucion", "ultimo_estado", "creado_en", "actualizado_en")


@admin.register(BackupRegistro)
class BackupRegistroAdmin(admin.ModelAdmin):
    list_display = ("id", "archivo", "registros", "tamaño_bytes", "estado", "creado_en")
    list_filter = ("estado",)
    readonly_fields = ("archivo", "tamaño_bytes", "registros", "creado_en")
    ordering = ("-creado_en",)


@admin.register(Auditoria)
class AuditoriaAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "accion", "detalle", "fecha")
    list_filter = ("accion",)
    search_fields = ("usuario", "accion", "detalle")
    readonly_fields = ("usuario", "accion", "detalle", "fecha")
    ordering = ("-fecha",)


# Personalización cabecera — opcional pero profesional
admin.site.site_header = "SECOP Insight — Admin"
admin.site.site_title = "SECOP Admin"
admin.site.index_title = "Gestión catálogo y monitoreo ETL"