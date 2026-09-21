import pytest
from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.db import transaction
from contratos.models import Contrato, Entidad, TrabajoCarga
from contratos.services import ServicioContratos
from django.contrib.auth import get_user_model

User = get_user_model()


class TestContratoModel(TestCase):
    """Test modelo Contrato: creación, validación y FK a Entidad."""

    def test_crear_contrato_valido_con_entidad(self):
        entidad = Entidad.objects.create(
            nombre_entidad="Alcaldía Test",
            nit_entidad="900123456",
            departamento="Boyacá",
            ciudad="Tunja",
            sector="Administración",
        )
        contrato = Contrato.objects.create(
            nombre_entidad=entidad.nombre_entidad,
            nit_entidad=entidad.nit_entidad,
            departamento=entidad.departamento,
            ciudad=entidad.ciudad,
            orden="1",
            sector=entidad.sector,
            id_contrato="TEST-001",
            estado_contrato="Firmado",
            codigo_categoria_principal="CAT1",
            descripcion_del_proceso="Prueba",
            valor_contrato=Decimal("1000000.00"),
            fecha_firma="2024-01-15",
            modalidad="Licitación pública",
            contratista_nit="123456789",
            contratista_nombre="Contratista Test",
            entidad=entidad,
        )
        self.assertEqual(Contrato.objects.count(), 1)
        self.assertEqual(contrato.entidad, entidad)
        self.assertEqual(contrato.valor_contrato, Decimal("1000000.00"))

    def test_contrato_rechaza_valor_invalido_mas_2_decimales(self):
        entidad = Entidad.objects.create(
            nombre_entidad="Test",
            nit_entidad="900999",
            departamento="Bogotá",
            ciudad="Bogotá",
            sector="Test",
        )
        with self.assertRaises(ValidationError):
            contrato = Contrato(
                nombre_entidad="Test",
                nit_entidad="900999",
                departamento="Bogotá",
                ciudad="Bogotá",
                orden="1",
                sector="Test",
                id_contrato="TEST-002",
                estado_contrato="Firmado",
                codigo_categoria_principal="CAT1",
                descripcion_del_proceso="Prueba",
                valor_contrato=Decimal("1000.123"),
                fecha_firma="2024-01-15",
                modalidad="Licitación",
                contratista_nit="111",
                contratista_nombre="Test",
                entidad=entidad,
            )
            contrato.full_clean()


class TestServicioContratos(TestCase):
    """Test servicio: resumen optimizado usa agregación en BD."""

    def setUp(self):
        self.entidad = Entidad.objects.create(
            nombre_entidad="Alcaldía Test",
            nit_entidad="900123",
            departamento="Boyacá",
            ciudad="Tunja",
            sector="Test",
        )
        for i in range(3):
            Contrato.objects.create(
                nombre_entidad=self.entidad.nombre_entidad,
                nit_entidad=self.entidad.nit_entidad,
                departamento=self.entidad.departamento,
                ciudad=self.entidad.ciudad,
                orden="1",
                sector=self.entidad.sector,
                id_contrato=f"TEST-{i}",
                estado_contrato="Firmado",
                codigo_categoria_principal="CAT1",
                descripcion_del_proceso="Prueba",
                valor_contrato=Decimal("1000000.00"),
                fecha_firma="2024-01-15",
                modalidad="Licitación pública" if i < 2 else "Contratación directa",
                contratista_nit=f"111{i}",
                contratista_nombre=f"Contratista {i}",
                entidad=self.entidad,
            )

    def test_resumen_optimizado_agrega_en_bd(self):
        servicio = ServicioContratos(modelo=Contrato)
        resumen = servicio.resumen_optimizado(depto="Boyacá")
        self.assertEqual(resumen["total"], 3)
        self.assertEqual(resumen["suma_valor"], Decimal("3000000.00"))
        self.assertEqual(resumen["promedio_valor"], Decimal("1000000.00"))

    def test_resumen_filtra_por_modalidad(self):
        servicio = ServicioContratos(modelo=Contrato)
        resumen = servicio.resumen_optimizado(depto="Boyacá", modalidad="Contratación directa")
        self.assertEqual(resumen["total"], 1)
        self.assertEqual(resumen["suma_valor"], Decimal("1000000.00"))


class TestETLCarga(TestCase):
    """Test comando cargar_secop: validación calidad y sin duplicados (mock sin red)."""

    def _fake_soda(self):
        # P2: mock SODA sin gastar quota. 2 válidos + 1 sin fecha (RNF-04 la descarta).
        from unittest.mock import Mock
        filas = [
            {"id_contrato": "MOCK-001", "valor_del_contrato": "1000000", "fecha_de_firma": "2024-01-15T00:00:00.000",
             "nombre_entidad": "Alcaldía Mock", "nit_entidad": "900001", "departamento": "Boyacá", "ciudad": "Tunja",
             "orden": "1", "sector": "Test", "estado_contrato": "Firmado", "codigo_categoria_principal": "CAT1",
             "descripcion_del_proceso": "Pavimento mock", "modalidad_de_contratacion": "Licitación pública",
             "documento_proveedor": "111", "proveedor_adjudicado": "Contratista Mock 1"},
            {"id_contrato": "MOCK-002", "valor_del_contrato": "2000000", "fecha_de_firma": "2024-02-20T00:00:00.000",
             "nombre_entidad": "Alcaldía Mock", "nit_entidad": "900001", "departamento": "Boyacá", "ciudad": "Duitama",
             "orden": "1", "sector": "Test", "estado_contrato": "Firmado", "codigo_categoria_principal": "CAT1",
             "descripcion_del_proceso": "Puente mock", "modalidad_de_contratacion": "Contratación directa",
             "documento_proveedor": "222", "proveedor_adjudicado": "Contratista Mock 2"},
            {"id_contrato": "MOCK-SIN-FECHA", "valor_del_contrato": "500000", "fecha_de_firma": "",
             "nombre_entidad": "Alcaldía Mock", "nit_entidad": "900001", "departamento": "Boyacá", "ciudad": "Sogamoso",
             "orden": "1", "sector": "Test", "estado_contrato": "Firmado", "codigo_categoria_principal": "CAT1",
             "descripcion_del_proceso": "Sin fecha", "modalidad_de_contratacion": "Licitación pública",
             "documento_proveedor": "333", "proveedor_adjudicado": "Contratista Mock 3"},
        ]
        resp = Mock()
        resp.json.return_value = filas
        resp.raise_for_status.return_value = None
        return resp

    @pytest.mark.django_db(transaction=True)
    def test_cargar_secop_descarta_sin_fecha_y_no_duplica(self):
        from unittest.mock import patch
        from django.core.management import call_command
        from io import StringIO

        # Primera carga: 3 filas SODA → 2 nuevos (1 sin fecha descartada)
        with patch("contratos.management.commands.cargar_secop.requests.get", return_value=self._fake_soda()):
            out = StringIO()
            call_command("cargar_secop", limit=10, offset=0, depto="Boyacá", stdout=out)
        trabajo1 = TrabajoCarga.objects.latest("id")
        self.assertEqual(trabajo1.estado, "completado")
        self.assertEqual(Contrato.objects.filter(id_contrato__in=["MOCK-001", "MOCK-002"]).count(), 2)
        primeros = Contrato.objects.count()

        # Segunda carga mismo mock = 0 nuevos
        with patch("contratos.management.commands.cargar_secop.requests.get", return_value=self._fake_soda()):
            out2 = StringIO()
            call_command("cargar_secop", limit=10, offset=0, depto="Boyacá", stdout=out2)
        trabajo2 = TrabajoCarga.objects.latest("id")
        self.assertEqual(trabajo2.nuevos_registros, 0)
        self.assertEqual(Contrato.objects.count(), primeros)


# Ejecutar con: .\venv\Scripts\python.exe -m pytest Backend/secop_backend/pytest.ini -v