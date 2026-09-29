# ARKit-CoreLocation (vendored)

Source: https://github.com/AndrewHartAR/ARKit-CoreLocation
(`Sources/ARKit-CoreLocation`, 19 Swift files, 132K)

License: MIT — see `LICENSE-ARCL`. Upstream is also available as the Swift
package `ARCL`; the sources are vendored here (verbatim) so iOS builds work
with no network access, per the air-gapped deployment target.

## What it does

Fuses ARKit visual-inertial tracking with CoreLocation GPS so AR content can
be pinned to real-world coordinates. `SceneLocationView` is a drop-in
`ARSCNView` subclass; `LocationAnnotationNode`s are placed at `CLLocation`s
and stay anchored as the user walks.

## TSM use: field companion AR

Pin regulatory markers at the anchor site, visible through the phone camera:

- LOMA case markers: LAG point, FFE point, berm crest line
- BFE plane (375.0 ft NAVD88) as a translucent reference surface
- Parcel corners from the vendored Posey County parcels

Sketch (`FieldARViewController.swift`, to live in the iOS target):

```swift
import ARKit
import CoreLocation

final class FieldARViewController: UIViewController {
    private var sceneView: SceneLocationView!

    override func viewDidLoad() {
        super.viewDidLoad()
        sceneView = SceneLocationView(frame: view.bounds)
        view.addSubview(sceneView)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        sceneView.run()
    }

    /// Pin a marker at a surveyed coordinate (degrees, metres above datum).
    func pinMarker(latitude: Double, longitude: Double,
                   altitude: Double, image: UIImage) {
        let location = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: latitude,
                                               longitude: longitude),
            altitude: altitude,
            horizontalAccuracy: 0, verticalAccuracy: 0,
            timestamp: Date())
        let node = LocationAnnotationNode(location: location, image: image)
        sceneView.addLocationNodeWithConfirmedLocation(locationNode: node)
    }
}
```

## Xcode integration

Add the vendored sources to the iOS target (or reference them as a local
Swift package). Requires `NSCameraUsageDescription` and
`NSLocationWhenInUseUsageDescription` in Info.plist. ARKit requires a real
device — it does not run in the simulator.

## Honesty note

GPS accuracy on phones is ~3-5 m; AR pins are a field *visualization aid*,
not survey evidence. Never present an AR pin as a surveyed location.
