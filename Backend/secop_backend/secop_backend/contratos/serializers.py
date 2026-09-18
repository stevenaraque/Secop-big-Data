from rest_framework import serializers
from .models import Contrato, Entidad, Radar, Oportunidad

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


class RadarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Radar
        fields = ["id", "departamento_objetivo", "palabras_clave", "rango_cuantia_min", "rango_cuantia_max", "filtros_extras", "activo", "creado_en", "actualizado_en"]
        read_only_fields = ["id", "creado_en", "actualizado_en"]

    def validate_palabras_clave(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("palabras_clave no puede estar vacia.")
        return value.strip()

    def validate_filtros_extras(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("filtros_extras debe ser un objeto JSON.")
        # validar claves contra campos de Contrato (85 cols elegibles - para MVP 15 cols + extensible)
        validos = {f.name for f in Contrato._meta.get_fields() if hasattr(f, 'column')}
        # permitir también alias comunes
        for k in value.keys():
            if k not in validos and k not in ["departamento", "ciudad", "modalidad", "estado_contrato", "sector", "orden"]:
                raise serializers.ValidationError(f"Campo '{k}' no existe en Contrato. Validos: {', '.join(sorted(list(validos))[:5])}...")
            if not isinstance(value[k], str) or not value[k].strip():
                raise serializers.ValidationError(f"Valor para '{k}' debe ser texto no vacio.")
        return value

    def validate(self, attrs):
        mn = attrs.get("rango_cuantia_min")
        mx = attrs.get("rango_cuantia_max")
        # para PATCH, tomar instancia existente si falta
        if self.instance:
            mn = mn if mn is not None else self.instance.rango_cuantia_min
            mx = mx if mx is not None else self.instance.rango_cuantia_max
        if mn is not None and mx is not None and mn > mx:
            raise serializers.ValidationError({"rango_cuantia_max": "rango_min no puede ser mayor que rango_max."})
        return attrs


class OportunidadSerializer(serializers.ModelSerializer):
    contrato = ContratoSerializer(read_only=True)
    radar_palabras = serializers.CharField(source="radar.palabras_clave", read_only=True)

    class Meta:
        model = Oportunidad
        fields = ["id", "contrato", "radar", "radar_palabras", "estado", "creado_en"]
        read_only_fields = ["id", "contrato", "radar", "creado_en"]
