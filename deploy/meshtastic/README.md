# Meshtastic off-grid sensor backhaul

LoRa mesh networking for field sensors where there is no cell coverage
(GPL-3.0, meshtastic/firmware). This is the air-gapped telemetry path: solar
sensor nodes form a mesh, a USB radio on the gateway host bridges packets
into the local MQTT broker, and the twin subscribes.

## Architecture

```
[field sensor nodes] --LoRa mesh--> [USB radio] --serial--> [meshtasticd]
    --> [mosquitto, LAN-only] --MQTT--> [twin telemetry adapter]
```

## License boundary (important)

Meshtastic firmware is **GPL-3.0**. It is used strictly as a hardware
appliance and a separate containerized daemon — a service boundary. No
Meshtastic code is vendored into, linked against, or copied into the twin.
Integration happens only across the documented boundaries:

- meshtasticd's local HTTP API / serial protobuf interface
- MQTT topics on the LAN-only broker

## Run

```sh
cd deploy/meshtastic
# plug in the USB LoRa radio first; adjust the device node if needed
docker compose up -d
```

Configure the radio's MQTT uplink to the `mqtt` service (host `mqtt`,
port 1883) via the Meshtastic app or CLI, with encryption and channel
settings matching the field nodes.

## Twin integration

A twin-side MQTT subscriber that decodes `msh/2/json/...` telemetry packets
into the telemetry fabric is future work. Until then, `mosquitto_sub` against
`localhost:1883` shows the live packet stream for verification.
