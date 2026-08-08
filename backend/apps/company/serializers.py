from rest_framework import serializers

from .models import Company, GSTRegistration


class GSTRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GSTRegistration
        fields = [
            "id", "company", "state", "gstin", "address_line1", "address_line2",
            "city", "pincode", "is_default",
        ]
        read_only_fields = fields  # edits go through apps.governance — see apps/company/governance.py


class CompanySerializer(serializers.ModelSerializer):
    gst_registrations = GSTRegistrationSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = [
            "id", "legal_name", "display_name", "fy_start_month", "default_godown",
            "is_active", "gst_registrations",
        ]
        read_only_fields = [f for f in fields if f != "gst_registrations"]
