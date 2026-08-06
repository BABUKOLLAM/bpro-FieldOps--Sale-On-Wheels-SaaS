from django.core.management.base import BaseCommand

from apps.accounts.models import Role


class Command(BaseCommand):
    help = "Seed/refresh the 7 default roles and their permission codes for this deployment."

    def handle(self, *args, **options):
        Role.seed_defaults()
        self.stdout.write(self.style.SUCCESS(f"Seeded {Role.objects.count()} roles."))
