import os

DATABASE = os.getenv("DATABASE_URL", "postgresql://twin:twin@localhost:5432/twin")
KAFKA = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:19092")
REGISTRY = os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:18081")
INGRESS = "tsm.twin.state-update.v1"
CHANGE = "tsm.twin.state-change.v1"
DEAD = "tsm.twin.dead-letter.v1"
COLLECTION = "tsm-twin-assets"
