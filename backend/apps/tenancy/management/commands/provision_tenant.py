"""
Provisions a new client: creates the Tenant registry row, creates their
Postgres database, migrates it, and seeds default roles. Thin CLI wrapper
around apps.tenancy.provisioning.provision_tenant() — the same function
the self-service platform API uses — so the two never drift apart.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.tenancy.provisioning import ProvisioningError, provision_tenant


class Command(BaseCommand):
    help = "Provision a new tenant: create its database, migrate it, and seed default roles."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="Subdomain slug, e.g. 'acme'.")
        parser.add_argument("name", help="Display name, e.g. 'Acme Distributors'.")
        parser.add_argument("--db-name", help="Defaults to 'vansales_tenant_<slug>'.")
        parser.add_argument("--db-host", default=None, help="Defaults to the control DB's own host.")
        parser.add_argument("--db-port", type=int, default=None, help="Defaults to the control DB's own port.")
        parser.add_argument("--db-user", default=None, help="Defaults to the control DB's own user.")
        parser.add_argument("--db-password", default=None, help="Defaults to the control DB's own password.")

    def handle(self, *args, **options):
        try:
            tenant = provision_tenant(
                options["slug"], options["name"],
                db_name=options["db_name"], db_host=options["db_host"], db_port=options["db_port"],
                db_user=options["db_user"], db_password=options["db_password"],
            )
        except ProvisioningError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS(
            f"Tenant {tenant.slug!r} provisioned: {tenant.name} -> {tenant.db_name}@{tenant.db_host}"
        ))
