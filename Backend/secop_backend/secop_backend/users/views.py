from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import RegistroSerializer, InicioSesionSerializer, CierreSesionSerializer


class VistaRegistro(generics.CreateAPIView):
    serializer_class = RegistroSerializer
    permission_classes = [permissions.AllowAny]


class VistaLogin(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializador = InicioSesionSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        datos = serializador.create(serializador.validated_data)
        return Response(datos, status=status.HTTP_200_OK)


class VistaLogout(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializador = CierreSesionSerializer(data=request.data)
        serializador.is_valid(raise_exception=True)
        serializador.save()
        return Response({"detalle": "Sesión cerrada correctamente."}, status=status.HTTP_205_RESET_CONTENT)