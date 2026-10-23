"""RF-26: ejecuta la actualización periódica cuando vence el intervalo configurado.

Antes `ConfigActualizacion.activo` era solo un campo de escritura: la API
respondía activo=True y nada corría nunca. Este comando es el ejecutor que
faltaba. Sin Celery ni Redis, dos formas de uso:

    # cron / Programador de tareas cada 5 min (idempotente: solo corre si toca)
    python manage.py actualizar_automatica

    # proceso propio (servicio `scheduler` de docker-compose)
    python manage.py actualizar_automatica --loop --intervalo-min 5
"""

import time
from datetime import timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from contratos.models import ConfigActualizacion, Contrato
from contratos.services import ServicioContratos


class Command(BaseCommand):
    help = "Ejecuta la actualización periódica si venció el intervalo configurado (RF-26)."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="No termina: revisa cada --intervalo-min minutos.")
        parser.add_argument("--intervalo-min", type=int, default=5, help="Minutos entre revisiones con --loop (default 5).")
        parser.add_argument("--limit", type=int, default=50000, help="Filas SODA por ejecución (default 50000).")
        parser.add_argument("--depto", type=str, default=None, help="Filtra la carga a un departamento.")
        parser.add_argument("--dry-run", action="store_true", help="Solo informa si toca ejecutar; no lanza el ETL.")

    def handle(self, *args, **opciones):
        if opciones["loop"]:
            minutos = max(1, opciones["intervalo_min"])
            self.stdout.write(f"Scheduler activo: revisa cada {minutos} min. Ctrl+C para salir.")
            try:
                while True:
                    self._revisar(opciones)
                    time.sleep(minutos * 60)
            except KeyboardInterrupt:
                self.stdout.write("Scheduler detenido.")
            return
        self._revisar(opciones)

    def _revisar(self, opciones):
        cfg, _ = ConfigActualizacion.objects.get_or_create(
            id=1, defaults={"intervalo_horas": 24, "activo": False}
        )
        if not cfg.activo:
            self.stdout.write("Actualización automática desactivada (activo=False).")
            return

        ahora = timezone.now()
        if cfg.ultima_ejecucion:
            vence = cfg.ultima_ejecucion + timedelta(hours=cfg.intervalo_horas)
            if ahora < vence:
                self.stdout.write(f"Aún no vence (próxima {vence:%Y-%m-%d %H:%M:%S}).")
                return

        if opciones["dry_run"]:
            self.stdout.write("Toca ejecutar (dry-run: no se lanza).")
            return

        servicio = ServicioContratos(modelo=Contrato)
        try:
            trabajo = servicio.programar_actualizacion_periodica(
                limite=opciones["limit"], offset=0, depto=opciones["depto"], usuario=None
            )
        except ValueError as e:
            # Ya hay una periódica en curso: no es un error, se reintenta en el próximo tick.
            self.stdout.write(self.style.WARNING(str(e)))
            return

        self.stdout.write(f"Lanzando actualización automática (trabajo {trabajo.id})...")
        try:
            call_command(
                "cargar_secop",
                limit=opciones["limit"],
                offset=0,
                depto=opciones["depto"],
                trabajo_id=trabajo.id,
                origen="periodica",
            )
        except Exception as e:
            # Marcar el fallo y empujar ultima_ejecucion para no reintentar en bucle.
            trabajo.estado = "error"
            trabajo.mensaje_error = str(e)
            trabajo.save(update_fields=["estado", "mensaje_error", "actualizado_en"])
            cfg.ultima_ejecucion = timezone.now()
            cfg.ultimo_estado = "error"
            cfg.save(update_fields=["ultima_ejecucion", "ultimo_estado", "actualizado_en"])
            self.stderr.write(self.style.ERROR(f"Actualización automática falló: {e}"))
