#!/usr/bin/env bash
# Exposes the dev server on the ngrok static domain so Zalo webhooks reach it.
set -euo pipefail

host=$(grep -E '^DEV_TUNNEL_HOST=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
if [ -z "$host" ]; then
  echo "Set DEV_TUNNEL_HOST in .env.local to your ngrok static domain (e.g. xxx.ngrok-free.app)" >&2
  exit 1
fi

exec ngrok http 3000 --url="https://$host"
