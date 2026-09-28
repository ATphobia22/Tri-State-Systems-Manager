#!/usr/bin/env bash
# gen-cert.sh — mint a self-signed TLS certificate for the terrain tile server.
#
# This is for local/dev use. Real production deployments must terminate TLS
# with a publicly trusted certificate (e.g. Caddy or nginx + Let's Encrypt)
# in front of this server; a self-signed cert will be rejected by browsers
# fetching tiles from the app.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p certs

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
SAN="DNS:localhost,DNS:$(hostname),IP:127.0.0.1"
if [[ -n "${HOST_IP}" ]]; then SAN="$SAN,IP:$HOST_IP"; fi

openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout certs/tiles.key -out certs/tiles.crt \
  -subj "/CN=tsm-terrain-tiles" \
  -addext "subjectAltName=$SAN"
chmod 600 certs/tiles.key
echo "wrote certs/tiles.crt + certs/tiles.key (SAN: $SAN)"
