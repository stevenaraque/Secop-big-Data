from django.contrib import admin
from .models import TokenRecuperacion

# RF-23 + RF-22: auditar recuperación solo admin


@admin.register(TokenRecuperacion)
class TokenRecuperacionAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "token_corto", "expira_en", "usado", "creado_en")
    list_filter = ("usado",)
    # SECOP-U1: sin búsqueda por token (ahora hash, buscarlo expone material). Solo usuario.
    search_fields = ("usuario__email", "usuario__username")
    readonly_fields = ("token", "creado_en", "expira_en")
    ordering = ("-creado_en",)
    list_per_page = 50

    @admin.display(description="Token (hash)")
    def token_corto(self, obj):
        return f"hash:{obj.token[:8]}..."
