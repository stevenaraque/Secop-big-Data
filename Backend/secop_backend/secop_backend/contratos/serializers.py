from rest_framework import serializers
from .models import Contrato, Entidad

class ContratoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contrato
        fields = [
            "id", "id_contrato", "nombre_entidad", "nit_entidad",
            "departamento", "ciudad", "modalidad", "estado_contrato",
            "valor_contrato", "fecha_firma", "contratista_nit", "contratista_nombre"
        ]

class EntidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Entidad
        fields = ["id", "nombre_entidad", "nit_entidad", "departamento", "ciudad", "sector"]
