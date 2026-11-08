// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TSMEngineeringCore",
    platforms: [.iOS(.v17)],
    products: [.library(name: "TSMEngineeringCore", targets: ["TSMEngineeringCore"])],
    targets: [
        .target(name: "TSMEngineeringCore", path: "Sources/Core"),
        .testTarget(name: "TSMEngineeringCoreTests", dependencies: ["TSMEngineeringCore"], path: "Tests/CoreTests")
    ]
)
