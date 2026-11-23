"""Standalone lean read-only TSM PostGIS service for hybrid/self-hosted deployment.

The full companion API additionally mounts the same router. This process needs
only FastAPI, psycopg2 and a reviewed PostGIS migration.
"""
from fastapi import FastAPI
from backend.api.v1.regional_twin import router

app = FastAPI(title="TSM Regional Twin Read API", version="0.1.0",
              description="Evidence-gated geospatial read API; no agency decisions")
app.include_router(router)
