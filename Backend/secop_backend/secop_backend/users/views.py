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
    # P0-4: scope register 20/min frena enumeración masiva sin tocar anon 200/min del observatorio.
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correo = serializer.validated_data.get("email")
        nombre_usuario = serializer.validated_data.get("username")
        from django.contrib.auth.models import User
        from django.core.mail import send_mail
        from django.conf import settings

        DETALLE_GENERICO = "Si el correo no existía, cuenta creada; si ya existía, se envió notificación a tu email."
        # Si ya existe (correo o username), no revelar: misma respuesta 200 genérica idéntica a éxito
        # P0-3: iexact evita duplicado Test@X vs test@x (antes exact creaba 2 filas)
        if correo and User.objects.filter(email__iexact=correo).exists():
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
                {"detalle": DETALLE_GENERICO},
                status=status.HTTP_200_OK,
            )
        # P0-2: username duplicado también retorna 200 genérico (antes 500 IntegrityError = oráculo)
        if nombre_usuario and User.objects.filter(username=nombre_usuario).exists():
            return Response(
                {"detalle": DETALLE_GENERICO},
                status=status.HTTP_200_OK,
            )
        try:
            self.perform_create(serializer)
        except Exception as e:
            # Carrera: duplicado tras nuestro check (email o username) o IntegrityError UNIQUE → 200 genérico
            msg = str(e).lower()
            if (
                "ya está registrado" in str(e)
                or "ya está en uso" in str(e)
                or "unique" in msg
                or "duplicate" in msg
                or "unique constraint" in msg
            ):
                return Response(
                    {"detalle": DETALLE_GENERICO},
                    status=status.HTTP_200_OK,
                )
            raise
        # Fix hunter-auth/register-body-oracle:v1: forma idéntica ambas ramas (solo detalle, sin usuario ni headers).
        return Response(
            {"detalle": DETALLE_GENERICO},
            status=status.HTTP_200_OK,
        )


class VistaLogin(APIView):
    permission_classes = [permissions.AllowAny]
    # P0-4: scope login 10/min frena fuerza bruta (antes anon 200/min = 288k/día/IP).
    throttle_scope = "login"

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
    # P0-4: scope recuperar 20/min evita spam de emails + enumeración.
    throttle_scope = "recuperar"

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
    # P0-4: mismo scope recuperar 20/min (quema de tokens + prueba de enlaces).
    throttle_scope = "recuperar"

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