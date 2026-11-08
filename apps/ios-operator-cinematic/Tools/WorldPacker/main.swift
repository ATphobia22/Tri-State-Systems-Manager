import Foundation
import TSMEngineeringCore

/// Command-line preparation step; NOT part of the iOS runtime.
/// Requires already-transformed LOCAL_ENU_METERS geometry. Does not infer
/// EPSG transformations, source provenance, vertical datum or approval.
func run() throws {
    let args = Array(CommandLine.arguments.dropFirst())
    if args.count == 2 && args[0] == "--verify" {
        let package = try WorldPackageCodec.decode(Data(contentsOf: URL(fileURLWithPath: args[1])))
        print("VERIFIED_GEOMETRY_SHA256=\(package.geometrySHA256) BUILDINGS=\(package.geometry.buildings.count) SOURCE_REVIEW=UNVERIFIED")
        return
    }
    if args.count == 2 && args[0] == "--demo" {
        let destination = URL(fileURLWithPath: args[1])
        let width = 35, depth = 35, step = 2.0
        var heights = [Double]()
        for row in 0..<depth {
            for col in 0..<width {
                let x = Double(col - width / 2) * step
                let z = Double(row - depth / 2) * step
                let river = max(0, 9 - abs(x + 0.42 * z)) * 0.24
                heights.append(sin(x * 0.09) * 0.8 + cos(z * 0.11) * 0.5 - river)
            }
        }
        let buildings: [WorldBuilding] = (-7...7).flatMap { row in
            (-7...7).compactMap { col in
                let x = Double(col) * 4.0
                let z = Double(row) * 4.0
                if abs(x + 0.42 * z) < 8 { return nil }
                let height = Double(3 + (abs(row * 7 + col * 11) % 8))
                return WorldBuilding(id: "SYN-\(row)-\(col)", name: "Synthetic block \(row),\(col)",
                    xMeters: x, zMeters: z, widthMeters: 2.8, lengthMeters: 2.8,
                    heightMeters: height)
            }
        }
        let geometry = WorldGeometry(sourceHorizontalCRS: "SYNTHETIC_NO_CRS",
            sourceVerticalDatum: "UNVERIFIED", sourceUnits: "m",
            terrain: WorldTerrain(width: width, depth: depth, cellSizeMeters: step,
                originX: -Double(width / 2) * step, originZ: -Double(depth / 2) * step,
                elevationsMeters: heights), buildings: buildings,
            river: WorldRiver(centerline: [WorldPoint(x: -30, z: 12.6),
                WorldPoint(x: 0, z: 0), WorldPoint(x: 30, z: -12.6)], widthMeters: 6))
        let data = try WorldPackageCodec.encode(name: "Synthetic River Valley — demonstration",
            provenance: WorldProvenance(authority: "TSM SYNTHETIC DEMO",
                sourceDataset: "Deterministic generated mesh", reviewState: .illustrative),
            geometry: geometry, createdAt: "2026-11-08T00:00:00Z")
        try data.write(to: destination, options: .atomic)
        print("Wrote \(data.count) bytes to \(destination.path) [ILLUSTRATIVE]")
        return
    }
    if args.count == 6 && args[0] == "--geometry" && args[2] == "--provenance" && args[4] == "--output" {
        let geometry = try JSONDecoder().decode(WorldGeometry.self,
            from: Data(contentsOf: URL(fileURLWithPath: args[1])))
        let provenance = try JSONDecoder().decode(WorldProvenance.self,
            from: Data(contentsOf: URL(fileURLWithPath: args[3])))
        let data = try WorldPackageCodec.encode(name: provenance.sourceDataset,
            provenance: provenance, geometry: geometry,
            createdAt: ISO8601DateFormatter().string(from: Date()))
        try data.write(to: URL(fileURLWithPath: args[5]), options: .atomic)
        print("Packed \(geometry.buildings.count) buildings; SHA-256 geometry integrity attached")
        return
    }
    print("Usage: TSMWorldPacker --demo OUTPUT.tsmworld | --verify FILE.tsmworld")
    print("   or: TSMWorldPacker --geometry LOCAL_METRIC.json --provenance SOURCE.json --output OUTPUT.tsmworld")
    throw NSError(domain: "TSMWorldPacker", code: 2)
}

do { try run() }
catch {
    fputs("TSMWorldPacker: \(error)\n", stderr)
    exit(2)
}
