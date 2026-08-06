import logging

from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class DomainError(Exception):
    """Raised for business-rule violations (e.g. credit limit breach) that
    should surface as a clean 4xx API error rather than a 500."""

    def __init__(self, message: str, code: str = "domain_error"):
        self.message = message
        self.code = code
        super().__init__(message)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if isinstance(exc, DomainError):
        from rest_framework.response import Response

        return Response({"detail": exc.message, "code": exc.code}, status=400)

    if response is None:
        logger.exception("Unhandled exception in %s", context.get("view"))

    return response
