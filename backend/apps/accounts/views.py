from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.constants import PERM_ROLES_MANAGE, PERM_USERS_MANAGE

from .models import Device, Role, User, UserRole
from .permissions import HasRolePermission
from .serializers import (
    DeviceSerializer, LoginSerializer, RoleSerializer, UserRoleSerializer, UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def list(self, request, *args, **kwargs):
        return Response(self.get_serializer(self.get_object()).data)


class DeviceViewSet(viewsets.ModelViewSet):
    """A device registers/updates itself on login and on push-token
    refresh. Users only ever see their own devices."""

    serializer_class = DeviceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Device.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        device = self.get_object()
        device.is_active = False
        device.save(update_fields=["is_active"])
        return Response({"status": "revoked"})


class UserViewSet(viewsets.ModelViewSet):
    """AR-06 User & Role Management."""

    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_USERS_MANAGE

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        Device.objects.filter(user=user).update(is_active=False)
        return Response({"status": "deactivated"})


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_ROLES_MANAGE


class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer
    permission_classes = [HasRolePermission]
    required_permission_code = PERM_USERS_MANAGE
