WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class AuditLogMiddleware:
    """Coarse-grained audit trail: logs every authenticated write request
    against the API. Fine-grained "what changed" logging for specific
    sensitive actions (credit-limit override, sync retry) is written
    explicitly by the relevant view instead, with a real diff/reason."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if (
            request.path.startswith("/api/")
            and request.method in WRITE_METHODS
            and 200 <= response.status_code < 300
            and getattr(request, "user", None)
            and request.user.is_authenticated
        ):
            self._log(request, response)
        return response

    @staticmethod
    def _log(request, response):
        from .models import AuditLog

        AuditLog.objects.create(
            actor=request.user,
            action=f"{request.method} {request.path}",
            ip_address=request.META.get("REMOTE_ADDR"),
        )
