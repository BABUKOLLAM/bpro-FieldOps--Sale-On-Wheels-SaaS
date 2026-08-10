"""Reusable tenant-provisioning logic, shared by the provision_tenant
management command and the self-service platform API
(apps.tenancy.views.TenantListCreateView). A self-service HTTP endpoint
must never accept db_name/db_host/db_port/db_user/db_password from the
caller — only slug/name — so provision_tenant() defaults every
connection detail from the control DB's own account and derives db_name
from the (validated) slug; the optional override kwargs exist only for
the CLI's existing --db-* flags, which the web view never wires up."""

import re

import psycopg2
from django.conf import settings
from django.core.management import call_command
from django.db import connection as control_connection
from psycopg2 import sql

from apps.accounts.models import Role

from .models import Tenant
from .routing import activate_tenant, deactivate_tenant

SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9-]{1,62}$")
RESERVED_SLUGS = {
    "www", "api", "admin", "platform", "app", "default", "control", "backend", "static", "media", "tenant",
}


class ProvisioningError(Exception):
    """Raised for any tenant-provisioning failure with a caller-safe
    message — a self-service API can return str(exc) directly without
    ever leaking an internal traceback."""


def validate_slug(slug: str) -> str:
    slug = (slug or "").strip().lower()
    if not SLUG_PATTERN.match(slug):
        raise ProvisioningError(
            "Slug must be 2-63 characters, start with a letter, and contain only lowercase letters, digits, and hyphens."
        )
    if slug in RESERVED_SLUGS:
        raise ProvisioningError(f"'{slug}' is a reserved word and can't be used as a tenant slug.")
    if Tenant.objects.filter(slug=slug).exists():
        raise ProvisioningError(f"A tenant with slug '{slug}' already exists.")
    return slug


def _create_database(host, port, user, password, db_name):
    # CREATE DATABASE can't run inside a transaction block, hence the raw
    # psycopg2 connection with autocommit rather than Django's own
    # connection wrapper. db_name reaches the SQL only via
    # psycopg2.sql.Identifier, never string interpolation.
    conn = psycopg2.connect(
        host=host, port=port, user=user, password=password, dbname=control_connection.settings_dict["NAME"],
    )
    conn.autocommit = True
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
            if cursor.fetchone():
                raise ProvisioningError(f"Database '{db_name}' already exists.")
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
    finally:
        conn.close()


def provision_tenant(
    slug: str, name: str, *,
    db_name: str | None = None, db_host: str | None = None, db_port: int | None = None,
    db_user: str | None = None, db_password: str | None = None,
) -> Tenant:
    """Creates the Tenant registry row, creates its Postgres database,
    migrates it, and seeds default roles. Synchronous — matches the
    already-verified behaviour of the provision_tenant management command
    this function was extracted from; a deployment provisioning many
    tenants per day would want to move this onto a background task
    queue, but every existing/new caller here already expects a
    blocking call that returns once the tenant is ready."""
    slug = validate_slug(slug)
    name = (name or "").strip()
    if not name:
        raise ProvisioningError("A tenant name is required.")

    control_settings = settings.DATABASES["default"]
    db_name = db_name or f"vansales_tenant_{slug}"
    db_host = db_host or control_settings["HOST"]
    db_port = db_port or int(control_settings["PORT"])
    db_user = db_user or control_settings["USER"]
    db_password = db_password if db_password is not None else control_settings["PASSWORD"]

    _create_database(db_host, db_port, db_user, db_password, db_name)

    tenant = Tenant(slug=slug, name=name, db_name=db_name, db_host=db_host, db_port=db_port, db_user=db_user)
    tenant.db_password = db_password
    tenant.save()

    alias = activate_tenant(tenant)
    try:
        call_command("migrate", database=alias, verbosity=0)
        Role.seed_defaults()
    finally:
        deactivate_tenant()

    return tenant
