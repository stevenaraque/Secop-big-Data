from django.contrib import admin
from .models import TokenRecuperacion

# RF-23 + RF-22: auditar recuperación solo admin


@admin.register(TokenRecuperacion)
class TokenRecuperacionAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "token_corto", "expira_en", "usado", "creado_en")
    list_filter = ("usado",)
    search_fields = ("token", "usuario__email", "usuario__username")
    readonly_fields = ("token", "creado_en", "expira_en")
    ordering = ("-creado_en",)
    list_per_page = 50

    @admin.display(description="Token")
    def token_corto(self, obj):
        return f"{obj.token[:12]}..."
