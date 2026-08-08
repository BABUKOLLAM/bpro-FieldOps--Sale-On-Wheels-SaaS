import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY is not set — required to store payment gateway credentials. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


class PaymentGatewayConnection(BaseModel):
    """
    UPI/card collection (BRD Section 18) — gateway-ready scaffolding, same
    single-active-row-per-deployment shape as
    apps.integrations.models.ERPConnection. GATEWAY_MOCK is the default
    and stays fully inert: apps.payments.services never makes an external
    network call or moves any money unless a deployment operator has
    explicitly configured a real gateway's credentials here. This
    codebase never does that itself — going live is an operator action,
    not something this build performs.
    """

    GATEWAY_MOCK = "mock"
    GATEWAY_RAZORPAY = "razorpay"
    GATEWAY_TYPE_CHOICES = [
        (GATEWAY_MOCK, "Mock (no real gateway configured — safe default)"),
        (GATEWAY_RAZORPAY, "Razorpay"),
    ]

    gateway_type = models.CharField(max_length=20, choices=GATEWAY_TYPE_CHOICES, default=GATEWAY_MOCK)
    is_active = models.BooleanField(default=True)
    _credentials_encrypted = models.TextField(blank=True, db_column="credentials_encrypted")

    def __str__(self):
        return self.get_gateway_type_display()

    @property
    def credentials(self) -> dict:
        if not self._credentials_encrypted:
            return {}
        try:
            return json.loads(_fernet().decrypt(self._credentials_encrypted.encode()).decode())
        except InvalidToken:
            return {}

    @credentials.setter
    def credentials(self, value: dict):
        self._credentials_encrypted = _fernet().encrypt(json.dumps(value).encode()).decode()


class PaymentOrder(BaseModel):
    """One payment-collection attempt against an invoice. Created inert
    (STATUS_CREATED) — only a verified gateway webhook
    (apps.payments.services.verify_and_record_payment) ever moves it to
    STATUS_PAID, and only after HMAC-verifying the gateway's own
    signature. This model records that a payment happened; it never
    causes one."""

    STATUS_CREATED = "created"
    STATUS_PAID = "paid"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [(STATUS_CREATED, "Created"), (STATUS_PAID, "Paid"), (STATUS_FAILED, "Failed")]

    invoice = models.ForeignKey("sales.Invoice", on_delete=models.CASCADE, related_name="payment_orders")
    gateway_type = models.CharField(max_length=20)
    gateway_order_id = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_CREATED)
    receipt = models.ForeignKey(
        "sales.Receipt", null=True, blank=True, on_delete=models.SET_NULL, related_name="payment_order",
    )

    def __str__(self):
        return f"{self.gateway_order_id or self.id} — {self.invoice} — {self.get_status_display()}"
