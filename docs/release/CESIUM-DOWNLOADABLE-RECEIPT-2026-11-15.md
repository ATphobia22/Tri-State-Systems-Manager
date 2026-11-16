# Cesium release receipt and public byte verification

The TSM Pages workflow stages a release using pinned source inputs, verifies the local Cesium scene, runs headed rendering checks, then produces an immutable SHA-256 inventory for the **actual built static files**.

The stdlib-only script scripts/release/cesium_published_receipt.py provides three commands:

- create --dist DIR --base-url HTTPS_URL --git-sha FULL_40_HEX --run-id POSITIVE_ID
- verify-local --dist DIR --expected-git-sha FULL_40_HEX
- verify-published --base-url HTTPS_URL --expected-receipt-sha 64_HEX --expected-git-sha FULL_40_HEX --output NEW_FILE.json

create refuses missing critical Cesium files, unsafe paths and symlinks; it hashes every static file in the final dist folder with per-file byte lengths, full immutable Git commit and workflow run ID. It writes cesium-release-receipt.json, and the SHA-256 of that JSON into cesium-release-receipt.json.sha256. The two receipt files are excluded from the content inventory to avoid circular hashing. verify-local recomputes **all** local file hashes after receipt generation.

The workflow uploads both files as a distinct downloadable GitHub Actions artifact, plus the original dist release. Their planned **public download paths after a successful Pages main deployment** are:

- https://atphobia22.github.io/Tri-State-Systems-Manager/cesium-release-receipt.json
- https://atphobia22.github.io/Tri-State-Systems-Manager/cesium-release-receipt.json.sha256

The deploy job pins the expected receipt hash via the build job's workflow output. It then fetches the public receipt, sidecar and seven representative published Cesium files, compares their actual bytes with the build manifest, and uploads a separate publication-check artifact. This is sampling, **not an exhaustive remote download of every file**. The release receipt binds all local bytes; the deployment check proves actual remote correspondence for its named samples. No remote publication is claimed until the deploy job passes.

A SHA-256 receipt is not a digital signature, not proof of authoritative content, and not scientific or regulatory acceptance. Posey 23,082-height coverage and Windows 11 UE5.8 native offline Shipping remain separate gates.

For authoritative upstream geospatial and visual checks, see scripts/geospatial/verify_cesium_regional_scene.py and skills/ogc-3d-tiles-release/SKILL.md.
