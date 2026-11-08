import Foundation
import XCTest
@testable import TSMEngineeringCore

final class ScenarioArchiveTests: XCTestCase {
    func testRoundTripAndLinkage() throws {
        let original = ScenarioRecord(name: "Berm A", settings: ScenarioSettings(bermRiseMeters: 2),
                                      linkedWorldSHA256: String(repeating: "a", count: 64))
        let decoded = try ScenarioArchive.decode(ScenarioArchive.encode([original]))
        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded[0], original)
        XCTAssertEqual(decoded[0].status, "ILLUSTRATIVE_ONLY")
    }

    func testScenarioDecodeClampsTamperedNumericValue() throws {
        let record = ScenarioRecord(name: "Test", settings: ScenarioSettings(bermRiseMeters: 2))
        let encoded = String(decoding: try ScenarioArchive.encode([record]), as: UTF8.self)
        let modified = encoded.replacingOccurrences(of: "\"bermRiseMeters\":2", with: "\"bermRiseMeters\":999")
        let restored = try ScenarioArchive.decode(Data(modified.utf8))
        XCTAssertEqual(restored[0].settings.bermRiseMeters, 4)
    }

    func testCannotImportUnapprovedStatus() throws {
        let record = ScenarioRecord(name: "Test", settings: ScenarioSettings())
        let encoded = String(decoding: try ScenarioArchive.encode([record]), as: UTF8.self)
        let modified = encoded.replacingOccurrences(of: "ILLUSTRATIVE_ONLY", with: "ENGINEERING_APPROVED")
        XCTAssertThrowsError(try ScenarioArchive.decode(Data(modified.utf8)))
    }
}
