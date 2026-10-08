from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class TestRegistroSinOraculo(TestCase):
    """Fix hunter-auth/register-body-oracle:v1: misma forma 200 para existe vs nuevo."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/auth/register/"
        self.existente = "victima@example.com"
        User.objects.create_user(
            username="victima", email=self.existente, password="Password1a"
        )

    def test_forma_identica_existe_vs_nuevo(self):
        payload_existe = {
            "nombre_usuario": "otro",
            "correo": self.existente,
            "contrasena": "Password1a",
        }
        payload_nuevo = {
            "nombre_usuario": "nuevo",
            "correo": "nuevo@example.com",
            "contrasena": "Password1a",
        }
        r_existe = self.client.post(self.url, payload_existe, format="json")
        r_nuevo = self.client.post(self.url, payload_nuevo, format="json")
        self.assertEqual(r_existe.status_code, 200)
        self.assertEqual(r_nuevo.status_code, 200)
        # Misma forma: mismas claves, sin oracle por clave usuario
        self.assertEqual(set(r_existe.data.keys()), set(r_nuevo.data.keys()))
        self.assertNotIn("usuario", r_existe.data)
        self.assertNotIn("usuario", r_nuevo.data)
        self.assertEqual(r_existe.data["detalle"], r_nuevo.data["detalle"])

    def test_username_duplicado_retorna_200_generico(self):
        """P0-2: username repetido no da 500 IntegrityError, retorna 200 idéntico (sin oráculo)."""
        payload_username_existe = {
            "nombre_usuario": "victima",
            "correo": "otro_nuevo@example.com",
            "contrasena": "Password1a",
        }
        r = self.client.post(self.url, payload_username_existe, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            r.data["detalle"],
            "Si el correo no existía, cuenta creada; si ya existía, se envió notificación a tu email.",
        )
        # No se creó usuario nuevo con ese correo (username bloqueó sin revelar)
        self.assertFalse(User.objects.filter(email="otro_nuevo@example.com").exists())

    def test_correo_case_insensitive_bloquea_duplicado_y_login_ok(self):
        """P0-3: VICTIMA@X vs victima@x no duplican; login mayúsculas funciona sin 500."""
        payload_mayus = {
            "nombre_usuario": "otro2",
            "correo": "VICTIMA@EXAMPLE.COM",
            "contrasena": "Password1a",
        }
        r = self.client.post(self.url, payload_mayus, format="json")
        self.assertEqual(r.status_code, 200)
        # No crea segunda fila con distinto caso
        self.assertEqual(User.objects.filter(email__iexact=self.existente).count(), 1)
        # Login con mayúsculas entra (iexact + first, sin MultipleObjectsReturned)
        r_login = self.client.post(
            "/api/auth/login/",
            {"correo": "VICTIMA@EXAMPLE.COM", "contrasena": "Password1a"},
            format="json",
        )
        self.assertEqual(r_login.status_code, 200)
        self.assertIn("access", r_login.data)


class TestLoginThrottle(TestCase):
    """P0-4: scope login 10/min frena fuerza bruta (antes anon 200/min)."""

    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.client = APIClient()
        self.url = "/api/auth/login/"
        User.objects.create_user(
            username="bruta", email="bruta@example.com", password="Password1a"
        )

    def test_login_bloquea_al_request_11_con_429(self):
        payload_malo = {"correo": "bruta@example.com", "contrasena": "Wrong1234"}
        codigos = []
        for _ in range(11):
            r = self.client.post(self.url, payload_malo, format="json")
            codigos.append(r.status_code)
        # Primeros 10 pasan al backend (400 credenciales), el 11 lo frena DRF con 429
        self.assertEqual(codigos[:10], [400] * 10)
        self.assertEqual(codigos[10], 429)

    def test_scopes_configurados(self):
        from django.conf import settings as dj_settings
        from users.views import VistaLogin, VistaRegistro

        self.assertEqual(VistaLogin.throttle_scope, "login")
        self.assertEqual(VistaRegistro.throttle_scope, "register")
        rates = dj_settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        self.assertEqual(rates["login"], "10/min")
        self.assertEqual(rates["register"], "20/min")
