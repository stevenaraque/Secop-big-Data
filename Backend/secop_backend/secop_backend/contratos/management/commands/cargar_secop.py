import os
import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from contratos.models import Contrato, Entidad, TrabajoCarga

SODA_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"

class Command(BaseCommand):
    help = "Carga contratos SECOP II desde SODA 2.1 con bulk_create 1000"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50000)
        parser.add_argument("--offset", type=int, default=0)
        parser.add_argument("--depto", type=str, default=None)
        parser.add_argument("--trabajo-id", type=int, default=None)

    def handle(self, *args, **opciones):
        limite = opciones["limit"]
        offset = opciones["offset"]
        depto = opciones["depto"]
        token = os.getenv("SODA_APP_TOKEN", "")

        if opciones.get("trabajo_id"):
            trabajo = TrabajoCarga.objects.get(id=opciones["trabajo_id"])
            trabajo.estado = "en_progreso"
            trabajo.offset_actual = offset
            trabajo.save()
        else:
            trabajo = TrabajoCarga.objects.create(estado="en_progreso", offset_actual=offset)
        self.stdout.write(f"Iniciando carga {trabajo.id} offset {offset} limit {limite}")

        headers = {"X-App-Token": token} if token else {}
        params = {"$limit": limite, "$offset": offset}
        if depto:
            params["$where"] = f"departamento='{depto}'"

        resp = requests.get(SODA_URL, params=params, headers=headers, timeout=60)
        resp.raise_for_status()
        datos = resp.json()

        trabajo.total_registros = len(datos)
        trabajo.save()

        a_crear = []
        for fila in datos:
            a_crear.append(Contrato(
                nombre_entidad=fila.get("nombre_entidad","")[:255],
                nit_entidad=fila.get("nit_entidad","")[:50],
                departamento=fila.get("departamento","")[:100],
                ciudad=fila.get("ciudad","")[:100],
                orden=fila.get("orden","")[:100],
                sector=fila.get("sector","")[:100],
                id_contrato=fila.get("id_contrato","")[:100],
                estado_contrato=fila.get("estado_contrato","")[:100],
                codigo_categoria_principal=fila.get("codigo_categoria_principal","")[:100],
                descripcion_del_proceso=fila.get("descripcion_del_proceso","")[:500],
                valor_contrato=fila.get("valor_del_contrato") or 0,
                fecha_firma=(fila.get("fecha_de_firma") or "").split("T")[0] or None,
                modalidad=fila.get("modalidad_de_contratacion","")[:100],
                contratista_nit=fila.get("documento_proveedor","")[:50],
                contratista_nombre=fila.get("proveedor_adjudicado","")[:255],
            ))

        with transaction.atomic():
            Contrato.objects.bulk_create(a_crear, batch_size=1000, ignore_conflicts=True)

        trabajo.registros_procesados = len(a_crear)
        trabajo.estado = "completado"
        trabajo.save()
        self.stdout.write(self.style.SUCCESS(f"Carga {trabajo.id} completada {len(a_crear)} registros"))