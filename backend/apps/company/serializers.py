from rest_framework import serializers

from .models import Company, GSTRegistration


class GSTRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GSTRegistration
        fields = ["id", "state", "gstin", "city", "is_default"]


class CompanySerializer(serializers.ModelSerializer):
    gst_registrations = GSTRegistrationSerializer(many=True, read_only=True)

    class Meta:
        model = Company
        fields = ["id", "legal_name", "display_name", "gst_registrations"]
