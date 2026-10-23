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

    @pytest.mark.django_db(transaction=True)
    def test_cargar_secop_puebla_catalogo_entidades(self):
        # RF-28 regresión: cada carga ETL deja el catálogo Entidad poblado
        # (antes quedaba en 0 y /api/entidades/ respondía vacío).
        from unittest.mock import patch
        from django.core.management import call_command
        from io import StringIO
        with patch("contratos.management.commands.cargar_secop.requests.get", return_value=self._fake_soda()):
            call_command("cargar_secop", limit=10, offset=0, depto="Boyacá", stdout=StringIO())
        ent = Entidad.objects.filter(nit_entidad="900001").first()
        self.assertIsNotNone(ent)
        self.assertEqual(ent.nombre_entidad, "Alcaldía Mock")
        # Segunda carga no duplica entidades (unique NIT + ignore_conflicts)
        with patch("contratos.management.commands.cargar_secop.requests.get", return_value=self._fake_soda()):
            call_command("cargar_secop", limit=10, offset=0, depto="Boyacá", stdout=StringIO())
        self.assertEqual(Entidad.objects.filter(nit_entidad="900001").count(), 1)


# Ejecutar con: .\venv\Scripts\python.exe -m pytest Backend/secop_backend/pytest.ini -v


class TestDetalleVersiones(TestCase):
    """V3.3: id_contrato no unique → detalle devuelve versiones (200), no 500."""

    def _crear(self, idc):
        return Contrato.objects.create(
            nombre_entidad="E", nit_entidad="1", departamento="Boyacá", ciudad="T",
            orden="1", sector="S", id_contrato=idc, estado_contrato="X",
            codigo_categoria_principal="C", descripcion_del_proceso="D",
            valor_contrato=Decimal("10.00"), fecha_firma="2024-01-01",
            modalidad="M", contratista_nit="1", contratista_nombre="N",
        )

    def test_detalle_devuelve_versiones(self):
        from rest_framework.test import APIClient
        self._crear("DUP-1")
        self._crear("DUP-1")
        r = APIClient().get("/api/contratos/DUP-1/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["versiones"], 2)
        self.assertEqual(len(r.data["resultados"]), 2)

    def test_detalle_inexistente_404(self):
        from rest_framework.test import APIClient
        r = APIClient().get("/api/contratos/NO-EXISTE/")
        self.assertEqual(r.status_code, 404)


class TestBanderasConcentracion(TestCase):
    """P1: el % de concentración divide por el total de la ENTIDAD, no por el
    fan-out del JOIN. Con 2 contratistas (600 + 400) sobre 1000 el resultado
    correcto es 60% / 40%; el JOIN d↔e duplicaba el denominador y daba 30% / 20%."""

    def setUp(self):
        from contratos.models import BanderaDet, EntidadDepto
        EntidadDepto.objects.create(
            departamento="Boyacá", nombre_entidad="Alcaldía X", total=Decimal("1000")
        )
        BanderaDet.objects.create(
            departamento="Boyacá", nombre_entidad="Alcaldía X", contratista_nit="A",
            contratista_nombre="Contratista A", monto=Decimal("600"), contratos=2,
        )
        BanderaDet.objects.create(
            departamento="Boyacá", nombre_entidad="Alcaldía X", contratista_nit="B",
            contratista_nombre="Contratista B", monto=Decimal("400"), contratos=1,
        )

    def test_pct_usa_total_de_entidad_sin_fanout(self):
        res = ServicioContratos(modelo=Contrato).banderas_concentracion(umbral=30)
        pcts = {b["contratista_nit"]: b["porcentaje"] for b in res["banderas"]}
        self.assertEqual(res["total"], 2)
        self.assertAlmostEqual(pcts["A"], 60.0, places=2)
        self.assertAlmostEqual(pcts["B"], 40.0, places=2)
        montos = {b["contratista_nit"]: b["monto"] for b in res["banderas"]}
        self.assertAlmostEqual(montos["A"], 600.0, places=2)
        self.assertAlmostEqual(montos["B"], 400.0, places=2)

    def test_filtro_depto_no_mezcla_otras_regiones(self):
        from contratos.models import BanderaDet, EntidadDepto
        EntidadDepto.objects.create(
            departamento="Cundinamarca", nombre_entidad="Alcaldía X", total=Decimal("5000")
        )
        BanderaDet.objects.create(
            departamento="Cundinamarca", nombre_entidad="Alcaldía X", contratista_nit="A",
            contratista_nombre="Contratista A", monto=Decimal("600"), contratos=1,
        )
        servicio = ServicioContratos(modelo=Contrato)
        # Global: A = 1200/6000 = 20%, B = 400/6000 = 6,7% → nadie pasa el 30%.
        self.assertEqual(servicio.banderas_concentracion(umbral=30)["total"], 0)
        # Boyacá: el denominador se limita al departamento → 60% y 40%.
        depto = servicio.banderas_concentracion(umbral=30, depto="Boyacá")
        self.assertEqual(depto["total"], 2)
        self.assertAlmostEqual(depto["banderas"][0]["porcentaje"], 60.0, places=2)


class TestETLValorGrande(TestCase):
    """P1: valor_contrato admite max_digits=30; el ETL rechazaba >18 dígitos."""

    @pytest.mark.django_db(transaction=True)
    def test_cargar_secop_acepta_valor_de_20_digitos(self):
        from unittest.mock import Mock, patch
        from django.core.management import call_command
        from io import StringIO
        fila = {
            "id_contrato": "MOCK-BIG-001", "valor_del_contrato": "12345678901234567890",
            "fecha_de_firma": "2024-01-15T00:00:00.000", "nombre_entidad": "Alcaldía Mock",
            "nit_entidad": "900777", "departamento": "Boyacá", "ciudad": "Tunja", "orden": "1",
            "sector": "Test", "estado_contrato": "Firmado", "codigo_categoria_principal": "CAT1",
            "descripcion_del_proceso": "Valor grande", "modalidad_de_contratacion": "Licitación pública",
            "documento_proveedor": "999", "proveedor_adjudicado": "Contratista Big",
        }
        resp = Mock()
        resp.json.return_value = [fila]
        resp.raise_for_status.return_value = None
        with patch("contratos.management.commands.cargar_secop.requests.get", return_value=resp):
            call_command("cargar_secop", limit=10, offset=0, depto="Boyacá", stdout=StringIO())
        contrato = Contrato.objects.filter(id_contrato="MOCK-BIG-001").first()
        self.assertIsNotNone(contrato)
        self.assertEqual(contrato.valor_contrato, Decimal("12345678901234567890"))