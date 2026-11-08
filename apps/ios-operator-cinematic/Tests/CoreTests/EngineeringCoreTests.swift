import XCTest
@testable import TSMEngineeringCore

final class EngineeringCoreTests: XCTestCase {
    func testOfflineGaugesCannotInventStage() {
        let source = SiteSnapshot.offlineDemo
        XCTAssertEqual(source.gauges.count, 2)
        XCTAssertEqual(source.state, .illustrative)
        for station in source.gauges {
            XCTAssertNil(station.stageFeet)
            XCTAssertNil(station.waterSurfaceNAVD88Feet)
            XCTAssertEqual(station.provenance.state, .sourceUnavailable)
        }
    }

    func testDatumMustBeSourceVerified() {
        let missing = GaugeSnapshot(id: "1", siteName: "example", stageFeet: 13,
            gageZeroNAVD88Feet: 350,
            provenance: Provenance(title: "unverified", authority: "test", state: .observed))
        XCTAssertNil(missing.waterSurfaceNAVD88Feet)
        let checked = GaugeSnapshot(id: "1", siteName: "example", stageFeet: 13,
            gageZeroNAVD88Feet: 350,
            provenance: Provenance(title: "verified", authority: "test", verticalDatum: "NAVD88",
                state: .verifiedRecord))
        XCTAssertEqual(checked.waterSurfaceNAVD88Feet, 363)
    }

    func testScenarioIsBounded() {
        let scenario = ScenarioSettings(bermRiseMeters: 999, roadRiseMeters: -4,
                                        waterVisualOffsetMeters: .infinity)
        XCTAssertEqual(scenario.bermRiseMeters, 4)
        XCTAssertEqual(scenario.roadRiseMeters, 0)
        XCTAssertEqual(scenario.waterVisualOffsetMeters, -1)
        XCTAssertEqual(ScenarioSettings(bermRiseMeters: 1).bermRiseFeet, 3.280839895,
                       accuracy: 0.000001)
    }

    func testCodableEvidenceState() throws {
        let encoded = try JSONEncoder().encode(SiteSnapshot.offlineDemo)
        let decoded = try JSONDecoder().decode(SiteSnapshot.self, from: encoded)
        XCTAssertEqual(decoded.gauges.map(\.id), ["03378500", "03322000"])
    }
}

extension EngineeringCoreTests {
    func testOfflineSceneAcceptsBoundedLocalCoordinates() throws {
        let valid = OfflineScene(datasetID: "test-tile", title: "Operator-reviewed test tile",
            authority: "unit-test", horizontalCRS: "EPSG:2966",
            verticalDatum: "UNVERIFIED", sourceSHA256: String(repeating: "a", count: 64),
            transformReceipt: "US survey feet -> local metres by exact conversion",
            originEastFeet: 1000, originNorthFeet: 1000, acquiredAt: "2026-11-08T00:00:00Z",
            buildings: [OfflineBuilding(id: "building-1", eastMeters: 2,
                northMeters: 3, baseMeters: 0, widthMeters: 7,
                depthMeters: 6, heightMeters: 4)])
        XCTAssertNoThrow(try valid.validate())
    }

    func testOfflineSceneRejectsDuplicateIdentifiersAndNonfiniteGeometry() {
        let b = OfflineBuilding(id: "dup", eastMeters: .nan, northMeters: 3,
            baseMeters: 0, widthMeters: 7, depthMeters: 6, heightMeters: 4)
        let invalid = OfflineScene(datasetID: "test", title: "test", authority: "test",
            horizontalCRS: "EPSG:2966", verticalDatum: "UNVERIFIED",
            sourceSHA256: String(repeating: "a", count: 64), transformReceipt: "checked",
            originEastFeet: 1000, originNorthFeet: 1000, acquiredAt: "2026-11-08", buildings: [b,b])
        XCTAssertThrowsError(try invalid.validate())
    }

    func testTamperedEnvelopeFormatFails() {
        let envelope = OfflineSceneEnvelope(payloadBase64: "notbase64!!", payloadSHA256: "bad")
        XCTAssertThrowsError(try envelope.decodeUntrustedPayload())
    }

    func testUSGSObservationParserKeepsGageDatumAndFiltersStation() throws {
        let json = #"{"features":[{"properties":{"monitoring_location_id":"USGS-03378500","parameter_code":"00065","unit_of_measure":"ft","value":"12.7","time":"2026-11-08T12:00:00Z"}},{"properties":{"monitoring_location_id":"USGS-OTHER","parameter_code":"00065","unit_of_measure":"ft","value":"9999","time":"2026-11-08T12:00:00Z"}}]}"#.data(using: .utf8)!
        let clock = ISO8601DateFormatter().date(from: "2026-11-08T12:30:00Z")!
        let row = try USGSObservationParser.latestStage(from: json, stationID: "03378500", now: clock)
        XCTAssertEqual(row?.stageFeet, 12.7)
        XCTAssertNil(row?.waterSurfaceNAVD88Feet)
        XCTAssertEqual(row?.provenance.state, .observed)
    }

    func testUSGSStaleCannotBeLive() throws {
        let json = #"{"features":[{"properties":{"monitoring_location_id":"USGS-03378500","parameter_code":"00065","unit_of_measure":"ft","value":"12.7","time":"2026-11-06T12:00:00Z"}}]}"#.data(using: .utf8)!
        let clock = ISO8601DateFormatter().date(from: "2026-11-08T12:30:00Z")!
        let row = try USGSObservationParser.latestStage(from: json, stationID: "03378500", now: clock)
        XCTAssertEqual(row?.provenance.state, .staleObservation)
        XCTAssertNil(row?.waterSurfaceNAVD88Feet)
    }
    func testScenarioPresetRoundTrip() throws {
        let scenario = ScenarioSettings(bermRiseMeters: 1.4, roadRiseMeters: 0.2,
            waterVisualOffsetMeters: -0.4)
        let data = try JSONEncoder().encode(scenario)
        let loaded = try JSONDecoder().decode(ScenarioSettings.self, from: data)
        XCTAssertEqual(loaded, scenario)
    }

}
