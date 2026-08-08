"""
Shared base for Busy and Marg (BRD Section 11.2): unlike Tally's XML/HTTP
interface, recent versions of both expose a local REST/JSON sync API on
the same LAN as the accounting install. Same dependency-free (stdlib-only)
constraint as tally_xml.py, for the same reason — this module runs inside
the standalone on-prem connector_agent, which never has Django available.

The exact endpoint paths and payload field names below are illustrative,
not verified against a specific Busy/Marg version — same caveat
tally_xml.py's own docstring makes about ledger names needing
per-deployment adjustment. Treat this as the integration shape (auth,
retry-free single-POST-per-voucher, JSON in/out) to wire up against
whichever API version the client's install actually exposes, not a
drop-in-and-done implementation.
"""
import json
import urllib.error
import urllib.request

from .base import BaseConnector, ConnectorError

_VOUCHER_TYPE_BY_ENTITY = {
    "invoice": "sales",
    "receipt": "receipt",
    "credit_note": "credit_note",
}


class LocalJSONAPIConnector(BaseConnector):
    """Common HTTP plumbing: JSON POST/GET to a locally configured base
    URL with an API-key header. Subclasses (BusyConnector, MargConnector)
    supply the endpoint paths and payload shape — the two vendors' local
    APIs differ in field naming, not in this request/response mechanics."""

    default_base_url = ""
    push_endpoint = "/api/vouchers"
    status_endpoint = "/api/vouchers/{reference}"
    masters_endpoint = "/api/masters"

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        base_url = self.config.get("base_url", self.default_base_url)
        if not base_url:
            raise ConnectorError(f"No base_url configured for {type(self).__name__}.")
        url = base_url.rstrip("/") + path
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"}
        api_key = self.config.get("api_key", "")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.config.get("timeout_seconds", 15)) as response:
                raw = response.read().decode("utf-8", errors="replace")
                return json.loads(raw) if raw else {}
        except (urllib.error.URLError, TimeoutError) as exc:
            raise ConnectorError(f"Could not reach {type(self).__name__} at {url}: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise ConnectorError(f"{type(self).__name__} returned non-JSON response: {exc}") from exc

    def _voucher_payload(self, entity_type: str, payload: dict) -> dict:
        voucher_type = _VOUCHER_TYPE_BY_ENTITY.get(entity_type)
        if not voucher_type:
            raise ConnectorError(f"No voucher mapping for entity_type={entity_type!r}")
        return {
            "voucher_type": voucher_type,
            "reference": payload["id"],
            "date": payload["date"],
            "party": payload["party_ledger"],
            "amount": payload["amount"],
            "lines": [
                {"item": line["item_sku"], "qty": line["qty"], "amount": line["amount"]}
                for line in payload.get("lines", [])
            ],
        }

    def pull_masters(self) -> dict:
        response = self._request("GET", self.masters_endpoint)
        # As with Tally, the normalized {"items": [...], "customers": [...]}
        # shape depends on how this client's install names/exposes its
        # master data — left as a documented extension point.
        return {"raw_response": response}

    def push_voucher(self, entity_type: str, payload: dict) -> str:
        body = self._voucher_payload(entity_type, payload)
        response = self._request("POST", self.push_endpoint, body)
        if response.get("status") == "error":
            raise ConnectorError(
                f"{type(self).__name__} rejected {entity_type} {payload.get('id')}: "
                f"{response.get('message', response)}"
            )
        return response.get("voucher_id") or payload["id"]

    def check_status(self, erp_reference_id: str) -> dict:
        response = self._request("GET", self.status_endpoint.format(reference=erp_reference_id))
        return {"reference": erp_reference_id, "status": response.get("status", "unknown")}


class BusyConnector(LocalJSONAPIConnector):
    default_base_url = "http://localhost:9500"


class MargConnector(LocalJSONAPIConnector):
    default_base_url = "http://localhost:9600"
