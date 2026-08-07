from django.contrib import admin

from .models import Item, ItemCategory, PriceList, PriceListItem, Scheme, SchemeSlab, UOM


@admin.register(UOM)
class UOMAdmin(admin.ModelAdmin):
    list_display = ("code", "name")


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent")


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "gst_rate", "is_active")
    search_fields = ("sku", "name", "barcode")
    list_filter = ("category", "is_active")


class PriceListItemInline(admin.TabularInline):
    model = PriceListItem
    extra = 0


@admin.register(PriceList)
class PriceListAdmin(admin.ModelAdmin):
    list_display = ("name", "is_default", "is_active")
    inlines = [PriceListItemInline]


class SchemeSlabInline(admin.TabularInline):
    model = SchemeSlab
    extra = 0


@admin.register(Scheme)
class SchemeAdmin(admin.ModelAdmin):
    list_display = ("name", "item", "category", "discount_type", "value", "valid_from", "valid_to", "is_active")
    inlines = [SchemeSlabInline]
