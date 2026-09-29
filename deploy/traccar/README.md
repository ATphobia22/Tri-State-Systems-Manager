# Traccar offline sidecar

Self-hosted GPS tracking server (Apache-2.0, traccar/traccar) for the twin's
asset/sensor tracking, configured for the air-gapped deployment target.

## What it is

Traccar speaks 200+ GPS device protocols and exposes a REST API. In TSM it
runs as an offline sidecar: field devices (vehicle trackers, LoRa gateway
uplinks, phone apps using the OsmAnd protocol) report to it over the LAN, and
the twin reads positions from `http://localhost:8082/api`.

## Offline posture

- **Database:** embedded H2 (file in the `traccar-data` volume). No Postgres,
  no network dependency.
- **Geocoder:** disabled (`geocoder.enable=false`). The default calls
  LocationIQ over the internet. Use the twin's vendored Plus Codes
  (`tsm-console/src/lib/plusCodes.ts`) for offline location handles instead.
- **Tiles:** the web UI's default map tiles need the internet. For field use,
  point the twin's own MapLibre surface at the position feed instead of using
  traccar's UI.

## Run

```sh
cd deploy/traccar
docker compose up -d
```

Web UI: `http://localhost:8082` (default login `admin` / `admin` — change it
on first boot).

## Twin integration

`GET /api/positions` (basic auth or token) returns the latest device fixes.
A twin-side adapter that merges these into the telemetry fabric is future
work; the contract is the stock traccar REST API documented in
`traccar/openapi.yaml` upstream.

## License

Traccar is Apache-2.0. It runs as a separate container (service boundary);
no traccar code is vendored into the twin.
