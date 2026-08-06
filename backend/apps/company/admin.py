from django.contrib import admin

from .models import Company, GSTRegistration


class GSTRegistrationInline(admin.TabularInline):
    model = GSTRegistration
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("legal_name", "display_name", "is_active")
    inlines = [GSTRegistrationInline]
