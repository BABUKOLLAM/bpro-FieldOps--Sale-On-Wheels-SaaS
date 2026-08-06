from rest_framework.permissions import BasePermission


class HasRolePermission(BasePermission):
    """
    DRF permission class enforcing the BRD's role-based access control.

    Usage on a viewset:
        permission_classes = [HasRolePermission]
        required_permission_code = "sales.invoice.create"
        # or, per-method:
        required_permission_codes = {"create": "sales.invoice.create", "list": "sales.view_own"}

    This is action-level enforcement only. Object-level scoping (a Van
    Salesman only ever sees their own invoices/trips) is applied separately
    in each viewset's get_queryset().
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        codes_by_action = getattr(view, "required_permission_codes", None)
        if codes_by_action:
            code = codes_by_action.get(getattr(view, "action", None))
            if code is None:
                return True
            return code in request.user.permission_codes()

        code = getattr(view, "required_permission_code", None)
        if code is None:
            return True
        return code in request.user.permission_codes()
