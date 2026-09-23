"""Async gRPC bridge for TSM's OpenMI-style multi-physics exchange.

The bridge is a transport boundary. It does not manufacture engineering values
or imply that external solver executables are installed.
"""

from __future__ import annotations

import asyncio
import contextlib
import math
import re
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import grpc

from .openmi_contract import (
    ComponentInfo,
    ExchangeResponse,
    HealthRequest,
    HealthResponse,
    QuantityValueSet,
)

SERVICE_VERSION = "tsm-openmi-bridge-1.0.0"
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class ExchangeAdapter(Protocol):
    component_id: str

    async def accept(self, value_set: QuantityValueSet) -> Iterable[QuantityValueSet]:
        """Consume one validated value set and return zero or more outputs."""


@dataclass(frozen=True)
class RegisteredComponent:
    info: ComponentInfo


class ExchangeRouter:
    """Fail-closed in-process exchange router."""

    def __init__(self) -> None:
        self._components: dict[str, RegisteredComponent] = {}
        self._adapters: dict[str, ExchangeAdapter] = {}
        self._subscribers: set[asyncio.Queue[QuantityValueSet]] = set()
        self._lock = asyncio.Lock()

    @property
    def component_count(self) -> int:
        return len(self._components)

    async def register_component(self, info: ComponentInfo) -> None:
        component_id = info.component_id.strip()
        if not component_id:
            raise ValueError("component_id is required")
        async with self._lock:
            self._components[component_id] = RegisteredComponent(info=info)

    def register_adapter(self, adapter: ExchangeAdapter) -> None:
        component_id = adapter.component_id.strip()
        if not component_id:
            raise ValueError("adapter component_id is required")
        self._adapters[component_id] = adapter

    async def subscribe(self) -> asyncio.Queue[QuantityValueSet]:
        queue: asyncio.Queue[QuantityValueSet] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[QuantityValueSet]) -> None:
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, value_set: QuantityValueSet) -> None:
        _validate_value_set(value_set)

        adapter = self._adapters.get(value_set.target_component)
        if adapter is not None:
            outputs = await adapter.accept(value_set)
            for output in outputs:
                _validate_value_set(output)
                await self._fan_out(output)

        await self._fan_out(value_set)

    async def _fan_out(self, value_set: QuantityValueSet) -> None:
        for queue in tuple(self._subscribers):
            try:
                queue.put_nowait(value_set)
            except asyncio.QueueFull as exc:
                raise RuntimeError(
                    "openmi subscriber queue is full; refusing to drop evidence"
                ) from exc


def _validate_value_set(value_set: QuantityValueSet) -> None:
    required = {
        "quantity_id": value_set.quantity_id,
        "units": value_set.units,
        "timestamp": value_set.timestamp,
        "source_component": value_set.source_component,
        "model_run_id": value_set.model_run_id,
        "source_authority": value_set.source_authority,
    }
    missing = [name for name, value in required.items() if not value.strip()]
    if missing:
        raise ValueError(f"missing required exchange metadata: {', '.join(missing)}")

    if not value_set.values:
        raise ValueError("exchange item must contain at least one value")
    if any(not math.isfinite(value) for value in value_set.values):
        raise ValueError("exchange values must be finite")

    if not _SHA256_RE.fullmatch(value_set.source_provenance_hash):
        raise ValueError("source_provenance_hash must be a lowercase SHA-256 digest")

    try:
        datetime.fromisoformat(value_set.timestamp.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("timestamp must be ISO-8601") from exc

    if value_set.element_ids and len(value_set.element_ids) != len(value_set.values):
        raise ValueError("element_ids must align one-to-one with values")

    if not value_set.spatial_reference.horizontal_crs:
        raise ValueError("horizontal CRS is required")
    if not value_set.spatial_reference.vertical_datum:
        raise ValueError("vertical datum is required")


class OpenMIService:
    """gRPC service implementation with fail-closed exchange validation."""

    def __init__(self, router: ExchangeRouter | None = None) -> None:
        self.router = router or ExchangeRouter()

    async def RegisterComponent(
        self,
        request: ComponentInfo,
        context: grpc.aio.ServicerContext,
    ) -> ExchangeResponse:
        try:
            await self.router.register_component(request)
        except ValueError as exc:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exc))
        return ExchangeResponse(
            accepted=True,
            message=f"registered component {request.component_id}",
            server_time=datetime.now(timezone.utc).isoformat(),
        )

    async def Health(
        self,
        request: HealthRequest,
        context: grpc.aio.ServicerContext,
    ) -> HealthResponse:
        del request, context
        return HealthResponse(
            status="SERVING",
            service_version=SERVICE_VERSION,
            registered_components=self.router.component_count,
        )

    async def Exchange(
        self,
        request_iterator: AsyncIterator[QuantityValueSet],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[QuantityValueSet]:
        queue = await self.router.subscribe()
        reader_task = asyncio.create_task(
            self._read_requests(request_iterator, context),
            name="openmi-request-reader",
        )
        try:
            while context.is_active():
                if reader_task.done():
                    exception = reader_task.exception()
                    if exception is not None:
                        await context.abort(
                            grpc.StatusCode.INVALID_ARGUMENT,
                            str(exception),
                        )
                    if queue.empty():
                        break
                try:
                    value_set = await asyncio.wait_for(queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                yield value_set
        finally:
            reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await reader_task
            await self.router.unsubscribe(queue)

    async def _read_requests(
        self,
        request_iterator: AsyncIterator[QuantityValueSet],
        context: grpc.aio.ServicerContext,
    ) -> None:
        async for value_set in request_iterator:
            if not context.is_active():
                return
            try:
                await self.router.publish(value_set)
            except (RuntimeError, ValueError) as exc:
                await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(exc))


def add_openmi_service_to_server(
    service: OpenMIService,
    server: grpc.aio.Server,
) -> None:
    """Register the service without generated gRPC Python modules."""

    handlers = {
        "Exchange": grpc.stream_stream_rpc_method_handler(
            service.Exchange,
            request_deserializer=QuantityValueSet.FromString,
            response_serializer=QuantityValueSet.SerializeToString,
        ),
        "RegisterComponent": grpc.unary_unary_rpc_method_handler(
            service.RegisterComponent,
            request_deserializer=ComponentInfo.FromString,
            response_serializer=ExchangeResponse.SerializeToString,
        ),
        "Health": grpc.unary_unary_rpc_method_handler(
            service.Health,
            request_deserializer=HealthRequest.FromString,
            response_serializer=HealthResponse.SerializeToString,
        ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
        "tsm.openmi.v1.OpenMIService",
        handlers,
    )
    server.add_generic_rpc_handlers((generic_handler,))


async def serve(
    bind_address: str = "[::]:50061",
    *,
    router: ExchangeRouter | None = None,
) -> None:
    """Run the bridge until cancellation.

    The default listener is development-only and must not be exposed directly
    to an untrusted network. Production deployments require authenticated TLS.
    """

    server = grpc.aio.server()
    add_openmi_service_to_server(OpenMIService(router), server)
    server.add_insecure_port(bind_address)
    await server.start()
    try:
        await server.wait_for_termination()
    finally:
        await server.stop(grace=5)


if __name__ == "__main__":
    asyncio.run(serve())
