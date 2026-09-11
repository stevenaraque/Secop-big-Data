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
    serializer_class = RegistroSerializer
    permission_classes = [permissions.AllowAny]


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