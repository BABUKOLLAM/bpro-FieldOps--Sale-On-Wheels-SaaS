#!/usr/bin/env python3
"""
On-prem Tally connector agent (BRD Section 11.1) — see docs/architecture.md
for the full "why an on-prem agent" rationale. Runs on the same LAN as
Tally Prime, polls the cloud backend for pending sync jobs (outbound-only,
so nothing needs to be opened on the client's firewall), posts each one to
Tally's local XML/HTTP interface, and reports the result back.

Zero third-party dependencies by design — this is meant to be simple
enough to package as a single-file Windows service (e.g. via PyInstaller)
and run unattended on a client's office PC. Only imports stdlib and the
dependency-free apps.integrations.connectors modules.

Usage:
    VANSALES_API_BASE_URL=https://acme.vansales.app \
    VANSALES_CONNECTOR_KEY=... \
    TALLY_URL=http://localhost:9000 \
    python agent.py

    python agent.py --once   # process one poll cycle and exit (for testing)
"""
import argparse
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))  # backend/

from apps.integrations.connectors.base import ConnectorError  # noqa: E402
from apps.integrations.connectors.tally_xml import TallyXMLConnector  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("connector_agent")


class AgentConfig:
    def __init__(self):
        self.api_base_url = os.environ.get("VANSALES_API_BASE_URL", "http://localhost:8000").rstrip("/")
        self.connector_key = os.environ.get("VANSALES_CONNECTOR_KEY", "")
        self.tally_url = os.environ.get("TALLY_URL", "http://localhost:9000")
        self.poll_interval_seconds = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))

        if not self.connector_key:
            raise SystemExit("VANSALES_CONNECTOR_KEY is required.")


def _request(config: AgentConfig, method: str, path: str, body: dict | None = None) -> dict:
    url = f"{config.api_base_url}{path}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url, data=data, method=method,
        headers={"X-Connector-Key": config.connector_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read()
        return json.loads(raw) if raw else {}


def fetch_pending_jobs(config: AgentConfig) -> list[dict]:
    response = _request(config, "GET", "/api/integrations/connector/jobs/")
    return response.get("results", response) if isinstance(response, dict) else response


def report_result(config: AgentConfig, job_id: str, status: str, **extra):
    _request(config, "POST", f"/api/integrations/connector/jobs/{job_id}/result/", {"status": status, **extra})


def process_job(config: AgentConfig, job: dict, connector: TallyXMLConnector):
    entity_type = job["entity_type"]
    payload = job["request_payload"]
    try:
        erp_reference_id = connector.push_voucher(entity_type, payload)
    except ConnectorError as exc:
        logger.warning("Job %s failed: %s", job["id"], exc)
        report_result(config, job["id"], "failed", error_message=str(exc))
        return
    logger.info("Job %s posted to Tally as %s", job["id"], erp_reference_id)
    report_result(config, job["id"], "acknowledged", erp_reference_id=erp_reference_id)


def run_once(config: AgentConfig) -> int:
    connector = TallyXMLConnector({"tally_url": config.tally_url})
    try:
        jobs = fetch_pending_jobs(config)
    except urllib.error.URLError as exc:
        logger.error("Could not reach cloud backend at %s: %s", config.api_base_url, exc)
        return 0

    for job in jobs:
        process_job(config, job, connector)
    return len(jobs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Process one poll cycle and exit.")
    args = parser.parse_args()

    config = AgentConfig()
    logger.info("Connector agent starting — cloud=%s tally=%s", config.api_base_url, config.tally_url)

    if args.once:
        n = run_once(config)
        logger.info("Processed %d job(s).", n)
        return

    while True:
        run_once(config)
        time.sleep(config.poll_interval_seconds)


if __name__ == "__main__":
    main()
