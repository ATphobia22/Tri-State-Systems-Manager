# TSM native UE5.8 Shipping execution request

Requested UTC: 2026-11-10
Requested source baseline: 896636ff0eca3c1e8c2496fc7543e787fa483875
Purpose: one-shot authorized build, cook, stage, package and sign on self-hosted Windows x64 UE5.8 GitHub Actions runner.
Required outputs: TSMNative.umap, packaged Shipping Win64 executable, signed Windows installer, BuildCookRun transcript, staged data integrity results, release manifest, SHA-256 and SBOM.
External archive: private Google Drive output folder 1qc7cSiAplGakgBwrjwiFQ4yNy9TV7gwF, if runner is configured with rclone credential.
Evidence protocol: do not record Shipping PASS without actual artifact and successful toolchain logs. Do not record clean-host offline PASS until independently executed on a network-disabled Windows 11 x64 host with HUD and terrain/tiles screenshots.
Source data: do not upgrade DEM EPSG:2968 with unverified vertical datum to engineering-grade EPSG:2966/NAVD88 automatically.
