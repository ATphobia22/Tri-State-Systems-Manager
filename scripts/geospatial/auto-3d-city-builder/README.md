# Auto-3D City Builder runtime 0.2.1

This runtime is bundled with the plugin for **local execution hosts**. It is a tested offline-first LoD1 city massing generator, not a complete physical-scale, photorealistic 4D city.

## Install
```sh
cd runtime
python -m venv .venv
.venv/bin/pip install -e '.[test]'
PYTHONPATH=src .venv/bin/python -m pytest -q
PYTHONPATH=src .venv/bin/python -m citybuilder.auto profiles/sample_city.json outputs/demo
python -m http.server 8000 --directory outputs/demo
```
For Windows, use `.venv\Scripts\python.exe` / `.venv\Scripts\pip.exe`. Open http://localhost:8000/ for a browser view; browser assets currently use a pinned external CesiumJS CDN, so the browser demo is *not fully offline*.

## Real city profile
`profiles/mount_vernon_in.json` declares an approximate camera coordinate and vetted Indiana agency source URLs. Run `python -m citybuilder.auto profiles/mount_vernon_in.json outputs/mount-vernon --online-acquire` only with approved public internet. Its bounded ArcGIS acquisition uses official building footprints, then creates visual-only approximate heights. It does not download verified terrain, compute NAVD88->ellipsoid, or build citywide high-resolution photos. A live source can return different schemas; review receipts.

## Evidence and limits
- Building heights: source declared or visual-estimated, with matching source IDs and a replaceable ledger.
- Ground: relative visualization, **not georeferenced vertical truth**. The GLB floats relative to the ellipsoid unless terrain alignment is separately verified.
- Time: optional event replay in `timeline_events.json`, NOT physics or measured observations by default.
- Neural: `design_nerf_job` prepares provenance + Nerfstudio commands only; GPU training not run.
- CityGML/3DCityDB v5, road and parcel semantic layers, 3DEP DEM, FEMA/USACE hydrology, HLOD and textured photogrammetry remain future integrations; source links alone do not mean implemented.
- Never publish critical infrastructure, geocoded private address data or source photos without authorization.
