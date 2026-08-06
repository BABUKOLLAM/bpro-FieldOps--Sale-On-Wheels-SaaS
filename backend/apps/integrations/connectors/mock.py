"""
Mock connector: simulates a real ERP backend's latency and occasional
failure so the full sync -> retry -> Sync Monitor loop is demonstrable
without a real Tally/Busy/Marg instance. Used as the default ERPConnection
for local dev and the demo tenant.
"""
import random
import time
import uuid

from .base import BaseConnector, ConnectorError


class MockConnector(BaseConnector):
    # Deterministic-ish failure rate so a demo reliably shows a failed ->
    # retried -> synced transition without being flaky in either direction.
    FAILURE_RATE = 0.2
    SIMULATED_LATENCY_SECONDS = 0.3

    def pull_masters(self) -> dict:
        time.sleep(self.SIMULATED_LATENCY_SECONDS)
        return {"items": [], "customers": []}

    def push_voucher(self, entity_type: str, payload: dict) -> str:
        time.sleep(self.SIMULATED_LATENCY_SECONDS)
        if random.random() < self.FAILURE_RATE:
            raise ConnectorError(
                f"Mock connector simulated failure posting {entity_type} "
                f"{payload.get('id')} (this is expected sometimes — retry will succeed)."
            )
        return f"MOCK-{entity_type.upper()}-{uuid.uuid4().hex[:12]}"

    def check_status(self, erp_reference_id: str) -> dict:
        return {"reference": erp_reference_id, "status": "posted"}
