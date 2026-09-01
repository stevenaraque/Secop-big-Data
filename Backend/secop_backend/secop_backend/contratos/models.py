
from django.db import models


class Contrato(models.Model):
    nombre_entidad = models.CharField(max_length=255)
    nit_entidad = models.CharField(max_length=50)
    departamento = models.CharField(max_length=100, db_index=True)
    ciudad = models.CharField(max_length=100)
    orden = models.CharField(max_length=100)
    sector = models.CharField(max_length=100)
    id_contrato = models.CharField(max_length=100, unique=True)
    estado_contrato = models.CharField(max_length=100)
    codigo_categoria_principal = models.CharField(max_length=100)
    descripcion_del_proceso = models.TextField()
    valor_contrato = models.DecimalField(max_digits=18, decimal_places=2)
    fecha_firma = models.DateField()
    modalidad = models.CharField(max_length=100, db_index=True)
    contratista_nit = models.CharField(max_length=50, db_index=True)
    contratista_nombre = models.CharField(max_length=255)

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
