"""TSM twin-service stub. Soft-label only."""
from fastapi import FastAPI

app = FastAPI(title="TSM twin-service", version="0.1.0")

@app.get("/health")
def health():
    return {"service": "twin-service", "status": "ok", "blocks_system": False}

@app.get("/api/twins")
def list_twins():
    return {"twins": [], "labels": []}
