
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
    id_contrato = models.CharField(max_length=100, unique=True)
    estado_contrato = models.CharField(max_length=100)
    codigo_categoria_principal = models.CharField(max_length=100)
    descripcion_del_proceso = models.TextField()
    valor_contrato = models.DecimalField(max_digits=18, decimal_places=2)
    fecha_firma = models.DateField()
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
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    total_registros = models.IntegerField(default=0)
    registros_procesados = models.IntegerField(default=0)
    offset_actual = models.IntegerField(default=0)
    mensaje_error = models.TextField(blank=True, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "trabajo_carga"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Carga {self.id} - {self.estado} {self.registros_procesados}/{self.total_registros}"


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