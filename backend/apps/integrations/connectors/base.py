"""
Connector interface — the contract every ERP backend (Tally, Busy, Marg,
and the mock used for local dev/demo) implements. Deliberately dependency-
free (no Django imports) so the same module can be vendored into the
standalone on-prem connector_agent process without pulling in Django.

A connector's job is narrow and "dumb" on purpose: build/send one voucher,
report the result. All retry policy, deduplication, and status tracking
lives centrally in apps.integrations.models.SyncLogEntry — see
apps.integrations.tasks for the orchestration that calls these methods.
"""
from abc import ABC, abstractmethod


class ConnectorError(Exception):
    """Raised when a push/pull to the ERP backend fails. The message is
    stored verbatim on SyncLogEntry.error_message for the Sync Monitor."""


class BaseConnector(ABC):
    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    def pull_masters(self) -> dict:
        """Fetch master data (items, ledgers/customers, godowns, price
        lists, GST config) from the ERP. Returns a dict keyed by entity
        type, e.g. {"items": [...], "customers": [...]}."""

    @abstractmethod
    def push_voucher(self, entity_type: str, payload: dict) -> str:
        """Push one transaction (invoice/receipt/credit_note/stock_journal)
        to the ERP. Returns the ERP's reference id (e.g. Tally voucher
        GUID) on success, or raises ConnectorError on failure."""

    @abstractmethod
    def check_status(self, erp_reference_id: str) -> dict:
        """Look up a previously-pushed voucher's status in the ERP, for
        reconciliation. Returns a small status dict."""
