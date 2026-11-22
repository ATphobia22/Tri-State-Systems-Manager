"""Kafka contracts, registry bootstrapping and acknowledge-before-commit helpers."""
import time

from confluent_kafka import KafkaException, Producer
from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka.schema_registry import Schema, SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer, AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext

from .contracts import AVRO_TEXT, decode, encode, stream_key
from .observability import trace_headers
from .settings import CHANGE, DEAD, INGRESS, KAFKA, REGISTRY


def registry():
    return SchemaRegistryClient({"url": REGISTRY, "timeout": 5, "max.retries": 1})


class Wire:
    def __init__(self):
        client = registry()
        self.serializer = AvroSerializer(client, AVRO_TEXT, conf={"auto.register.schemas": False})
        self.deserializer = AvroDeserializer(client, AVRO_TEXT)

    def pack(self, event, topic):
        return self.serializer(encode(event), SerializationContext(topic, MessageField.VALUE))

    def unpack(self, payload, topic):
        return decode(self.deserializer(payload, SerializationContext(topic, MessageField.VALUE)))


def producer():
    return Producer({"bootstrap.servers": KAFKA, "enable.idempotence": True,
                     "message.timeout.ms": 5000, "acks": "all"})


def send(producer_client, topic, key, payload, headers=None):
    outcomes = []
    producer_client.produce(topic, key=key, value=payload, headers={**(headers or {}), **trace_headers()},
                            on_delivery=lambda error, _message: outcomes.append(error))
    if producer_client.flush(7) or not outcomes:
        raise TimeoutError("Kafka delivery acknowledgment timed out")
    if outcomes[0]:
        raise KafkaException(outcomes[0])


def publish(event, topic=INGRESS):
    send(producer(), topic, stream_key(event), Wire().pack(event, topic))


def bootstrap():
    client = registry()
    admin = AdminClient({"bootstrap.servers": KAFKA})
    topics = [INGRESS, CHANGE, DEAD]
    metadata = admin.list_topics(timeout=6)
    missing = [NewTopic(topic, 1, 1) for topic in topics if topic not in metadata.topics]
    if missing:
        for future in admin.create_topics(missing, request_timeout=8).values():
            future.result()
    metadata = admin.list_topics(timeout=6)
    if len(metadata.topics[INGRESS].partitions) != 1:
        raise RuntimeError("v1 ingress requires one partition for causal evidence ordering")
    for topic in (INGRESS, CHANGE):
        subject = f"{topic}-value"
        client.set_compatibility(subject_name=subject, level="FULL_TRANSITIVE")
        client.register_schema(subject, Schema(AVRO_TEXT, "AVRO"))


if __name__ == "__main__":
    for attempt in range(15):
        try:
            bootstrap()
            break
        except Exception:
            if attempt == 14:
                raise
            time.sleep(2)
