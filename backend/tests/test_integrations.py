import json
from io import BytesIO
from unittest.mock import patch

import pytest

from apps.integrations.connectors.base import ConnectorError
from apps.integrations.connectors.local_json_api import BusyConnector, MargConnector
from apps.integrations.models import ERPConnection
from apps.integrations.tasks import _CONNECTOR_CLASSES

SAMPLE_PAYLOAD = {
    "id": "inv-123",
    "date": "2026-01-15",
    "party_ledger": "Test Customer",
    "amount": "1180.00",
    "lines": [{"item_sku": "SKU-1", "qty": "2", "amount": "1000.00"}],
}


def test_connector_dispatch_includes_busy_and_marg():
    assert _CONNECTOR_CLASSES[ERPConnection.ERP_BUSY] is BusyConnector
    assert _CONNECTOR_CLASSES[ERPConnection.ERP_MARG] is MargConnector


def test_local_json_api_connector_requires_base_url():
    connector = BusyConnector({"base_url": ""})
    with pytest.raises(ConnectorError, match="No base_url configured"):
        connector.push_voucher("invoice", SAMPLE_PAYLOAD)


def test_local_json_api_connector_rejects_unknown_entity_type():
    connector = BusyConnector({"base_url": "http://localhost:9500"})
    with pytest.raises(ConnectorError, match="No voucher mapping"):
        connector.push_voucher("unknown_type", SAMPLE_PAYLOAD)


class _FakeResponse:
    def __init__(self, body: dict):
        self._body = json.dumps(body).encode()

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@patch("apps.integrations.connectors.local_json_api.urllib.request.urlopen")
def test_busy_connector_push_voucher_success(mock_urlopen):
    mock_urlopen.return_value = _FakeResponse({"status": "ok", "voucher_id": "BUSY-VCH-001"})
    connector = BusyConnector({"base_url": "http://localhost:9500", "api_key": "test-key"})

    result = connector.push_voucher("invoice", SAMPLE_PAYLOAD)

    assert result == "BUSY-VCH-001"
    sent_request = mock_urlopen.call_args[0][0]
    assert sent_request.full_url == "http://localhost:9500/api/vouchers"
    assert sent_request.get_header("Authorization") == "Bearer test-key"
    sent_body = json.loads(sent_request.data)
    assert sent_body["reference"] == "inv-123"
    assert sent_body["voucher_type"] == "sales"


@patch("apps.integrations.connectors.local_json_api.urllib.request.urlopen")
def test_marg_connector_push_voucher_error_response_raises(mock_urlopen):
    mock_urlopen.return_value = _FakeResponse({"status": "error", "message": "Duplicate reference"})
    connector = MargConnector({"base_url": "http://localhost:9600"})

    with pytest.raises(ConnectorError, match="Duplicate reference"):
        connector.push_voucher("invoice", SAMPLE_PAYLOAD)


@patch("apps.integrations.connectors.local_json_api.urllib.request.urlopen")
def test_busy_connector_check_status(mock_urlopen):
    mock_urlopen.return_value = _FakeResponse({"status": "posted"})
    connector = BusyConnector({"base_url": "http://localhost:9500"})

    result = connector.check_status("BUSY-VCH-001")
    assert result == {"reference": "BUSY-VCH-001", "status": "posted"}
