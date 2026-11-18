# Unreal Engine 5.6 terminology → TSM public web capability crosswalk

**Scope:** public GitHub Pages `/platform` route, review dated 2026-11-18.

## Basis

A user-supplied 59-page Unreal 5.6 index lists Editor, Developer, Runtime and Plugin Index modules. This is a **terminology inventory** rather than executable plugin source or proof of compiled features. The public crosswalk curates ten selected terms, connects them to real TSM code locations, and links the applicable Epic documentation. The full uploaded PDF is not redistributed.

- Source taxonomy: Unreal 5.6 Editor / Developer / Runtime / Plugin modules.
- Target native branch: Windows UE 5.8; version-specific compatibility must be independently reviewed and compiled.
- Web host: GitHub Pages static HTML/CSS/JavaScript; the page cannot execute Unreal Editor modules, Windows binaries, commandlets, native SQLite, or Movie Render Queue.
- Quality states: `WEB_PRESENTATION`, `SOURCE_BOUND_PARTIAL`, `NATIVE_NOT_VERIFIED`, `TOOLCHAIN_ONLY`.
- Boundaries: `EDITOR_PIPELINE`, `NATIVE_RUNTIME`, `DEVELOPER_TEST`, `PUBLIC_WEB_ANALOG`.

## Reuse and distinctions

| UE source area | Web reuse | Unresolved gate |
| --- | --- | --- |
| World Partition / HLOD | Publish verified GLB/3D Tiles for browser rendering | Complete building identities, source heights, native HLOD receipt |
| GeoReferencing | Show and validate CRS/datum provenance | Vertical accuracy and surveyed control |
| Landscape / Virtual Heightfield Mesh | Source-bound terrain display and hillshade | Full AOI coverage, nodata and geoid lineage |
| Sequencer / LevelSequence | MapLibre camera paths and guided tours | Native cinematic shot and actual render evidence |
| Movie Render Queue | Publish separately verified movie products, never pretend to render in Pages | Headed Windows build/MRQ receipts and input hashes |
| Niagara / Volumetrics | Optional aesthetic mist and lighting | No equivalence to measured rain or modeled flood results |
| UMG / Common UI | Browser React controls; collapsible menus | Native HUD interaction and packaged acceptance |
| SQLite | Static published manifests; native offline data store separate | Clean offline native startup and snapshot validation |
| Gauntlet | Cypress for public browser acceptance | Native runtime tests and GPU instrumentation |
| Data Layer Editor | Browser opt-in published GIS layer toggles | Unreal authoring process and release evidence |

## Acceptance and deployment

The crosswalk is public, anonymous, searchable, keyboard-operable, and collapsible by item. It introduces no secrets, network calls, privileged actions or changes to scientific results. The source data is compiled into the UI; official documentation links are navigational only.

Tests: `node --experimental-strip-types --test tsm-console/tests/unreal-web-bridge.test.mjs`; source and type checks are governed by existing TSM CI. Browser production deploy is separate from the native Windows Shipping build.

**Non-claims:** this is not a UE WebAssembly runtime, agency approval, surveyed terrain, complete 23,082-source building census, completed 3D Tiles integrity check, or measured hydraulic simulation. Human Authority Final.

## Canonical references

- [Unreal Engine module types](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-editor-modules-for-customizing-the-editor-in-unreal-engine)
- [UE World Partition / HLOD](https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---hierarchical-level-of-detail-in-unreal-engine)
- [UE Movie Render Pipeline](https://dev.epicgames.com/documentation/en-us/unreal-engine/movie-render-pipeline-in-unreal-engine)
- [GitHub Pages static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
