from rest_framework import serializers
from .models import Contrato, Entidad, Radar, Oportunidad

class ContratoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contrato
        fields = [
            "id", "id_contrato", "nombre_entidad", "nit_entidad",
            "departamento", "ciudad", "orden", "sector", "modalidad",
            "estado_contrato", "codigo_categoria_principal",
            "descripcion_del_proceso",
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

    # P1: alias SODA → campo real (el matchmaking usa getattr con el nombre
    # devuelto aquí, así el alias ya filtra de verdad, no solo valida).
    ALIAS_FILTROS = {
        "valor_del_contrato": "valor_contrato",
        "fecha_de_firma": "fecha_firma",
        "modalidad_de_contratacion": "modalidad",
        "documento_proveedor": "contratista_nit",
        "proveedor_adjudicado": "contratista_nombre",
    }

    def validate_filtros_extras(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("filtros_extras debe ser un objeto JSON.")
        # validar claves contra campos de Contrato (15 físicas + alias SODA)
        validos = {f.name for f in Contrato._meta.get_fields() if hasattr(f, 'column')}
        normalizados = {}
        for k, v in value.items():
            campo = self.ALIAS_FILTROS.get(k, k)
            if campo not in validos:
                raise serializers.ValidationError(f"Campo '{k}' no existe en Contrato. Validos: {', '.join(sorted(list(validos))[:5])}...")
            if isinstance(v, str):
                if not v.strip():
                    raise serializers.ValidationError(f"Valor para '{k}' debe ser texto no vacio.")
                normalizados[campo] = v.strip()
            elif isinstance(v, (int, float)) and not isinstance(v, bool):
                normalizados[campo] = v
            else:
                raise serializers.ValidationError(f"Valor para '{k}' debe ser texto o número no vacio.")
        return normalizados

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
