from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def secop_exception_handler(exc, context):
    # RNF-09 C3: si BD no disponible, no mostrar traceback crudo, devolver 503 amigable.
    # Qué: intercepta OperationalError/InterfaceError. Por qué: UI muestra "Servicio no disponible".
    from django.db.utils import OperationalError, InterfaceError
    if isinstance(exc, (OperationalError, InterfaceError)):
        return Response(
            {"detalle": "Servicio no disponible. Intente más tarde."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    # delegar a handler por defecto para 401/403/400 etc.
    response = exception_handler(exc, context)
    # si es 500 no manejado, también dar mensaje genérico sin exponer detalle interno
    if response is None and isinstance(exc, Exception):
        # solo para errores no previstos, loguear en consola pero responder 503 si parece BD
        if "database" in str(exc).lower() or "could not connect" in str(exc).lower():
            return Response(
                {"detalle": "Servicio no disponible. Intente más tarde."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    return response
