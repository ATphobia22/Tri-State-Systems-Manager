import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import make_asgi_app

from twin.observability import setup

from .routers import assets, buildings, geospatial, hydrology, terrain, twin

app = FastAPI(title="TSM Twin State API", version="1")
setup("living-twin-state-api")
FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CESIUM_ORIGINS", "").split(","),
                   allow_methods=["GET"])
app.mount("/metrics", make_asgi_app())
for module in (assets, buildings, geospatial, hydrology, terrain, twin):
    app.include_router(module.router)
