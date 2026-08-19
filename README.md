# Tri-State Systems Manager (TuckerInc.82)

Sovereign public-interest intelligence & engineering platform for the Tri-State River Valley  
Centered on **13101 Bonebank Road, Point Township, Posey County, Indiana**

## Mission

Technology informs people; it does not silently govern people.  
Human authority remains final.

## Architecture (ADR-005)

Four-plane full-stack system:

1. **Evidence & Data Governance** — USGS/NOAA/GIO/FEMA ingestion, SHA-256, fail-closed
2. **Scientific & Simulation** — versioned models, explicit CRS/datum, uncertainty
3. **Governance & Decision** — jurisdiction policies, human gates, AI model cards
4. **Public Experience / Visualization** — React console (first client)

## Quick start

```bash
cd tsm-console
npm install
npm run proxy    # API :8787
npm run dev      # SPA :5173
```

## Key paths

- `tsm-console/` — React Router v7 client + server API
- `tsm-authority-registry-v35.json` — verified hydrologic nodes & sources
- `tsm-evidence-artifact-schema-v1.0.0.json` — EvidenceArtifact contract
- `TSM-ADR-005-*.docx` — architecture decision record

## License

Apache-2.0 (intended). DCO for contributions.
