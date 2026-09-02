from django.contrib import admin
from .models import Contrato, Entidad

@admin.register(Entidad)
class EntidadAdmin(admin.ModelAdmin):
    list_display = ("nombre_entidad", "nit_entidad", "departamento", "ciudad")

@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = ("id_contrato", "contratista_nombre", "departamento", "valor_contrato", "entidad")