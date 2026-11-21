import hashlib
import json
import logging
import time

from confluent_kafka import Consumer, KafkaError, KafkaException
from confluent_kafka.serialization import SerializationError
from prometheus_client import start_http_server

from .contracts import InvalidEvent, stream_key
from .kafka import Wire, producer, send
from .observability import Circuit, INGEST, LATENCY, incoming_trace, setup
from .settings import DEAD, INGRESS, KAFKA
from .store import apply


def handle(message, wire, producer_client):
    payload = message.value()
    try:
        if payload is None:
            raise InvalidEvent("Kafka null values are not state events")
        event = wire.unpack(payload, INGRESS)
        if message.key() != stream_key(event):
            raise InvalidEvent("Kafka key does not match the state identity")
        _, inserted = apply(event)
    except (ValueError, SerializationError, EOFError) as error:
        # Publish only metadata. Source data remains on the original ingress topic.
        failure = {
            "version": 1, "topic": message.topic(), "partition": message.partition(),
            "offset": message.offset(), "sha256": hashlib.sha256(payload or b"").hexdigest(),
            "reason": str(error) if isinstance(error, InvalidEvent) else "Invalid Avro value",
        }
        identity = f"{failure['topic']}:{failure['partition']}:{failure['offset']}".encode()
        send(producer_client, DEAD, identity, json.dumps(failure).encode())
        return "dead_letter"
    return "applied" if inserted else "duplicate"


def process_message(client, message, wire, producer_client):
    result = handle(message, wire, producer_client)
    offsets = client.commit(message=message, asynchronous=False)
    if any(partition.error for partition in offsets):
        raise RuntimeError("Kafka offset was not committed")
    return result


def run():
    tracer = setup("living-twin-consumer")
    start_http_server(9101)
    client = Consumer({
        "bootstrap.servers": KAFKA, "group.id": "tsm-living-twin-ingress-v1",
        "enable.auto.commit": False, "enable.auto.offset.store": False,
        "auto.offset.reset": "earliest", "max.poll.interval.ms": 300000,
    })
    wire, outgoing = Wire(), producer()
    circuit = Circuit("ingress")
    client.subscribe([INGRESS])
    try:
        while True:
            message = client.poll(1)
            if message is None:
                continue
            if message.error():
                if message.error().code() == KafkaError._PARTITION_EOF:
                    continue
                raise KafkaException(message.error())
            for attempt in range(6):
                while not circuit.ready():
                    time.sleep(0.5)
                try:
                    with tracer.start_as_current_span(
                        "twin.consume", context=incoming_trace(message.headers())
                    ) as span, LATENCY.time():
                        span.set_attribute("messaging.destination.name", INGRESS)
                        outcome = process_message(client, message, wire, outgoing)
                    circuit.success()
                    INGEST.labels(outcome).inc()
                    break
                except Exception as error:
                    circuit.fail()
                    INGEST.labels("retry").inc()
                    logging.warning("Ingress transient failure (%s)", type(error).__name__)
                    if attempt == 5:
                        raise
                    time.sleep(min(2 ** attempt, 12))
    finally:
        client.close()


if __name__ == "__main__":
    run()
