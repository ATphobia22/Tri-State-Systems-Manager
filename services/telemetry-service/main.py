"""TSM telemetry-service stub. Soft-label only. USGS/NOAA remain primary live path."""
from fastapi import FastAPI

app = FastAPI(title="TSM telemetry-service", version="0.1.0")

@app.get("/health")
def health():
    return {"service": "telemetry-service", "status": "ok", "blocks_system": False}

@app.get("/api/telemetry")
def telemetry():
    return {"stream": "delegate-to-existing-usgs-noaa", "labels": []}
