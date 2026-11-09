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
        ('company', '0003_company_upi_vpa'),
        ('customers', '0002_beattemplate_beattemplatestop'),
        ('fleet', '0003_geofence_vehicledocument'),
        ('inventory', '0001_initial'),
        ('sales', '0004_ewaybillsettings_ewaybill'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='creditnote',
            index=models.Index(fields=['agent', 'note_date'], name='sales_cnote_agent_date_idx'),
        ),
        AddIndexConcurrently(
            model_name='invoice',
            index=models.Index(fields=['agent', 'invoice_date'], name='sales_invoice_agent_date_idx'),
        ),
        AddIndexConcurrently(
            model_name='receipt',
            index=models.Index(fields=['agent', 'received_at'], name='sales_receipt_agent_recv_idx'),
        ),
        AddIndexConcurrently(
            model_name='salesorder',
            index=models.Index(fields=['agent', 'order_date'], name='sales_order_agent_date_idx'),
        ),
    ]
