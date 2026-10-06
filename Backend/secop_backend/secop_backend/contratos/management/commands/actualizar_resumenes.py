"""
actualizar_resumenes — Recalcula tablas preagregadas V3.4 (resumen_global/depto, contratista_total, serie_mensual).
Uso: tras poblar_secop o cargas SODA grandes.
  python manage.py actualizar_resumenes
Tarda ~1-2 min con 9.3M (GROUP BY pesado una sola vez, no por request).
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection

MODALIDADES_DIRECTA = ("Contratación directa", "Contratacion directa")


class Command(BaseCommand):
    help = "Recalcula resúmenes preagregados V3.4 para dashboard instantáneo."

    def handle(self, *args, **opciones):
        t0 = time.time()
        with connection.cursor() as cur:
            cur.execute("TRUNCATE resumen_global, resumen_depto, contratista_total, serie_mensual, top_depto, serie_depto")
            cur.execute(
                "INSERT INTO resumen_global (total, suma, promedio, actualizado_en) "
                "SELECT COUNT(*), COALESCE(SUM(valor_contrato),0), COALESCE(AVG(valor_contrato),0), NOW() "
                "FROM contrato"
            )
            self.stdout.write(f"global OK ({time.time()-t0:.0f}s)")
            cur.execute(
                "INSERT INTO resumen_depto (departamento, total, suma, directas, suma_directa) "
                "SELECT departamento, COUNT(*), COALESCE(SUM(valor_contrato),0), "
                "COUNT(*) FILTER (WHERE modalidad = ANY(%s)), "
                "COALESCE(SUM(valor_contrato) FILTER (WHERE modalidad = ANY(%s)),0) "
                "FROM contrato GROUP BY departamento",
                [list(MODALIDADES_DIRECTA), list(MODALIDADES_DIRECTA)],
            )
            self.stdout.write(f"depto OK ({time.time()-t0:.0f}s)")
            cur.execute(
                "INSERT INTO contratista_total (contratista_nit, contratista_nombre, total_contratos, suma_valor) "
                "SELECT contratista_nit, contratista_nombre, COUNT(*), COALESCE(SUM(valor_contrato),0) "
                "FROM contrato GROUP BY contratista_nit, contratista_nombre"
            )
            self.stdout.write(f"contratistas OK ({time.time()-t0:.0f}s)")
            cur.execute(
                "INSERT INTO serie_mensual (mes, total, suma) "
                "SELECT DATE_TRUNC('month', fecha_firma)::date, COUNT(*), COALESCE(SUM(valor_contrato),0) "
                "FROM contrato WHERE fecha_firma IS NOT NULL GROUP BY 1"
            )
            self.stdout.write(f"serie OK ({time.time()-t0:.0f}s)")
            cur.execute(
                "INSERT INTO top_depto (departamento, contratista_nit, contratista_nombre, total_contratos, suma_valor) "
                "SELECT departamento, contratista_nit, contratista_nombre, COUNT(*), COALESCE(SUM(valor_contrato),0) "
                "FROM contrato GROUP BY departamento, contratista_nit, contratista_nombre"
            )
            self.stdout.write(f"top_depto OK ({time.time()-t0:.0f}s)")
            cur.execute(
                "INSERT INTO serie_depto (departamento, mes, total, suma) "
                "SELECT departamento, DATE_TRUNC('month', fecha_firma)::date, COUNT(*), COALESCE(SUM(valor_contrato),0) "
                "FROM contrato WHERE fecha_firma IS NOT NULL GROUP BY departamento, 2"
            )
            self.stdout.write(f"serie_depto OK ({time.time()-t0:.0f}s)")
        self.stdout.write(self.style.SUCCESS(f"Resúmenes listos en {(time.time()-t0)/60:.1f} min"))
