from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

class ServicioUsuarios:
    """Service Layer para identidad - evita vistas gordas (SRP + DIP)"""

    def __init__(self, modelo_usuario=User, generador_token=RefreshToken):
        self.modelo_usuario = modelo_usuario
        self.generador_token = generador_token

    def registrar(self, nombre_usuario, correo, contrasena):
        if self.modelo_usuario.objects.filter(email=correo).exists():
            raise ValueError("El correo ya está registrado.")
        return self.modelo_usuario.objects.create_user(
            username=nombre_usuario, email=correo, password=contrasena
        )

    def autenticar(self, correo, contrasena):
        try:
            usuario = self.modelo_usuario.objects.get(email=correo)
        except self.modelo_usuario.DoesNotExist:
            raise ValueError("Credenciales inválidas.")
        usuario_auth = authenticate(username=usuario.username, password=contrasena)
        if not usuario_auth:
            raise ValueError("Credenciales inválidas.")
        return usuario_auth

    def crear_tokens(self, usuario):
        refresh = self.generador_token.for_user(usuario)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "nombre_usuario": usuario.username,
            "correo": usuario.email,
        }

    def invalidar_refresh(self, refresh_token):
        try:
            token = self.generador_token(refresh_token)
            token.blacklist()
        except TokenError as e:
            raise ValueError("Token inválido o ya expirado.") from e

servicio_usuarios = ServicioUsuarios()
