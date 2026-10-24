# WWDC24 MapKit and Maps & Location forum review

**Reviewed:** 2026-10-24  
**Video:** [WWDC24 — Unlock the power of places with MapKit](https://developer.apple.com/videos/play/wwdc2024/10097)  
**Forum topic:** [Apple Developer Forums — Maps and Location](https://developer.apple.com/forums/forums/topics/maps-and-location)

## Source-derived findings

The WWDC24 session covers persistent place references through **Place ID**, displaying place details through the **Place Card API**, improvements to search, and MapKit JS with a simplified **Maps Embed API** for websites.

The forum topic includes developer-reported issues involving location updates that stop or become inaccurate, background location session lifecycle, coordinate offsets between map datums, and map API capabilities. These are user reports and questions, not official statements that the reported behavior is universal or that a workaround is supported.

## TSM applicability

### Apply now: location/evidence boundaries

1. Keep map display identity separate from hydrologic and survey identity. An Apple Place ID can identify a user-facing place, but is not a parcel identifier, surveyed control point, gauge ID, CRS, vertical datum, or evidence of a flood boundary.
2. Persist only the external place reference and the metadata needed to revalidate it. Treat display name, address, search ranking, and details as mutable provider content.
3. Coordinate-bearing TSM data must retain its source CRS and transformation history. Never correct a point by applying an undocumented offset or a guessed WGS 84 / GCJ-02 conversion.
4. A map result or user-device location is discovery/context data only. It does not approve an AOI, certify a parcel boundary, or authorize hydraulic model input.

### Conditional: native MapKit or MapKit JS integration

The current TSM console uses a web mapping stack. WWDC24 describes MapKit framework and MapKit JS capabilities; it does not establish that Apple MapKit can be imported directly into the existing TypeScript/React mapping runtime.

- Keep MapKit / MapKit JS as an optional adapter proposal, not a new runtime dependency.
- Before enabling it, verify Apple developer-account/token requirements, service terms, attribution, quotas, data retention/redistribution limits, and browser restrictions against current Apple documentation.
- Do not add a token, private key, API secret, or live Apple map endpoint in source control.
- Prefer the existing mapping stack for authoritative engineering overlays unless a tested product requirement justifies an additional provider.
- Do not depend on Place Card metadata such as opening hours for deterministic route planning; the forum topic contains an unresolved developer question about availability of such metadata through integrations.

## Maps & Location reliability notes

The forum contains reports of background updates ceasing, CLBackgroundActivitySession indicators persisting after an app update, and location positions appearing offset. TSM should use these as test-case inspiration only:

- test missing, stale, delayed, and low-accuracy location inputs;
- surface the source timestamp and accuracy where available;
- keep background location opt-in and purpose-limited in any future native app;
- avoid high-frequency location polling; use platform-supported update/monitoring APIs appropriate to the actual product requirement;
- never assume a forum workaround is an Apple-supported guarantee.

Apple's official guidance says location collection consumes power, should be minimized, and background updates should be enabled only when the product genuinely requires them. See [Accessing the device's location efficiently](https://developer.apple.com/documentation/xcode/accessing-the-device-s-location-efficiently) and [Handling location updates in the background](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background).

## Implementation in this change

- Add a JSON Schema for optional Apple place references with explicit provider identity, retrieval time, and non-authoritative-use boundary.
- Add a focused test to prevent a Place ID from being represented as hydrologic/parcel authority or used to bypass coordinate provenance.
- Add a source-grounded integration note and link it from the README.

## Not claimed

No Apple Maps/MapKit API is called by TSM, no developer token was configured, and no native iOS application or background location session was built. This change applies the relevant data-boundary and reliability ideas without introducing an unverified external dependency.
