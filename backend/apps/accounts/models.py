import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from .constants import DEFAULT_ROLE_PERMISSIONS, ROLE_CHOICES


class User(AbstractUser):
    """
    Custom user model. UUID primary key so mobile-generated records
    (Invoice.agent, Trip.agent, ...) reference a stable, non-guessable ID
    consistent with every other domain model (see apps.core.models.BaseModel).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, blank=True)
    employee_code = models.CharField(max_length=50, blank=True, unique=True, null=True)
    is_field_agent = models.BooleanField(
        default=False, help_text="True for van salesmen / pre-sales agents using the mobile app."
    )
    reporting_manager = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="direct_reports"
    )

    def has_perm_code(self, code: str) -> bool:
        return UserRole.objects.filter(user=self, role__permissions__contains=[code]).exists()

    def permission_codes(self) -> set[str]:
        codes: set[str] = set()
        for role in Role.objects.filter(user_roles__user=self):
            codes.update(role.permissions)
        return codes

    def __str__(self):
        return self.get_full_name() or self.username


class Role(models.Model):
    """A named bundle of permission codes. Seeded per deployment via the
    seed_default_roles management command from DEFAULT_ROLE_PERMISSIONS,
    then editable by a Back-Office/IT Admin (AR-06 User & Role Management)."""

    name = models.CharField(max_length=50, choices=ROLE_CHOICES, unique=True)
    permissions = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.get_name_display()

    @classmethod
    def seed_defaults(cls):
        for role_name, perms in DEFAULT_ROLE_PERMISSIONS.items():
            cls.objects.update_or_create(name=role_name, defaults={"permissions": perms})


class UserRole(models.Model):
    """Assigns a Role to a User, optionally scoped to one GST registration
    (a state-level branch head, for example). Most users will have exactly
    one UserRole row."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="user_roles")
    scope_gst_registration = models.ForeignKey(
        "company.GSTRegistration", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        unique_together = ("user", "role")

    def __str__(self):
        return f"{self.user} — {self.role}"


class Device(models.Model):
    """One row per mobile device a field user has logged in on. Backs
    refresh-token revocation (lost/decommissioned device) and push
    notifications; pin_hash/biometric_enabled are informational — actual
    PIN/biometric enforcement happens on-device."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    device_id = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=20, choices=[("android", "Android"), ("ios", "iOS")])
    push_token = models.CharField(max_length=255, blank=True)
    pin_set = models.BooleanField(default=False)
    biometric_enabled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} — {self.device_id} ({self.platform})"


class SignupRequest(models.Model):
    """Self-service access request (public sign-up form on admin-web).
    Never creates a User directly — an admin/IT-head holding
    PERM_USERS_MANAGE reviews it and either approves it (creating a real
    User + assigning a Role, see AccountsViews.SignupRequestViewSet.approve)
    or rejects it. Mirrors the same "propose, someone else decides"
    shape as apps.governance's ChangeRequest, but deliberately kept
    separate: a signup request isn't editing an existing record, and the
    approver picks the password/role themselves rather than applying
    exactly what was proposed."""

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    # Free text at submission time — the requester's own pick from the same
    # ROLE_CHOICES shown elsewhere, purely informational. The approver
    # assigns the real Role FK independently (see UserRole) and isn't
    # bound by what was requested here.
    requested_role_name = models.CharField(max_length=50, choices=ROLE_CHOICES, blank=True)
    department = models.CharField(max_length=150, blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="decided_signup_requests"
    )
    created_user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}> ({self.status})"


class AuditLog(models.Model):
    """Full audit trail of transactions, edits, approvals, and sync events
    (BRD NFR: Auditability). Written by apps.accounts.middleware.AuditLogMiddleware
    for API writes, and explicitly for sensitive actions (credit override,
    sync retry) from the relevant view."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="audit_logs")
    action = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=64, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} by {self.actor} at {self.created_at:%Y-%m-%d %H:%M}"
