# V3.4 perf 9.3M: covering indexes para agregados del dashboard + ANALYZE.
# idx_cover_depto: resumen/serie/banderas filtran (depto, modalidad, fecha) y agregan valor
#   → index-only scan en vez de heap fetch 9.3M.
# idx_contratista_nombre: top-contratistas GROUP BY sin sort en disco.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contratos', '0013_alter_contrato_fecha_firma_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS idx_cover_depto
              ON contrato (departamento, modalidad, fecha_firma)
              INCLUDE (valor_contrato);
            CREATE INDEX IF NOT EXISTS idx_contratista_nombre
              ON contrato (contratista_nombre);
            ANALYZE contrato;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS idx_cover_depto;
            DROP INDEX IF EXISTS idx_contratista_nombre;
            """,
        ),
    ]
