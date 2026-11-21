import os
import time

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import Counter, Gauge, Histogram

INGEST = Counter("twin_ingest_events", "Kafka ingestion outcomes", ["outcome"])
DELIVERY = Counter("twin_outbox_delivery", "Outbox delivery outcomes", ["destination", "outcome"])
BACKLOG = Gauge("twin_outbox_pending", "Undelivered transactional outbox records", ["destination"])
REFRESH = Counter("twin_materialized_refresh", "Snapshot refresh outcomes", ["outcome"])
LATENCY = Histogram("twin_ingest_seconds", "Consumer decode and database write time")
CIRCUIT = Gauge("twin_circuit_open", "Dependency circuit status", ["dependency"])


def setup(service):
    if os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
        provider = TracerProvider(resource=Resource.create({"service.name": service}))
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)
    return trace.get_tracer("tsm.living_twin")


class Circuit:
    def __init__(self, name, threshold=3, cooldown=15, clock=time.monotonic):
        self.name = name
        self.threshold = threshold
        self.cooldown = cooldown
        self.clock = clock
        self.failures = 0
        self.reopen_at = 0

    def ready(self):
        return self.clock() >= self.reopen_at

    def success(self):
        self.failures = 0
        self.reopen_at = 0
        CIRCUIT.labels(self.name).set(0)

    def fail(self):
        self.failures += 1
        if self.failures >= self.threshold:
            self.reopen_at = self.clock() + self.cooldown
            CIRCUIT.labels(self.name).set(1)
