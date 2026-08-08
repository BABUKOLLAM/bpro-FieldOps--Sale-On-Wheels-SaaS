"""
Runs `migrate` against one or every active tenant's own database — the
per-tenant equivalent of redeploying a client's separate instance to pick
up new migrations, now that every tenant shares one deployment.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.tenancy.models import Tenant
from apps.tenancy.routing import activate_tenant, deactivate_tenant


class Command(BaseCommand):
    help = "Run migrations against one tenant (--slug) or every active tenant."

    def add_arguments(self, parser):
        parser.add_argument("--slug", default=None, help="Migrate only this tenant. Omit to migrate all active tenants.")

    def handle(self, *args, **options):
        slug = options["slug"]
        if slug:
            tenants = Tenant.objects.filter(slug=slug, is_active=True)
            if not tenants.exists():
                raise CommandError(f"No active tenant with slug={slug!r}.")
        else:
            tenants = Tenant.objects.filter(is_active=True)

        for tenant in tenants:
            alias = activate_tenant(tenant)
            try:
                self.stdout.write(f"Migrating {tenant.slug!r} (alias={alias})...")
                call_command("migrate", database=alias, verbosity=1)
            finally:
                deactivate_tenant()

        self.stdout.write(self.style.SUCCESS(f"Migrated {tenants.count()} tenant(s)."))
