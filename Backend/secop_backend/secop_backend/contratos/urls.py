from django.urls import path
from .views import VistaIniciarCarga, VistaEstadoCarga

urlpatterns = [
    path("cargar/", VistaIniciarCarga.as_view(), name="iniciar_carga"),
    path("cargar/<int:pk>/", VistaEstadoCarga.as_view(), name="estado_carga"),
]
