from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

class RegistroSerializer(serializers.ModelSerializer):
    nombre_usuario = serializers.CharField(source="username")
    correo = serializers.EmailField(source="email", required=True)
    contrasena = serializers.CharField(source="password", write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "nombre_usuario", "correo", "contrasena"]
        read_only_fields = ["id"]

    def validate_correo(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("El correo ya está registrado.")
        return value

    def create(self, validated_data):
        from .services import servicio_usuarios
        return servicio_usuarios.registrar(
            nombre_usuario=validated_data["username"],
            correo=validated_data["email"],
            contrasena=validated_data["password"],
        )


class InicioSesionSerializer(serializers.Serializer):
    correo = serializers.EmailField()
    contrasena = serializers.CharField(write_only=True)
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)

    def validate(self, data):
        from .services import servicio_usuarios
        try:
            usuario = servicio_usuarios.autenticar(
                correo=data.get("correo"), contrasena=data.get("contrasena")
            )
            data["usuario"] = usuario
            return data
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def create(self, validated_data):
        from .services import servicio_usuarios
        return servicio_usuarios.crear_tokens(validated_data["usuario"])
class CierreSesionSerializer(serializers.Serializer):
    refresh = serializers.CharField()



    def validate(self, data):
        try:
            token = RefreshToken(data["refresh"])
            data["token"] = token
        except TokenError:
            raise serializers.ValidationError("Token inválido o ya expirado.")
        return data

    def save(self):
        from .services import servicio_usuarios
        servicio_usuarios.invalidar_refresh(self.validated_data["refresh"])