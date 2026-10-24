# Apple Developer Forums findings applied to TSM

**Research date:** 2026-10-24  
**Scope:** Apple platform integration patterns relevant to TSM's read-only Shortcuts workflow and context-only field waypoints.  
**Evidence rule:** Apple documentation defines supported APIs. Apple Developer Forums are useful for implementation caveats, but individual reports are not universal platform guarantees.

## Findings and decisions

### 1. Prefer task-level App Intents for a future native TSM app

An Apple DTS response recommends App Intents when an app should expose its own actions in Shortcuts, rather than expecting the app to appear automatically as a target in a generic “Share with App” action. A share extension and an App Intent serve different integration paths.

**TSM decision:** Keep the existing iPhone Shortcut as a user-configured GET-only recipe because this repository does not currently establish a shipped native iOS target. If a native app is introduced, prototype task-level intents such as **Get Hydrology Snapshot** and **Open Evidence Record**. Keep each intent read-only unless a separately reviewed authorization contract exists. Do not add an App Intents extension or claim system-level discoverability without an actual Apple-platform target and device testing.

Source: [Apple Developer Forums — App intent vs. Share with App](https://developer.apple.com/forums/thread/809924); [Apple App Intents documentation](https://developer.apple.com/documentation/appintents/app-intents.md).

### 2. Treat compass heading as a quality-qualified observation

Apple DTS guidance on Core Location heading emphasizes comparing the same north reference, configuring device heading orientation before updates, checking `headingAccuracy`, and selecting an activity type appropriate to the movement context. The forum thread describes a safety-critical paragliding use case; its specific `.airborne` recommendation is not a universal default for field survey work.

**TSM decision:** Extend the waypoint schema with optional heading quality metadata: reported angular accuracy, device orientation, and capture activity context. Unknown or missing accuracy remains unknown; it is not converted to zero or interpreted as high confidence. Device heading stays context-only and `engineeringUse` remains `not-authorized`.

Source: [Apple Developer Forums — CoreLocation compass heading is wrong](https://developer.apple.com/forums/thread/756943); [Apple heading accuracy property](https://developer.apple.com/documentation/corelocation/clheading/headingaccuracy).

### 3. Do not derive engineering coordinates from a flat-earth approximation

A Core Location forum discussion notes that Core Location offers distance between locations, not a general geodesic direct solver, and recommends a geodesic library when ellipsoidal accuracy matters. This is community guidance, not a formal endorsement of one dependency.

**TSM decision:** A bearing-plus-distance calculation must use a documented geodetic method and explicit ellipsoid/CRS, units, and error bounds. Do not add a home-grown planar conversion to waypoint capture. Existing coordinate and datum release gates remain in force.

Source: [Apple Developer Forums — Calculate coordinate by distance and heading](https://developer.apple.com/forums/thread/710284).

### 4. Make network retry behavior depend on idempotency

Apple's networking guidance explains that transport failures can occur after a server has received a request but before the client receives its response. Retrying a non-idempotent request can duplicate effects; retry policy must be based on method and server semantics.

**TSM decision:** The Shortcuts integration remains GET-only, user-triggered, and mutation-free. Any future client must check HTTP status, preserve source timestamps and freshness, bound response size/time, surface unavailable/stale states, and avoid automatic retries for non-idempotent operations unless an explicit idempotency mechanism is implemented.

Source: [Apple Technical Q&A QA1941](https://developer.apple.com/library/archive/qa/qa1941/_index.html); [Apple URLSession documentation](https://developer.apple.com/documentation/foundation/urlsession.md).

## Implemented in this change

- Adds optional heading accuracy/orientation/activity metadata to the waypoint schema without relaxing the required provenance fields or engineering-use prohibition.
- Adds a machine-readable register of the forum findings and the TSM constraints they inform.
- Adds focused contract tests and a CI workflow for the new safety invariants.
- Links the research to the existing Shortcuts and compass integration docs.

## Explicitly not claimed

- No native iOS application or App Intents target was built or installed.
- No iCloud Shortcut was created or shared.
- No live endpoint response or on-device compass measurement was validated by this documentation change.
- No waypoint is authorized for survey control, parcel boundaries, hydraulic design, or regulatory decisions.
