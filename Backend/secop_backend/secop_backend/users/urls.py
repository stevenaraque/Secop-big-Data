from django.urls import path
from .views import VistaRegistro, VistaLogin, VistaLogout, VistaSolicitarRecuperacion, VistaConfirmarRecuperacion

urlpatterns = [
    path("register/", VistaRegistro.as_view(), name="registro"),
    path("login/", VistaLogin.as_view(), name="inicio_sesion"),
    path("logout/", VistaLogout.as_view(), name="cierre_sesion"),
    path("recuperar/", VistaSolicitarRecuperacion.as_view(), name="solicitar_recuperacion"),
    path("restablecer/", VistaConfirmarRecuperacion.as_view(), name="confirmar_recuperacion"),
]