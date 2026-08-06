from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from apps.sales.models import Invoice, Receipt

from .models import Target


class TargetSerializer(serializers.ModelSerializer):
    achieved_amount = serializers.SerializerMethodField()

    class Meta:
        model = Target
        fields = ["id", "agent", "beat", "metric", "period_start", "period_end", "target_amount", "achieved_amount"]

    def get_achieved_amount(self, obj: Target):
        if obj.metric == Target.METRIC_SALES:
            total = Invoice.objects.filter(
                agent=obj.agent, invoice_date__gte=obj.period_start, invoice_date__lte=obj.period_end,
            ).aggregate(total=Sum("grand_total"))["total"]
        else:
            total = Receipt.objects.filter(
                agent=obj.agent, received_at__date__gte=obj.period_start, received_at__date__lte=obj.period_end,
            ).aggregate(total=Sum("amount"))["total"]
        return total or Decimal("0")
