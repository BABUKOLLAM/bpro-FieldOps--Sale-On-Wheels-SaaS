from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Liveness + dependency probe for load balancers, container
    healthchecks, and uptime monitors. Unauthenticated by design —
    it leaks nothing beyond up/down status per dependency, and a
    health check that needs credentials can't be used by
    docker-compose/nginx probes. Returns 200 only when both the
    database and the cache (Redis in production) respond.
    """
    checks = {}
    healthy = True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        healthy = False

    try:
        cache.set("healthz", "ok", timeout=5)
        checks["cache"] = "ok" if cache.get("healthz") == "ok" else "error"
        if checks["cache"] != "ok":
            healthy = False
    except Exception:
        checks["cache"] = "error"
        healthy = False

    return JsonResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status=200 if healthy else 503,
    )
