from io import BytesIO
from unittest.mock import Mock

from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer, AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext
from fastavro import schemaless_reader, schemaless_writer
import pytest

from twin import consumer
from twin.contracts import AVRO, AVRO_TEXT, InvalidEvent, decode, encode, stream_key
from twin.observability import Circuit
from twin.settings import INGRESS


def test_avro_and_confluent_envelope_roundtrip(event):
    payload = BytesIO()
    schemaless_writer(payload, AVRO, encode(event))
    assert decode(schemaless_reader(BytesIO(payload.getvalue()), AVRO)) == event
    registry = SchemaRegistryClient.new_client({"url": "mock://tests"})
    ctx = SerializationContext(INGRESS, MessageField.VALUE)
    framed = AvroSerializer(registry, AVRO_TEXT)(encode(event), ctx)
    assert framed[0] == 0 and int.from_bytes(framed[1:5], "big") > 0
    assert decode(AvroDeserializer(registry, AVRO_TEXT)(framed, ctx)) == event


@pytest.mark.parametrize("changes", [
    {"branch": "other"}, {"valid_from": "2026-01-01T00:00:00"},
    {"state": {"temperature": float("nan")}}, {"operation": "retire"},
    {"asset": {"href": "http://example.org/a", "media_type": "image/tiff", "sha256": "0" * 64}},
])
def test_invalid_contract(event, changes):
    with pytest.raises(InvalidEvent):
        encode({**event, **changes})


def test_circuit_reopens_at_cooldown():
    now = [0]
    circuit = Circuit("test", threshold=2, cooldown=3, clock=lambda: now[0])
    circuit.fail()
    assert circuit.ready()
    circuit.fail()
    assert not circuit.ready()
    now[0] = 3
    assert circuit.ready()
    circuit.success()
    assert circuit.failures == 0


def test_offsets_follow_database_and_dlq_ack(event, monkeypatch):
    client, wire, message, outgoing = (Mock() for _ in range(4))
    client.commit.return_value = []
    message.value.return_value = b"avro"
    message.key.return_value = stream_key(event)
    message.topic.return_value = INGRESS
    message.partition.return_value = 0
    message.offset.return_value = 1
    wire.unpack.return_value = event
    writes = Mock(side_effect=TimeoutError("db"))
    monkeypatch.setattr(consumer, "apply", writes)
    with pytest.raises(TimeoutError):
        consumer.process_message(client, message, wire, outgoing)
    client.commit.assert_not_called()
    writes.side_effect = None
    writes.return_value = (1, False)
    assert consumer.process_message(client, message, wire, outgoing) == "duplicate"
    client.commit.assert_called_once_with(message=message, asynchronous=False)
    client.reset_mock()
    message.key.return_value = b"wrong"
    send = Mock(side_effect=TimeoutError("dlq"))
    monkeypatch.setattr(consumer, "send", send)
    with pytest.raises(TimeoutError):
        consumer.process_message(client, message, wire, outgoing)
    client.commit.assert_not_called()
    send.side_effect = None
    assert consumer.process_message(client, message, wire, outgoing) == "dead_letter"
    client.commit.assert_called_once()
