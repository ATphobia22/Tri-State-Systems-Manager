import Foundation
import XCTest
@testable import TSMEngineeringCore

final class WorldPackageTests: XCTestCase {
    private func geometry() -> WorldGeometry {
        WorldGeometry(sourceHorizontalCRS: "EPSG:2966", sourceVerticalDatum: "UNVERIFIED",
                      sourceUnits: "ftUS",
                      terrain: WorldTerrain(width: 3, depth: 3, cellSizeMeters: 2,
                                            originX: -2, originZ: -2,
                                            elevationsMeters: [0,0,0,0,1,0,0,0,0]),
                      buildings: [WorldBuilding(id: "A", name: "Test building", xMeters: 0,
                                                zMeters: 0, widthMeters: 1, lengthMeters: 1,
                                                heightMeters: 4)],
                      river: WorldRiver(centerline: [WorldPoint(x: -2, z: -1),
                                                    WorldPoint(x: 2, z: 1)], widthMeters: 0.5))
    }

    func testSHA256KnownVectors() {
        XCTAssertEqual(SHA256Digest.hex(Data()),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        XCTAssertEqual(SHA256Digest.hex(Data("abc".utf8)),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    func testPackageRoundTripAndIntegrity() throws {
        let data = try WorldPackageCodec.encode(name: "Example only",
            provenance: WorldProvenance(authority: "TSM demo", sourceDataset: "synthetic fixture"),
            geometry: geometry())
        let package = try WorldPackageCodec.decode(data)
        XCTAssertEqual(package.geometry.buildings.count, 1)
        XCTAssertEqual(package.geometry.coordinateFrame, "LOCAL_ENU_METERS")
        XCTAssertEqual(package.geometrySHA256.count, 64)
        XCTAssertEqual(package.geometry.sourceVerticalDatum, "UNVERIFIED")
    }

    func testTamperingFailsChecksum() throws {
        let data = try WorldPackageCodec.encode(name: "Example only",
            provenance: WorldProvenance(authority: "TSM demo", sourceDataset: "synthetic fixture"),
            geometry: geometry())
        let json = String(decoding: data, as: UTF8.self)
        let altered = json.replacingOccurrences(of: "\"geometrySHA256\":\"", with: "\"geometrySHA256\":\"0")
        XCTAssertNotEqual(altered, json)
        XCTAssertThrowsError(try WorldPackageCodec.decode(Data(altered.utf8))) { error in
            XCTAssertEqual(error as? WorldPackageError, .checksumMismatch)
        }
    }

    func testRejectsUnboundedAndWrongCRS() {
        let original = geometry()
        let wrongFrame = WorldGeometry(coordinateFrame: "EPSG:2966",
            sourceHorizontalCRS: "EPSG:2966", sourceVerticalDatum: "NAVD88",
            sourceUnits: "ftUS", terrain: original.terrain, buildings: [])
        XCTAssertThrowsError(try WorldPackageCodec.validate(wrongFrame))
        let invalid = WorldGeometry(sourceHorizontalCRS: "EPSG:2966",
            sourceVerticalDatum: "UNVERIFIED", sourceUnits: "ftUS",
            terrain: WorldTerrain(width: 3, depth: 3, cellSizeMeters: 2,
                originX: 0, originZ: 0, elevationsMeters: [0]), buildings: [])
        XCTAssertThrowsError(try WorldPackageCodec.validate(invalid))
    }

    func testDuplicateBuildingIDsRejected() {
        let original = geometry()
        let duplicate = WorldGeometry(sourceHorizontalCRS: "EPSG:2966",
            sourceVerticalDatum: "UNVERIFIED", sourceUnits: "ftUS",
            terrain: original.terrain,
            buildings: [original.buildings[0], original.buildings[0]])
        XCTAssertThrowsError(try WorldPackageCodec.validate(duplicate))
    }

    func testOversizePackageRejectedBeforeDecode() {
        let huge = Data(repeating: 0x20, count: WorldPackageCodec.maximumBytes + 1)
        XCTAssertThrowsError(try WorldPackageCodec.decode(huge)) { error in
            XCTAssertEqual(error as? WorldPackageError, .tooLarge)
        }
    }
}
