// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TSMEngineeringCore",
    platforms: [.iOS(.v17)],
    products: [.library(name: "TSMEngineeringCore", targets: ["TSMEngineeringCore"]),
               .executable(name: "TSMWorldPacker", targets: ["TSMWorldPacker"])],
    targets: [
        .target(name: "TSMEngineeringCore", path: "Sources/Core"),
        .executableTarget(name: "TSMWorldPacker", dependencies: ["TSMEngineeringCore"], path: "Tools/WorldPacker"),
        .testTarget(name: "TSMEngineeringCoreTests", dependencies: ["TSMEngineeringCore"], path: "Tests/CoreTests")
    ]
)
