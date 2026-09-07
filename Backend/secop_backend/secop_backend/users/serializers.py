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
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"]
        )


class InicioSesionSerializer(serializers.Serializer):
    correo = serializers.EmailField()
    contrasena = serializers.CharField(write_only=True)
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)

    def validate(self, data):
        correo = data.get("correo")
        contrasena = data.get("contrasena")
        try:
            usuario = User.objects.get(email=correo)
        except User.DoesNotExist:
            raise serializers.ValidationError("Credenciales inválidas.")
        usuario_autenticado = authenticate(username=usuario.username, password=contrasena)
        if not usuario_autenticado:
            raise serializers.ValidationError("Credenciales inválidas.")
        data["usuario"] = usuario_autenticado
        return data

    def create(self, validated_data):
        usuario = validated_data["usuario"]
        refresh = RefreshToken.for_user(usuario)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "nombre_usuario": usuario.username,
            "correo": usuario.email,
        }
class CierreSesionSerializer(serializers.Serializer):
    refresh = serializers.CharField()



    def validate(self, data):
        try:
            token = RefreshToken(data["refresh"])
            data["token"] = token 
        except TokenError:
            raise serializers.ValidationError("Token invalido o ya expirado.")
        return data



    def save (self):
        self.validated_data["token"].blacklist()