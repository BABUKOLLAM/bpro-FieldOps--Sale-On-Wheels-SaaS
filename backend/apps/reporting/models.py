from django.db import models

from apps.core.models import BaseModel


class Target(BaseModel):
    """AR-07 Target vs. Achievement Tracking — a sales or collection target
    for an agent (optionally scoped to a beat) over a period."""

    METRIC_SALES = "sales"
    METRIC_COLLECTIONS = "collections"
    METRIC_CHOICES = [(METRIC_SALES, "Sales"), (METRIC_COLLECTIONS, "Collections")]

    agent = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="targets")
    beat = models.ForeignKey("customers.Beat", null=True, blank=True, on_delete=models.SET_NULL, related_name="targets")
    metric = models.CharField(max_length=20, choices=METRIC_CHOICES)
    period_start = models.DateField()
    period_end = models.DateField()
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.agent} — {self.metric} {self.period_start}..{self.period_end}: {self.target_amount}"
