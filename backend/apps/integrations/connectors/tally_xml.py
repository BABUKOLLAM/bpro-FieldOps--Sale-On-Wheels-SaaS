"""
Real Tally Prime connector (BRD Section 11.1): talks to Tally's XML/HTTP
interface, normally exposed at http://localhost:9000 on the same LAN as
Tally itself. This module is intentionally dependency-free (stdlib only —
urllib, not requests) so it can be imported unmodified by the standalone
on-prem connector_agent (see apps/integrations/connector_agent/agent.py),
which is what actually executes push_voucher() — Tally is never reachable
directly from the cloud backend. See docs/architecture.md for the full
"why an on-prem agent" rationale.

XML templates below are deliberately minimal, illustrative Tally XML
envelopes — a real deployment will need to extend the ledger/voucher XML
with the specific ledger names, cost centres, and GST classification
configured in that client's Tally company.
"""
import urllib.error
import urllib.request
from xml.sax.saxutils import escape

from .base import BaseConnector, ConnectorError

DEFAULT_TALLY_URL = "http://localhost:9000"

_VOUCHER_TYPE_BY_ENTITY = {
    "invoice": "Sales",
    "receipt": "Receipt",
    "credit_note": "Credit Note",
}


def _envelope(body: str) -> str:
    return f"""<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
   <REQUESTDATA>{body}</REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>"""


def build_voucher_xml(entity_type: str, payload: dict) -> str:
    """Builds the Tally XML voucher for an invoice/receipt/credit_note
    payload. `payload` is the same JSON shape apps.integrations.tasks
    serializes from the Django model (see SyncLogEntry.request_payload)."""
    voucher_type = _VOUCHER_TYPE_BY_ENTITY.get(entity_type)
    if not voucher_type:
        raise ConnectorError(f"No Tally voucher mapping for entity_type={entity_type!r}")

    ref = escape(str(payload["id"]))
    date = escape(payload["date"].replace("-", ""))  # Tally expects YYYYMMDD
    party_ledger = escape(payload["party_ledger"])
    amount = payload["amount"]

    line_xml = ""
    for line in payload.get("lines", []):
        line_xml += f"""
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>{escape(line['item_sku'])}</LEDGERNAME>
      <AMOUNT>-{line['amount']}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>"""

    body = f"""
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="{escape(voucher_type)}" ACTION="Create">
      <DATE>{date}</DATE>
      <NARRATION>vansales-saas ref {ref}</NARRATION>
      <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
      <PARTYLEDGERNAME>{party_ledger}</PARTYLEDGERNAME>
      <REFERENCE>{ref}</REFERENCE>
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>{party_ledger}</LEDGERNAME>
       <AMOUNT>{amount}</AMOUNT>
      </LEDGERENTRIES.LIST>{line_xml}
     </VOUCHER>
    </TALLYMESSAGE>"""

    return _envelope(body)


def build_master_export_request(report_name: str = "List of Accounts") -> str:
    """XML request to pull master data (ledgers/stock items/godowns) from
    Tally — used by the connector agent's scheduled master-pull."""
    return f"""<ENVELOPE>
 <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>{escape(report_name)}</REPORTNAME>
    <STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>"""


class TallyXMLConnector(BaseConnector):
    def _post(self, xml_payload: str) -> str:
        url = self.config.get("tally_url", DEFAULT_TALLY_URL)
        request = urllib.request.Request(
            url, data=xml_payload.encode("utf-8"), headers={"Content-Type": "text/xml"}, method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.config.get("timeout_seconds", 15)) as response:
                return response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            raise ConnectorError(f"Could not reach Tally at {url}: {exc}") from exc

    def pull_masters(self) -> dict:
        response_xml = self._post(build_master_export_request())
        # A real implementation parses response_xml (ElementTree) into the
        # normalized {"items": [...], "customers": [...]} shape. Left as a
        # documented extension point — the response format depends on the
        # exact Tally version/report configuration at the client site.
        return {"raw_response": response_xml}

    def push_voucher(self, entity_type: str, payload: dict) -> str:
        xml_payload = build_voucher_xml(entity_type, payload)
        response_xml = self._post(xml_payload)
        if "<LINEERROR>" in response_xml or "<CREATED>0</CREATED>" in response_xml:
            raise ConnectorError(f"Tally rejected {entity_type} {payload.get('id')}: {response_xml[:500]}")
        # Tally's Import Data response doesn't return a stable GUID by
        # default; VCHGUIDs must be fetched with a follow-up Export Data
        # request keyed by REFERENCE if the client's Tally setup requires
        # a persisted GUID mapping. For MVP we treat "no LINEERROR" as
        # success and store our own REFERENCE as the reconciliation key.
        return payload["id"]

    def check_status(self, erp_reference_id: str) -> dict:
        return {"reference": erp_reference_id, "status": "unknown", "note": "Tally has no async status API; reconciled via REFERENCE match on next export."}
