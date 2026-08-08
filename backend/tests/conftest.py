from decimal import Decimal

import pytest

from apps.accounts.constants import (
    ROLE_BACK_OFFICE_ADMIN, ROLE_SALES_SUPERVISOR, ROLE_SYSTEM_IT_ADMIN, ROLE_VAN_SALESMAN,
)
from apps.accounts.models import Role, User, UserRole
from apps.catalog.models import Item, ItemCategory, UOM
from apps.company.models import Company, GSTRegistration
from apps.customers.models import Customer
from apps.inventory.models import Godown, StockLedgerEntry
from apps.inventory.services import post_stock_movement


@pytest.fixture
def company(db):
    company = Company.objects.create(legal_name="Test Distributors")
    gst = GSTRegistration.objects.create(
        company=company, state="MH", gstin="27ABCDE1234F1Z5",
        address_line1="Test Address", city="Mumbai", pincode="400001", is_default=True,
    )
    return company, gst


@pytest.fixture
def agent(db):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_VAN_SALESMAN)
    user = User.objects.create_user(username="agent@test.local", password="testpass123", is_field_agent=True)
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def supervisor(db):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_SALES_SUPERVISOR)
    user = User.objects.create_user(username="supervisor@test.local", password="testpass123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin(db):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_SYSTEM_IT_ADMIN)
    user = User.objects.create_user(username="admin@test.local", password="testpass123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def back_office_admin(db):
    Role.seed_defaults()
    role = Role.objects.get(name=ROLE_BACK_OFFICE_ADMIN)
    user = User.objects.create_user(username="boadmin@test.local", password="testpass123")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def van_godown(agent):
    return Godown.objects.create(name="Test Van", godown_type=Godown.TYPE_VAN, assigned_agent=agent)


@pytest.fixture
def item(van_godown):
    uom = UOM.objects.create(code="PCS", name="Pieces")
    category = ItemCategory.objects.create(name="Test Category")
    item = Item.objects.create(sku="SKU-TEST", name="Test Item", base_uom=uom, category=category, gst_rate=Decimal("18.00"))
    post_stock_movement(godown=van_godown, item=item, qty=Decimal("50"), txn_type=StockLedgerEntry.TXN_VAN_LOAD)
    return item


@pytest.fixture
def customer(db):
    return Customer.objects.create(code="CUST-TEST", name="Test Customer", credit_limit=Decimal("10000"), credit_days=15)
