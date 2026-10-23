import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contratos', '0018_contrato_idx_contrato_nitent_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='trabajocarga',
            name='usuario',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='trabajos_carga',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
