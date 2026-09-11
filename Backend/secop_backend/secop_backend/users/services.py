import re
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

def _validar_politica_contrasena(contrasena: str):
    """RF-03/RF-22: 8+ chars, 1 mayúscula, 1 minúscula, 1 número. Qué: evita clave débil. Por qué: criterio RF-03."""
    if len(contrasena) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    if not re.search(r"[A-Z]", contrasena):
        raise ValueError("La contraseña debe tener al menos una mayúscula.")
    if not re.search(r"[a-z]", contrasena):
        raise ValueError("La contraseña debe tener al menos una minúscula.")
    if not re.search(r"[0-9]", contrasena):
        raise ValueError("La contraseña debe tener al menos un número.")


class ServicioUsuarios:
    """Service Layer para identidad - evita vistas gordas (SRP + DIP)"""

    def __init__(self, modelo_usuario=User, generador_token=RefreshToken, modelo_token=None):
        self.modelo_usuario = modelo_usuario
        self.generador_token = generador_token
        # DIP: modelo_token inyectable para tests (mock)
        self.modelo_token = modelo_token

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

    # --- RF-22: recuperación ---
    def _get_modelo_token(self):
        if self.modelo_token is not None:
            return self.modelo_token
        from .models import TokenRecuperacion

        return TokenRecuperacion

    def solicitar_recuperacion(self, correo: str):
        """Crea token 30min si correo existe. No revela si no existe (OWASP). Qué: enlace único. Por qué: 200 siempre."""
        try:
            usuario = self.modelo_usuario.objects.get(email=correo)
        except self.modelo_usuario.DoesNotExist:
            return None  # no revelar — caller responde 200 igual
        ModeloToken = self._get_modelo_token()
        token_str = uuid.uuid4().hex  # 32 chars hex único
        expira = timezone.now() + timedelta(minutes=30)
        token_obj = ModeloToken.objects.create(
            usuario=usuario, token=token_str, expira_en=expira
        )
        # Enviar email console (dev) — en prod sería SMTP real
        enlace = f"http://localhost:5173/restablecer?token={token_str}"
        try:
            send_mail(
                subject="Recupera tu contraseña — SECOP Insight",
                message=f"Hola {usuario.username},\n\nUsa este enlace (expira en 30 min, un solo uso):\n{enlace}\n\nSi no solicitaste, ignora.",
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@secop-insight.local"),
                recipient_list=[correo],
                fail_silently=True,
            )
        except Exception:
            pass  # console backend no falla, pero no bloquear flujo
        return token_obj

    def confirmar_recuperacion(self, token_str: str, nueva_contrasena: str):
        """Valida token no usado/no expirado + política + set_password. Qué: un solo uso 30min. Por qué: RF-22."""
        _validar_politica_contrasena(nueva_contrasena)
        ModeloToken = self._get_modelo_token()
        try:
            token_obj = ModeloToken.objects.select_related("usuario").get(token=token_str)
        except ModeloToken.DoesNotExist:
            raise ValueError("Enlace inválido o expirado.")
        if token_obj.usado:
            raise ValueError("Enlace ya utilizado.")
        if token_obj.esta_expirado():
            raise ValueError("Enlace expirado.")
        usuario = token_obj.usuario
        usuario.set_password(nueva_contrasena)
        usuario.save(update_fields=["password"])
        token_obj.usado = True
        token_obj.save(update_fields=["usado"])
        return usuario


servicio_usuarios = ServicioUsuarios()
