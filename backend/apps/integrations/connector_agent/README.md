# ERP connector agent

Runs on the client's LAN, next to their Tally Prime / Busy / Marg
install. Zero third-party dependencies (stdlib only), so it can be
packaged as a single executable for a client's office PC:

```bash
pip install pyinstaller
pyinstaller --onefile agent.py
```

## Configuration (environment variables)

| Variable | Description |
|---|---|
| `VANSALES_API_BASE_URL` | This client's backend URL, e.g. `https://acme.vansales.app` |
| `VANSALES_CONNECTOR_KEY` | Matches `CONNECTOR_API_KEY` in the backend's `.env` for this deployment |
| `ERP_TYPE` | `tally` (default), `busy`, or `marg` |
| `TALLY_URL` | Tally only — default `http://localhost:9000` |
| `ERP_BASE_URL` | Busy/Marg only — their local sync API base URL (e.g. `http://localhost:9500`) |
| `ERP_API_KEY` | Busy/Marg only, if their local API requires one |
| `POLL_INTERVAL_SECONDS` | Default `30` |

Busy/Marg's endpoint paths and payload shape
(`apps/integrations/connectors/local_json_api.py`) are illustrative, not
verified against a specific vendor version — same caveat the Tally XML
connector's own docstring makes about ledger names needing
per-deployment adjustment. Confirm against the client's actual installed
version before relying on it in production.

## Running

```bash
python agent.py            # run continuously
python agent.py --once     # one poll cycle, for testing
```

Install as a Windows service (e.g. with NSSM) or a systemd unit for
unattended operation. The agent never needs an inbound port opened — it
only makes outbound HTTPS calls to the cloud backend and outbound HTTP
calls to the ERP on `localhost`.
