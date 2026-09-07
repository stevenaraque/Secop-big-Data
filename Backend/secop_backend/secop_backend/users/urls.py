from django.urls import path
from .views import VistaRegistro, VistaLogin, VistaLogout

urlpatterns = [
    path("register/", VistaRegistro.as_view(), name="registro"),
    path("login/", VistaLogin.as_view(), name="inicio_sesion"),
    path("logout/", VistaLogout.as_view(), name= "cierre_sesion"),
]