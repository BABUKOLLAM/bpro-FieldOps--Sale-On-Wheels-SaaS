from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import EntityExportView, EntityImportView, EntityListView, EntityTemplateView, ImportJobViewSet

router = DefaultRouter()
router.register("jobs", ImportJobViewSet, basename="dataio-job")

urlpatterns = [
    path("entities/", EntityListView.as_view(), name="dataio-entities"),
    path("entities/<slug:slug>/template/", EntityTemplateView.as_view(), name="dataio-template"),
    path("entities/<slug:slug>/export/", EntityExportView.as_view(), name="dataio-export"),
    path("entities/<slug:slug>/import/", EntityImportView.as_view(), name="dataio-import"),
] + router.urls
