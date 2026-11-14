"""TSM asset-service stub. Soft-label only. Never fail-closed."""
from fastapi import FastAPI

app = FastAPI(title="TSM asset-service", version="0.1.0")

@app.get("/health")
def health():
    return {"service": "asset-service", "status": "ok", "blocks_system": False}

@app.get("/api/assets")
def list_assets():
    return {"assets": [], "labels": []}
