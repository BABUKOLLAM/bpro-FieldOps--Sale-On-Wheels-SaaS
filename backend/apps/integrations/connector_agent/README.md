# Tally connector agent

Runs on the client's LAN, next to their Tally Prime install. Zero
third-party dependencies (stdlib only), so it can be packaged as a single
executable for a client's office PC:

```bash
pip install pyinstaller
pyinstaller --onefile agent.py
```

## Configuration (environment variables)

| Variable | Description |
|---|---|
| `VANSALES_API_BASE_URL` | This client's backend URL, e.g. `https://acme.vansales.app` |
| `VANSALES_CONNECTOR_KEY` | Matches `CONNECTOR_API_KEY` in the backend's `.env` for this deployment |
| `TALLY_URL` | Default `http://localhost:9000` |
| `POLL_INTERVAL_SECONDS` | Default `30` |

## Running

```bash
python agent.py            # run continuously
python agent.py --once     # one poll cycle, for testing
```

Install as a Windows service (e.g. with NSSM) or a systemd unit for
unattended operation. The agent never needs an inbound port opened — it
only makes outbound HTTPS calls to the cloud backend and outbound HTTP
calls to Tally on `localhost`.
