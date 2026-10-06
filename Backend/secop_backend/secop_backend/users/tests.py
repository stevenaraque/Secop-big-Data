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
