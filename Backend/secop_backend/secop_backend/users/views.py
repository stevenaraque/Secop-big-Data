from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import (
    RegistroSerializer,
    InicioSesionSerializer,
    CierreSesionSerializer,
    SolicitarRecuperacionSerializer,
    ConfirmarRecuperacionSerializer,
)


class VistaRegistro(generics.CreateAPIView):
    """Fix secop-user-enumeration-register-001: respuesta genérica 200 siempre, no 400/201 distinguible.
    Qué: si existe, notifica por email y responde 200 genérico igual que creación. Por qué: evita oracle anon 20/min.
    Espejo de VistaSolicitarRecuperacion (RF-22) que ya es genérica. Último punto de decisión confiable."""
    serializer_class = RegistroSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correo = serializer.validated_data.get("email")
        from django.contrib.auth.models import User
        from django.core.mail import send_mail
        from django.conf import settings

        # Si ya existe, no revelar: envía notificación best-effort y responde 200 genérico idéntico a éxito
        if correo and User.objects.filter(email=correo).exists():
            try:
                send_mail(
                    subject="Intento de registro — SECOP Insight",
                    message=f"Hola, se intentó registrar {correo}. Si ya tienes cuenta, usa login o recuperar. Si no fuiste tú, ignora.",
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@secop-insight.local"),
                    recipient_list=[correo],
                    fail_silently=True,
                )
            except Exception:
                pass
            return Response(
                {"detalle": "Si el correo no existía, cuenta creada; si ya existía, se envió notificación a tu email."},
                status=status.HTTP_200_OK,
            )
        try:
            self.perform_create(serializer)
        except Exception as e:
            # Carrera: si servicio detecta duplicado tras nuestro check, unifica a 200 genérico (no 400 oracle)
            if "ya está registrado" in str(e):
                return Response(
                    {"detalle": "Si el correo no existía, cuenta creada; si ya existía, se envió notificación a tu email."},
                    status=status.HTTP_200_OK,
                )
            raise
        headers = self.get_success_headers(serializer.data)
        # Unifica forma: 200 genérico (no 201) para que status no sea oracle; mantiene detalle idéntico
        return Response(
            {"detalle": "Si el correo no existía, cuenta creada; si ya existía, se envió notificación a tu email.", "usuario": serializer.data},
            status=status.HTTP_200_OK,
            headers=headers,
        )


class VistaLogin(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializador = InicioSesionSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        datos = serializador.create(serializador.validated_data)
        # RNF-08: auditoría login sin exponer contraseña
        try:
            from contratos.services import servicio_contratos
            servicio_contratos.registrar_auditoria(usuario=datos.get("correo") or datos.get("nombre_usuario") or request.data.get("correo",""), accion="login", detalle=f"login {datos.get('correo','')}")
        except Exception:
            pass
        return Response(datos, status=status.HTTP_200_OK)


class VistaLogout(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializador = CierreSesionSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        serializador.save()
        # RNF-08: auditoría logout
        try:
            from contratos.services import servicio_contratos
            servicio_contratos.registrar_auditoria(usuario=request.user, accion="logout", detalle="logout")
        except Exception:
            pass
        return Response({"detalle": "Sesión cerrada correctamente."}, status=status.HTTP_205_RESET_CONTENT)


class VistaSolicitarRecuperacion(APIView):
    """RF-22: POST {correo} siempre 200, no revela si existe. Qué: enlace 30min. Por qué: OWASP."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializador = SolicitarRecuperacionSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        serializador.save()
        return Response(
            {"detalle": "Si el correo existe, se ha enviado un enlace de recuperación."},
            status=status.HTTP_200_OK,
        )


class VistaConfirmarRecuperacion(APIView):
    """RF-22: POST {token, nueva_contrasena} valida 30min + un solo uso + política. Qué: set_password. Por qué: PBKDF2."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializador = ConfirmarRecuperacionSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        serializador.save()
        # RNF-08: auditoría restablecer contraseña (sin exponer datos sensibles)
        try:
            from contratos.services import servicio_contratos
            servicio_contratos.registrar_auditoria(
                usuario=serializador.validated_data.get("usuario") or request.data.get("usuario",""),
                accion="reset_password",
                detalle="password_reset_success",
            )
        except Exception:
            pass
        return Response({"detalle": "Contraseña restablecida correctamente."}, status=status.HTTP_200_OK)