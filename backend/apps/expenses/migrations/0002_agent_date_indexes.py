"""(agent, <date>) indexes for agent-scoped From–To list filtering.

Built with CREATE INDEX CONCURRENTLY (AddIndexConcurrently), so Postgres
takes only a SHARE UPDATE EXCLUSIVE lock: reads and writes (mobile sync,
billing) continue while each index builds; only other DDL/VACUUM on the
same table waits. CONCURRENTLY cannot run inside a transaction, hence
atomic = False. If a build is interrupted Postgres leaves an INVALID
index of this name — drop it (DROP INDEX CONCURRENTLY <name>) and re-run
migrate. Purely additive: no table rewrite, no data change.
"""

from django.conf import settings
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('expenses', '0001_initial'),
        ('fleet', '0003_geofence_vehicledocument'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='expense',
            index=models.Index(fields=['agent', 'expense_date'], name='expense_agent_date_idx'),
        ),
    ]
