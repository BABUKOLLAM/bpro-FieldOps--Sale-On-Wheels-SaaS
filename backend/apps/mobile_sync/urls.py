from django.urls import path

from .views import PullView, PushView

urlpatterns = [
    path("pull/", PullView.as_view(), name="sync-pull"),
    path("push/", PushView.as_view(), name="sync-push"),
]
