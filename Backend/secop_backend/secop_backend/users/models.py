from django.conf import settings
from django.db import models
from django.utils import timezone


class TokenRecuperacion(models.Model):
    """RF-22: token único 30min un solo uso para recuperar contraseña. Qué: enlace único. Por qué: 30min OWASP + un solo uso."""

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tokens_recuperacion"
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    expira_en = models.DateTimeField()
    usado = models.BooleanField(default=False)

    class Meta:
        db_table = "token_recuperacion"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["expira_en"], name="idx_token_expira"),
        ]

    def __str__(self):
        return f"Token {self.token[:8]}... para {self.usuario_id} usado={self.usado}"

    def esta_expirado(self):
        return timezone.now() > self.expira_en

    def esta_valido(self):
        return not self.usado and not self.esta_expirado()
