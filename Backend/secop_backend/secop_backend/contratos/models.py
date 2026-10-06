
from django.db import models


class Entidad(models.Model):
    nombre_entidad = models.CharField(max_length=255)
    nit_entidad = models.CharField(max_length=50, unique=True)
    departamento = models.CharField(max_length=100)
    ciudad = models.CharField(max_length=100)
    sector = models.CharField(max_length=100)

    class Meta:
        db_table = "entidad"
        indexes = [
            models.Index(fields=["nit_entidad"], name="idx_entidad_nit"),
        ]

    def __str__(self):
        return f"{self.nombre_entidad} - {self.nit_entidad}"


class Contrato(models.Model):
    nombre_entidad = models.CharField(max_length=255)
    nit_entidad = models.CharField(max_length=50)
    departamento = models.CharField(max_length=100)
    ciudad = models.CharField(max_length=100)
    orden = models.CharField(max_length=100)
    sector = models.CharField(max_length=100)
    id_contrato = models.CharField(max_length=100, db_index=True)  # V3.3: sin unique para guardar las 9.274.086 filas (dup reales en SECOP). Dups permitidos.
    estado_contrato = models.CharField(max_length=100)
    codigo_categoria_principal = models.CharField(max_length=100)
    descripcion_del_proceso = models.TextField()
    valor_contrato = models.DecimalField(max_digits=30, decimal_places=2, null=True, blank=True)  # V3.3: 30 digitos (habia overflow con 18) + nullable
    fecha_firma = models.DateField(null=True, blank=True)  # V3.3: nullable (127k filas sin fecha valida en SECOP)
    modalidad = models.CharField(max_length=100)
    contratista_nit = models.CharField(max_length=50)
    contratista_nombre = models.CharField(max_length=255)

    entidad = models.ForeignKey(Entidad, on_delete=models.CASCADE, related_name="contratos", null=True, blank=True)



    class Meta:
        db_table = "contrato"
        indexes = [
            models.Index(fields=["departamento"], name="idx_contrato_depto"),
            models.Index(fields=["modalidad"], name="idx_contrato_modalidad"),
            models.Index(fields=["fecha_firma"], name="idx_contrato_fecha"),
            models.Index(fields=["contratista_nit"], name="idx_contrato_nit"),
        ]

    def __str__(self):
        return f"{self.id_contrato} - {self.contratista_nombre}"
class TrabajoCarga(models.Model):
    ESTADOS = [
        ("pendiente", "Pendiente"),
        ("en_progreso", "En progreso"),
        ("completado", "Completado"),
        ("error", "Error"),
    ]
    ORIGENES = [
        ("manual", "Manual"),
        ("periodica", "Periódica"),
    ]
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    origen = models.CharField(max_length=20, choices=ORIGENES, default="manual")
    total_registros = models.IntegerField(default=0)
    registros_procesados = models.IntegerField(default=0)
    nuevos_registros = models.IntegerField(default=0)
    offset_actual = models.IntegerField(default=0)
    mensaje_error = models.TextField(blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "trabajo_carga"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Carga {self.id} [{self.origen}] {self.estado} {self.registros_procesados}/{self.total_registros}"


class ConfigActualizacion(models.Model):
    """RF-26: programación periódica. Qué: intervalo + activo. Por qué: mantener datos al día sin intervención."""

    intervalo_horas = models.IntegerField(default=24)
    activo = models.BooleanField(default=False)
    ultima_ejecucion = models.DateTimeField(null=True, blank=True)
    ultimo_estado = models.CharField(max_length=20, blank=True, default="")
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "config_actualizacion"

    def __str__(self):
        return f"Actualización cada {self.intervalo_horas}h activo={self.activo}"


class BackupRegistro(models.Model):
    """RNF-09: respaldo 7 días. Qué: archivo + retención. Por qué: recuperar ante pérdida."""

    ESTADOS = [
        ("completado", "Completado"),
        ("error", "Error"),
    ]
    archivo = models.CharField(max_length=255)
    # P1: ascii sin ñ. Qué: evita mangling JSON en PowerShell. Por qué: key ñ se ve tama��o_bytes.
    tamano_bytes = models.IntegerField(default=0)
    registros = models.IntegerField(default=0)
    estado = models.CharField(max_length=20, choices=ESTADOS, default="completado")
    mensaje_error = models.TextField(blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "backup_registro"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Backup {self.id} {self.creado_en.date()} {self.registros} regs {self.tamano_bytes}B"


class Auditoria(models.Model):
    """RNF-08: trazabilidad. Qué: usuario/acción/fecha/detalle sin exponer contraseñas. Por qué: auditoría."""

    ACCIONES = [
        ("login", "Login"),
        ("logout", "Logout"),
        ("exportar", "Exportar"),
        ("config_umbral", "Config umbral"),
        ("backup", "Backup"),
        ("carga", "Carga"),
        ("reset_password", "Reset password"),
    ]
    usuario = models.CharField(max_length=150, blank=True, default="")
    accion = models.CharField(max_length=20, choices=ACCIONES)
    detalle = models.CharField(max_length=500, blank=True, default="")
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auditoria"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.fecha} {self.usuario} {self.accion}"


class UmbralAlerta(models.Model):
    # RF-24: umbrales configurables persistidos. Qué: evita hardcodear 30/80. Por qué: admin ajusta sin reinicio.
    nombre = models.CharField(max_length=50, unique=True)
    valor = models.DecimalField(max_digits=5, decimal_places=2)
    descripcion = models.CharField(max_length=255, blank=True, default="")
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "umbral_alerta"

    def __str__(self):
        return f"{self.nombre} = {self.valor}%"


class Radar(models.Model):
    # RF-36 + RF-42: preferencias + filtros elegibles 85 cols
    usuario = models.ForeignKey("auth.User", on_delete=models.CASCADE, related_name="radares")
    departamento_objetivo = models.CharField(max_length=100, blank=True, default="")
    palabras_clave = models.CharField(max_length=255)
    rango_cuantia_min = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    rango_cuantia_max = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    filtros_extras = models.JSONField(default=dict, blank=True)  # RF-42: {"ciudad":"Sogamoso","modalidad":"Licitacion publica", ...} 85 cols elegibles
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "radar"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["usuario"], name="idx_radar_usuario"),
            models.Index(fields=["palabras_clave"], name="idx_radar_palabras"),
        ]

    def __str__(self):
        return f"Radar {self.id} {self.usuario} {self.palabras_clave} {self.filtros_extras}"


class Oportunidad(models.Model):
    # RF-39: match contrato-radar para bandeja privada
    ESTADOS = [("Nueva", "Nueva"), ("Guardada", "Guardada"), ("Postulado", "Postulado")]
    contrato = models.ForeignKey(Contrato, on_delete=models.CASCADE, related_name="oportunidades")
    radar = models.ForeignKey(Radar, on_delete=models.CASCADE, related_name="oportunidades")
    estado = models.CharField(max_length=20, choices=ESTADOS, default="Nueva")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "oportunidad"
        unique_together = [("contrato", "radar")]
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["radar", "estado"], name="idx_oportunidad_radar_estado"),
        ]

    def __str__(self):
        return f"Oportunidad {self.id} {self.radar_id}->{self.contrato_id} {self.estado}"


class ResumenGlobal(models.Model):
    """V3.4: KPIs globales precalculados (COUNT/SUM/AVG 9.3M = 30s en vivo, 5ms aquí)."""

    total = models.BigIntegerField(default=0)
    suma = models.DecimalField(max_digits=30, decimal_places=2, default=0)
    promedio = models.DecimalField(max_digits=30, decimal_places=2, default=0)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resumen_global"


class ResumenDepto(models.Model):
    """V3.4: agregados por departamento para mapa + KPIs (34 filas)."""

    departamento = models.CharField(max_length=100, primary_key=True)
    total = models.BigIntegerField(default=0)
    suma = models.DecimalField(max_digits=30, decimal_places=2, default=0)
    directas = models.BigIntegerField(default=0)
    suma_directa = models.DecimalField(max_digits=30, decimal_places=2, default=0)

    class Meta:
        db_table = "resumen_depto"


class ContratistaTotal(models.Model):
    """V3.4: top contratistas preagregado (GROUP BY 9.3M = 34s en vivo, 5ms aquí)."""

    contratista_nit = models.CharField(max_length=50)
    contratista_nombre = models.CharField(max_length=255)
    total_contratos = models.BigIntegerField(default=0)
    suma_valor = models.DecimalField(max_digits=30, decimal_places=2, default=0)

    class Meta:
        db_table = "contratista_total"
        indexes = [
            models.Index(fields=["-suma_valor"], name="idx_ctop_suma"),
        ]


class SerieMensual(models.Model):
    """V3.4: serie mensual precalculada (140 filas)."""

    mes = models.DateField(primary_key=True)
    total = models.BigIntegerField(default=0)
    suma = models.DecimalField(max_digits=30, decimal_places=2, default=0)

    class Meta:
        db_table = "serie_mensual"
        ordering = ["mes"]


class TopDepto(models.Model):
    """V3.4: top contratistas por departamento (dashboard filtra por depto siempre)."""

    departamento = models.CharField(max_length=100)
    contratista_nit = models.CharField(max_length=50)
    contratista_nombre = models.CharField(max_length=255)
    total_contratos = models.BigIntegerField(default=0)
    suma_valor = models.DecimalField(max_digits=30, decimal_places=2, default=0)

    class Meta:
        db_table = "top_depto"
        indexes = [
            models.Index(fields=["departamento", "-suma_valor"], name="idx_topdepto_depto"),
        ]


class SerieDepto(models.Model):
    """V3.4: serie mensual por departamento (scrub con filtro)."""

    departamento = models.CharField(max_length=100)
    mes = models.DateField()
    total = models.BigIntegerField(default=0)
    suma = models.DecimalField(max_digits=30, decimal_places=2, default=0)

    class Meta:
        db_table = "serie_depto"
        unique_together = [("departamento", "mes")]
        ordering = ["departamento", "mes"]