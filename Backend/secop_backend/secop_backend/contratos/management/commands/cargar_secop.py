import os
import requests
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand
from django.db import transaction
from contratos.models import Contrato, Entidad, TrabajoCarga, Radar, Oportunidad

SODA_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"

class Command(BaseCommand):
    help = "Carga contratos SECOP II desde SODA 2.1 con bulk_create 1000"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50000)
        parser.add_argument("--offset", type=int, default=0)
        parser.add_argument("--depto", type=str, default=None)
        parser.add_argument("--trabajo-id", type=int, default=None)
        parser.add_argument("--origen", type=str, default="manual", choices=["manual", "periodica"])

    def handle(self, *args, **opciones):
        limite = opciones["limit"]
        offset = opciones["offset"]
        depto = opciones["depto"]
        token = os.getenv("SODA_APP_TOKEN", "")

        origen = opciones.get("origen", "manual")
        if opciones.get("trabajo_id"):
            trabajo = TrabajoCarga.objects.get(id=opciones["trabajo_id"])
            trabajo.estado = "en_progreso"
            trabajo.offset_actual = offset
            if hasattr(trabajo, "origen"):
                trabajo.origen = origen
            trabajo.save()
        else:
            trabajo = TrabajoCarga.objects.create(estado="en_progreso", offset_actual=offset, origen=origen)
        self.stdout.write(f"Iniciando carga {trabajo.id} [{origen}] offset {offset} limit {limite}")

        headers = {"X-App-Token": token} if token else {}
        params = {"$limit": limite, "$offset": offset, "$order": ":id"}
        if depto:
            params["$where"] = f"departamento='{depto}'"

        resp = requests.get(SODA_URL, params=params, headers=headers, timeout=60)
        resp.raise_for_status()
        datos = resp.json()

        trabajo.total_registros = len(datos)
        trabajo.save()

        # RNF-04: validar calidad — convertir valor a Decimal, descartar no numéricos, log sin abortar, omitir duplicados
        a_crear = []
        invalidas = []
        for fila in datos:
            idc = (fila.get("id_contrato") or "").strip()[:100]
            if not idc:
                invalidas.append(f"sin id_contrato fila {str(fila)[:80]}")
                continue
            raw_val = fila.get("valor_del_contrato")
            try:
                if raw_val is None or raw_val == "":
                    valor = Decimal("0")
                else:
                    valor = Decimal(str(raw_val).replace(",", ""))
                    # validar max_digits 18, decimal_places 2: si tiene >2 decimales, descartar
                    if valor.as_tuple().exponent < -2:
                        # redondear a 2 decimales no, descartar según RNF-04
                        raise InvalidOperation("más de 2 decimales")
                    if len(valor.as_tuple().digits) > 18:
                        raise InvalidOperation("más de 18 dígitos")
            except (InvalidOperation, ValueError, AttributeError) as e:
                invalidas.append(f"valor no numérico '{raw_val}' id {idc}")
                continue
            fecha_raw = fila.get("fecha_de_firma") or ""
            if not fecha_raw:
                invalidas.append(f"sin fecha id {idc}")
                continue
            try:
                fecha = fecha_raw.split("T")[0]
                # validar fecha
                from datetime import date
                date.fromisoformat(fecha)
            except Exception:
                invalidas.append(f"fecha inválida '{fecha_raw}' id {idc}")
                continue
            a_crear.append(Contrato(
                nombre_entidad=fila.get("nombre_entidad","")[:255],
                nit_entidad=fila.get("nit_entidad","")[:50],
                departamento=fila.get("departamento","")[:100],
                ciudad=fila.get("ciudad","")[:100],
                orden=fila.get("orden","")[:100],
                sector=fila.get("sector","")[:100],
                id_contrato=idc,
                estado_contrato=fila.get("estado_contrato","")[:100],
                codigo_categoria_principal=fila.get("codigo_categoria_principal","")[:100],
                descripcion_del_proceso=fila.get("descripcion_del_proceso","")[:500],
                valor_contrato=valor,
                fecha_firma=fecha,
                modalidad=fila.get("modalidad_de_contratacion","")[:100],
                contratista_nit=fila.get("documento_proveedor","")[:50],
                contratista_nombre=fila.get("proveedor_adjudicado","")[:255],
            ))
        if invalidas:
            # log sin abortar — guardar resumen en mensaje_error (no exponer datos sensibles, solo conteo + ejemplos)
            trabajo.mensaje_error = f"Filas inválidas {len(invalidas)}/{len(datos)}: " + "; ".join(invalidas[:3])
            trabajo.save(update_fields=["mensaje_error"])
            self.stdout.write(self.style.WARNING(f"RNF-04: {len(invalidas)} filas inválidas descartadas (ver mensaje_error)"))

        # RF-26: evitar duplicados por id_contrato — contar nuevos reales
        ids_a_crear = [c.id_contrato for c in a_crear if c.id_contrato]
        existentes = set(Contrato.objects.filter(id_contrato__in=ids_a_crear).values_list("id_contrato", flat=True)) if ids_a_crear else set()
        nuevos = len([c for c in a_crear if c.id_contrato not in existentes])

        with transaction.atomic():
            Contrato.objects.bulk_create(a_crear, batch_size=1000, ignore_conflicts=True)

        # RF-39 Fase 2 Matchmaking: cruzar nuevos contratos vs Radares activos
        nuevos_contratos = []
        if nuevos and ids_a_crear:
            # obtener objetos reales con PK para FK
            nuevos_ids = [c.id_contrato for c in a_crear if c.id_contrato not in existentes]
            if nuevos_ids:
                nuevos_contratos = list(Contrato.objects.filter(id_contrato__in=nuevos_ids))
        if nuevos_contratos:
            radares = list(Radar.objects.filter(activo=True).select_related("usuario"))
            oportunidades = []
            for contrato in nuevos_contratos:
                desc = (contrato.descripcion_del_proceso or "").lower()
                nombre = (contrato.contratista_nombre or "").lower()
                for radar in radares:
                    # filtro depto
                    if radar.departamento_objetivo and radar.departamento_objetivo.strip().lower() not in contrato.departamento.lower():
                        continue
                    # filtro palabras_clave (ILIKE)
                    kw = (radar.palabras_clave or "").strip().lower()
                    if kw and kw not in desc and kw not in nombre:
                        continue
                    # filtro rango cuantia
                    if radar.rango_cuantia_min is not None and contrato.valor_contrato < radar.rango_cuantia_min:
                        continue
                    if radar.rango_cuantia_max is not None and contrato.valor_contrato > radar.rango_cuantia_max:
                        continue
                    # RF-42: filtros elegibles 85 cols via JSON (ej. {"ciudad":"Sogamoso","modalidad":"Licitacion publica"})
                    filtros = getattr(radar, "filtros_extras", None) or {}
                    if filtros:
                        ok = True
                        for k, v in filtros.items():
                            contrato_val = getattr(contrato, k, None)
                            if contrato_val is None or str(v).strip().lower() not in str(contrato_val).lower():
                                ok = False
                                break
                        if not ok:
                            continue
                    oportunidades.append(Oportunidad(contrato=contrato, radar=radar, estado="Nueva"))
            if oportunidades:
                Oportunidad.objects.bulk_create(oportunidades, batch_size=1000, ignore_conflicts=True)
                self.stdout.write(self.style.SUCCESS(f"Matchmaking: {len(oportunidades)} oportunidades creadas para {len(radares)} radares"))
                # RF-41: email no bloqueante (best-effort)
                try:
                    from django.core.mail import send_mail
                    from django.conf import settings
                    for op in oportunidades[:10]:  # limitar a 10 emails por carga para demo
                        try:
                            email = op.radar.usuario.email
                            if email:
                                send_mail(
                                    subject=f"Nueva oportunidad: {op.radar.palabras_clave}",
                                    message=f"Hola {op.radar.usuario.username}, tu Radar '{op.radar.palabras_clave}' hizo match con contrato {op.contrato.id_contrato} - {op.contrato.departamento} ${op.contrato.valor_contrato}. Revisa tu bandeja en /app.",
                                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@secop-insight.local"),
                                    recipient_list=[email],
                                    fail_silently=True,
                                )
                        except Exception:
                            continue
                except Exception:
                    pass

        trabajo.registros_procesados = len(a_crear)
        trabajo.nuevos_registros = nuevos
        trabajo.estado = "completado"
        trabajo.save()
        # RF-26: actualizar ConfigActualizacion si es periódica
        if origen == "periodica":
            from contratos.models import ConfigActualizacion
            from django.utils import timezone
            cfg, _ = ConfigActualizacion.objects.get_or_create(id=1, defaults={"intervalo_horas": 24, "activo": True})
            cfg.ultima_ejecucion = timezone.now()
            cfg.ultimo_estado = "completado"
            cfg.save(update_fields=["ultima_ejecucion", "ultimo_estado", "actualizado_en"])
        self.stdout.write(self.style.SUCCESS(f"Carga {trabajo.id} completada {len(a_crear)} registros ({nuevos} nuevos, {len(a_crear)-nuevos} duplicados ignorados)"))