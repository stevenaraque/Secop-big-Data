from django.contrib import admin
from .models import Contrato, Entidad, TrabajoCarga

@admin.register(Entidad)
class EntidadAdmin(admin.ModelAdmin):
    list_display = ("nombre_entidad", "nit_entidad", "departamento", "ciudad")

@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = ("id_contrato", "contratista_nombre", "departamento", "valor_contrato", "entidad")

@admin.register(TrabajoCarga)
class TrabajoCargaAdmin(admin.ModelAdmin):
    list_display = ("id", "estado", "registros_procesados", "total_registros", "offset_actual", "creado_en")
    list_filter = ("estado",)
    readonly_fields = ("creado_en", "actualizado_en")