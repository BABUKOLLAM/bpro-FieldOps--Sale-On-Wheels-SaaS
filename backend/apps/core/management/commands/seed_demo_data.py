from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.constants import ROLE_SYSTEM_IT_ADMIN, ROLE_VAN_SALESMAN
from apps.accounts.models import Role, User, UserRole
from apps.catalog.models import Item, ItemCategory, PriceList, PriceListItem, UOM
from apps.company.models import Company, GSTRegistration
from apps.customers.models import Beat, BeatCustomer, Customer, CustomerCategory
from apps.fleet.models import Vehicle
from apps.integrations.models import ERPConnection
from apps.inventory.models import Godown, StockLedgerEntry
from apps.inventory.services import post_stock_movement


class Command(BaseCommand):
    help = "Seed a working demo deployment: company, roles, users, catalog, customers, a beat, and opening van stock."

    @transaction.atomic
    def handle(self, *args, **options):
        Role.seed_defaults()
        self.stdout.write(self.style.SUCCESS(f"Seeded {Role.objects.count()} roles."))

        company, _ = Company.objects.get_or_create(
            legal_name="Demo Distributors Pvt Ltd", defaults={"display_name": "Demo Distributors"}
        )
        gst_registration, _ = GSTRegistration.objects.get_or_create(
            gstin="27ABCDE1234F1Z5",
            defaults=dict(
                company=company, state="MH", address_line1="Plot 12, MIDC Industrial Area",
                city="Mumbai", pincode="400001", is_default=True,
            ),
        )

        ERPConnection.objects.get_or_create(
            erp_type=ERPConnection.ERP_MOCK, defaults={"sync_mode": ERPConnection.SYNC_BATCH, "batch_interval_minutes": 30}
        )

        admin_role = Role.objects.get(name=ROLE_SYSTEM_IT_ADMIN)
        van_salesman_role = Role.objects.get(name=ROLE_VAN_SALESMAN)

        admin_user, created = User.objects.get_or_create(
            username="admin@demo.local",
            defaults=dict(email="admin@demo.local", first_name="Demo", last_name="Admin", is_staff=True, is_superuser=True),
        )
        if created:
            admin_user.set_password("DemoPass123!")
            admin_user.save()
        UserRole.objects.get_or_create(user=admin_user, role=admin_role)

        agent_user, created = User.objects.get_or_create(
            username="agent@demo.local",
            defaults=dict(
                email="agent@demo.local", first_name="Ravi", last_name="Kumar",
                employee_code="EMP001", is_field_agent=True,
            ),
        )
        if created:
            agent_user.set_password("DemoPass123!")
            agent_user.save()
        UserRole.objects.get_or_create(user=agent_user, role=van_salesman_role)

        warehouse, _ = Godown.objects.get_or_create(name="Main Warehouse", godown_type=Godown.TYPE_WAREHOUSE)
        van_godown, _ = Godown.objects.get_or_create(
            name="Van — Ravi Kumar", godown_type=Godown.TYPE_VAN, assigned_agent=agent_user
        )
        if not company.default_godown_id:
            company.default_godown = warehouse
            company.save(update_fields=["default_godown"])

        Vehicle.objects.get_or_create(reg_no="MH-04-AB-1234", defaults={"vehicle_type": "Tempo", "assigned_agent": agent_user})

        uom, _ = UOM.objects.get_or_create(code="PCS", defaults={"name": "Pieces"})
        category, _ = ItemCategory.objects.get_or_create(name="Beverages")

        items_data = [
            ("SKU-001", "Cola 500ml", "18.00", Decimal("20.00")),
            ("SKU-002", "Orange Soda 500ml", "18.00", Decimal("18.00")),
            ("SKU-003", "Packaged Water 1L", "12.00", Decimal("15.00")),
            ("SKU-004", "Energy Drink 250ml", "28.00", Decimal("45.00")),
            ("SKU-005", "Juice Tetra Pack 200ml", "12.00", Decimal("22.00")),
        ]
        price_list, _ = PriceList.objects.get_or_create(name="Standard Price List", defaults={"is_default": True})

        items = []
        for sku, name, gst_rate, rate in items_data:
            item, _ = Item.objects.get_or_create(
                sku=sku, defaults=dict(name=name, category=category, base_uom=uom, hsn_code="2202", gst_rate=Decimal(gst_rate)),
            )
            items.append(item)
            PriceListItem.objects.get_or_create(price_list=price_list, item=item, defaults={"rate": rate})
            existing_stock = StockLedgerEntry.objects.filter(godown=van_godown, item=item).exists()
            if not existing_stock:
                post_stock_movement(
                    godown=van_godown, item=item, qty=Decimal("100"), txn_type=StockLedgerEntry.TXN_VAN_LOAD,
                )

        retail_category, _ = CustomerCategory.objects.get_or_create(name="Retail Outlet")
        customers_data = [
            ("CUST-001", "Sharma General Store", "27ABCDX1234F1Z1", Decimal("25000")),
            ("CUST-002", "City Mart", "27ABCDX5678F1Z2", Decimal("50000")),
            ("CUST-003", "Green Valley Supermarket", "27ABCDX9012F1Z3", Decimal("75000")),
        ]
        customers = []
        for code, name, gstin, credit_limit in customers_data:
            customer, _ = Customer.objects.get_or_create(
                code=code,
                defaults=dict(name=name, gstin=gstin, category=retail_category, credit_limit=credit_limit, credit_days=15),
            )
            customers.append(customer)

        beat, _ = Beat.objects.get_or_create(name="Route 1 — Andheri", assigned_agent=agent_user)
        for i, customer in enumerate(customers):
            BeatCustomer.objects.get_or_create(beat=beat, customer=customer, defaults={"visit_sequence": i + 1})

        self.stdout.write(self.style.SUCCESS(
            "\nDemo deployment ready.\n"
            "  Admin login:  admin@demo.local / DemoPass123!\n"
            "  Agent login:  agent@demo.local / DemoPass123!\n"
            f"  Company: {company} | GST: {gst_registration.gstin}\n"
            f"  {len(items)} items, {len(customers)} customers, 1 beat, van stock loaded.\n"
        ))
