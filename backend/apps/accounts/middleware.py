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
        from .models import AuditLog, User

        # Non-User principals (the connector agent — see
        # apps.integrations.authentication.ConnectorAgentUser) are
        # authenticated but have no User row for the actor FK. Log the
        # write with actor=None; the action string still records what
        # happened, and str(principal) names who.
        actor = request.user if isinstance(request.user, User) else None
        action = f"{request.method} {request.path}" + ("" if actor else f" (by {request.user})")
        AuditLog.objects.create(
            actor=actor,
            # action is varchar(100); a UUID-bearing path plus the
            # principal suffix can exceed it — truncate, never crash the
            # request that already succeeded.
            action=action[:100],
            ip_address=request.META.get("REMOTE_ADDR"),
        )
