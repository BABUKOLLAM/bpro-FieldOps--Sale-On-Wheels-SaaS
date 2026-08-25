#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-}"
API_URL="${API_URL:-}"

if [[ -z "$APP_URL" || -z "$API_URL" ]]; then
  echo "APP_URL and API_URL are required; set real https URLs before running health checks." >&2
  exit 1
fi

for url in "$APP_URL" "$API_URL"; do
  echo "Checking $url"
  curl -fsSL --max-time 15 "$url" >/dev/null
  echo "OK: $url"
done

echo "Health checks passed."
