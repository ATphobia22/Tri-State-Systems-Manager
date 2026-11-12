# TSM six-county cinematic production: verified-source pipeline

**Status: integration source and CI contracts, NOT a rendered movie or verified native Unreal scene.** This branch adds a deterministic five-minute cinematic contract, source SHA-256 verification, camera-path authoring, UE5.8 MRQ invocation and output-frame QC. The authorized UE5.8 Windows GPU runner and source-aligned cooked assets must complete the actual render.

## Official source catalog (bounded to six TSM counties)

| Jurisdiction | FIPS | Official discovery | Intake condition |
|---|---|---|---|
| Posey County, IN | 18129 | Indiana GIO, USGS 3DEP | Verify native source CRS and geoid model, don't silently relabel NAD83(HARN) as NAD83 |
| Henderson County, KY | 21101 | [KyFromAbove STAC explorer](https://kygeonet.ky.gov/catalogexplorer/) | Spatially intersect actual tile footprints, then inspect raster CRS/vertical metadata |
| Union County, KY | 21225 | [KyFromAbove STAC explorer](https://kygeonet.ky.gov/catalogexplorer/) | Same; include no Crittenden County tiles unless a documented border overlap is needed |
| White County, IL | 17193 | [ISGS LiDAR Clearinghouse](https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/) | Prefer recent verified source; select county tiles only |
| Wabash County, IL | 17185 | ISGS LiDAR Clearinghouse | Select county tiles only |
| Gallatin County, IL | 17059 | [ISGS county collection](https://clearinghouse.isgs.illinois.edu/lidar-county) | ISGS lists 2011 and 2020 surveys: **2020 LAS ~184 GB, DEM ~19.7 GB**, 2011 LAS ~11.9 GB, DEM ~2.1 GB. These are full collection sizes, not downloaded TSM assets |

The [AWS Open Data registry](https://registry.opendata.aws/kyfromabove/) documents Kentucky's public KyFromAbove COG DEMs, LAZ/COPC point clouds and EPSG:3089 5,000-foot tile grid. Its statewide collection metadata does **not** independently establish a particular Union/Henderson tile's vertical datum, vertical units, geoid or acquisition epoch. Record these per downloaded tile before any metric comparison. ISGS publication metadata likewise must be supplemented by individual dataset XML/LAS VLR/GeoTIFF inspection.

**Geodesy:** source horizontal EPSG and vertical datum are independent. Transform positions with a proven CRS operation; transform elevations only with an appropriate verified vertical grid and epoch. A unit conversion or arbitrary constant offset is not a NAVD88↔ellipsoid geoid transformation. If evidence is absent, mark the layer *vertical datum unverified* and do not publish quantitative water-surface comparisons.

## Cinematic shot plan

The contract supports 24, 30 or 60 fps and 1080p/4K, with at least 300 seconds of contiguous shots. The editor script authors real CineCameraActor transform tracks and camera cuts, but requires a real native UE map and authoritative world-space camera coordinates. Suggested 9-shot narrative, **40 seconds per shot / 360 seconds**:

1. Regional aerial opening over the Ohio–Wabash confluence
2. Six-county border relationship and Mount Vernon anchor
3. Terrain reveal: bare-earth DEM to lit topography
4. Buildings: authoritative footprints and explicitly estimated heights
5. Water: scenario visualization, **not an observed flood or regulatory BFE**
6. Timeline: 4D scenario keyframes with explicit model/time source
7. Provenance: source identity, datum, checksum and evidence state
8. Community uses: education, emergency planning, farming and infrastructure
9. Closing: free, offline-capable digital twin and human authority

Each camera key is specified in UE centimeters, not geographic degrees. Transform GIS coordinates into the actual level origin before supplying keys. A presentation-only flood animation may use stylized water, but must display `ILLUSTRATIVE / NOT A FLOOD FORECAST`; any simulated or observed hydrology requires its own verified source, units, model identifier and audit trail.

## Workflow on authorized UE5.8 Windows GPU host

1. Download only intersecting source tiles to an external TSMData cache; record source URL, county, acquisition and retrieval dates, CRS, vertical datum, geoid, units, license and SHA-256. Keep large LiDAR and COG datasets out of Git.
2. Build/import the actual DEM, footprint/GLB and 3D Tiles assets; validate placement and datum alignment in a headed Unreal Editor session. A JSON inventory does not prove the Unreal map is populated.
3. Create a `tsm.cinematic.production.v1` manifest with real relative paths, measured SHA-256, actual `/Game/TSM/Maps/TSMNative`, the LevelSequence and MRQ preset, all six county FIPS, and contiguous shot camera keys.
4. Run `python scripts/cinema/validate_cinematic_production.py --manifest ... --data-root ... --report ...`; keep the resulting immutable preflight receipt.
5. Enable the editor-only `MovieRenderPipeline`, `SequencerScripting` and `LevelSequenceEditor` plugins. In the native editor, execute `tsm-native/Content/Python/tsm_author_verified_cinematic.py` with `TSM_CINEMATIC_MANIFEST` and `TSM_CINEMATIC_PREFLIGHT` environment variables. Review saved cameras, cuts and map placement.
6. Author and save the **real** MRQ preset at `/Game/TSM/Cinematics/MRQ_TSMCommunity`, configuring full-frame PNG output to the run's `frames/` directory, sequential `frame_000000.png` filenames, and the requested output resolution. Do not infer preset existence from a name in JSON.
7. Run `scripts/cinema/Invoke-TSMVerifiedMovieRender.ps1` on the Windows host. Verify MRQ actually produced the expected PNG frames; retain Unreal logs and render receipt. Visual QC still requires human review.
8. With **both songs' distribution rights explicitly confirmed**, run `python scripts/cinema/mux_verified_mrq_movie.py --render-inventory ... --frames-dir ... --music-one ... --music-two ... --output ... --confirm-music-rights`. FFmpeg/ffprobe are required; the script verifies output video, audio, dimensions and duration.

The two user-supplied audio tracks must be present on the host as actual files; pasted playback alone is not a verified media file. Do not download commercial music or assert rights. Do not ship third-party source code without reviewing each project's license and dependencies.

## External repository adoption

- **DPIRD-DMA/Building-Regulariser:** evaluate regularization as an *optional, reviewed* preprocessing branch; preserve original government footprint IDs/geometries and source lineage.
- **PeiChiTsai/geojson-buildings-to-3dtiles:** compare output against TSM's existing GLB/3D Tiles exporter and OGC 3D Tiles validator. No replacement without correctness and license review.
- **kapase16/spongekit:** use for screening research only until rainfall/runoff assumptions and model validity are audited. It is not an authoritative HEC-RAS flood-depth source.
- **ATphobia22/TellusBuilder, WorldBuilder, LOD3_buildings, twinmotion-workflow-automation, SideFXEDU:** inspect reusable scene-generation and camera automation, but do not conflate generated assets with certified geospatial data.
- **HunyuanVideo, CogVideo, ViMax, Code2Video, Paper2Video:** optional creative/educational cutaways; never substitute AI-generated terrain, buildings or flood extents for real TSM evidence.
- **Autoware:** potentially useful architectural reference for map transforms and localization, not a hydrologic solver.
- **GTA game maps, procedural worlds and voxel engines:** only for clearly fictional visual effects, not authoritative county geography.

## Remaining production gates

**Not evidenced by this branch:** downloaded six-county DEMs; individual tile vertical metadata and true geoid transforms; complete cooked native `.umap`; actual UE5.8 editor scripting execution; completed MRQ GPU render; licensed music media; full 5+ minute 1080p/4K movie; headed screenshots and visual alignment; air-gapped Windows Shipping executable. CI verifies Python syntax and preflight behavior, not those independent runtime deliverables.
