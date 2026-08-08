from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/schema/swagger-ui/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", include("apps.accounts.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/customers/", include("apps.customers.urls")),
    path("api/sales/", include("apps.sales.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/fleet/", include("apps.fleet.urls")),
    path("api/expenses/", include("apps.expenses.urls")),
    path("api/attendance/", include("apps.attendance.urls")),
    path("api/integrations/", include("apps.integrations.urls")),
    path("api/sync/", include("apps.mobile_sync.urls")),
    path("api/reporting/", include("apps.reporting.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
