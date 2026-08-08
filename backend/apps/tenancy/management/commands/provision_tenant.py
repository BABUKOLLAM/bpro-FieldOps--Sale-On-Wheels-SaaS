"""
Provisions a new client: creates the Tenant registry row, creates their
Postgres database, migrates it, and seeds default roles — reusing
apps.accounts.models.Role.seed_defaults(), the same idempotent seeding
mechanism every other tenant-style setup in this codebase already uses
(management command, test fixtures, seed_demo_data).

This replaces "spin up a whole separate deployment for this client" with
"run one command" — the actual application code, and every migration, is
shared across every tenant; only the data is separate.
"""
import psycopg2
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection as control_connection
from psycopg2 import sql

from apps.accounts.models import Role
from apps.tenancy.models import Tenant
from apps.tenancy.routing import activate_tenant, deactivate_tenant


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
        slug = options["slug"].strip().lower()
        if Tenant.objects.filter(slug=slug).exists():
            raise CommandError(f"A tenant with slug={slug!r} already exists.")

        control_settings = settings.DATABASES["default"]
        db_name = options["db_name"] or f"vansales_tenant_{slug}"
        db_host = options["db_host"] or control_settings["HOST"]
        db_port = options["db_port"] or int(control_settings["PORT"])
        db_user = options["db_user"] or control_settings["USER"]
        db_password = options["db_password"] or control_settings["PASSWORD"]

        self.stdout.write(f"Creating database {db_name!r} on {db_host}:{db_port}...")
        self._create_database(db_host, db_port, db_user, db_password, db_name)

        tenant = Tenant(slug=slug, name=options["name"], db_name=db_name, db_host=db_host, db_port=db_port, db_user=db_user)
        tenant.db_password = db_password
        tenant.save()

        alias = activate_tenant(tenant)
        try:
            self.stdout.write(f"Migrating tenant database (alias={alias})...")
            call_command("migrate", database=alias, verbosity=1)

            self.stdout.write("Seeding default roles...")
            Role.seed_defaults()
        finally:
            deactivate_tenant()

        self.stdout.write(self.style.SUCCESS(f"Tenant {slug!r} provisioned: {tenant.name} -> {db_name}@{db_host}"))

    def _create_database(self, host, port, user, password, db_name):
        # CREATE DATABASE can't run inside a transaction block, hence the
        # raw psycopg2 connection with autocommit rather than Django's own
        # connection wrapper. Connects to the control DB's own server
        # (same Postgres instance, different database) using the control
        # DB's own credentials — the same account that already owns the
        # "default" database in local/dev setups.
        conn = psycopg2.connect(
            host=host, port=port, user=user, password=password, dbname=control_connection.settings_dict["NAME"],
        )
        conn.autocommit = True
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
                if cursor.fetchone():
                    raise CommandError(f"Database {db_name!r} already exists.")
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
        finally:
            conn.close()
