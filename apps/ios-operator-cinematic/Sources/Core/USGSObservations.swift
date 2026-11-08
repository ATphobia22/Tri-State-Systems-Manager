import Foundation

/// USGS OGC API observations are NOT NAVD88 elevations; they remain stage
/// measurements relative to station-specific gage datum until separately verified.
public struct USGSObservationCollection: Decodable {
    public let features: [USGSObservationFeature]
}
public struct USGSObservationFeature: Decodable {
    public let properties: USGSObservationProperties
}
public struct USGSObservationProperties: Decodable {
    public let monitoring_location_id: String
    public let parameter_code: String
    public let unit_of_measure: String
    public let value: String
    public let time: String
}

public enum USGSObservationParser {
    /// The remote collection must be requested with station + 00065 filters.
    /// Still validate every returned row, as the server is not a trust boundary.
    public static func latestStage(from json: Data, stationID: String,
                                   now: Date = Date()) throws -> GaugeSnapshot? {
        let decoded = try JSONDecoder().decode(USGSObservationCollection.self, from: json)
        guard decoded.features.count <= 200 else { return nil }
        let expected = "USGS-" + stationID
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]
        let candidates = decoded.features.compactMap { feature -> (Date, Double)? in
            let p = feature.properties
            guard p.monitoring_location_id == expected, p.parameter_code == "00065",
                  p.unit_of_measure == "ft",
                  let stage = Double(p.value), stage.isFinite,
                  let observedAt = dateFormatter.date(from: p.time) ?? fallbackFormatter.date(from: p.time),
                  observedAt <= now.addingTimeInterval(5 * 60) else { return nil }
            return (observedAt, stage)
        }
        guard let latest = candidates.max(by: { $0.0 < $1.0 }) else { return nil }
        let recent = now.timeIntervalSince(latest.0) <= 2 * 60 * 60
        let state: EvidenceState = recent ? .observed : .staleObservation
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return GaugeSnapshot(id: stationID,
                             siteName: stationID == "03378500" ? "Wabash River at New Harmony, IN" :
                                       stationID == "03322000" ? "Wabash River at Mount Carmel, IL" : stationID,
                             stageFeet: latest.1,
                             measuredAtISO8601: formatter.string(from: latest.0),
                             gageZeroNAVD88Feet: nil,
                             provenance: Provenance(title: "USGS OGC latest continuous stage",
                                 authority: "USGS", sourceURL:
                                 "https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items",
                                 horizontalCRS: nil, verticalDatum: "GAGE_DATUM",
                                 state: state))
    }
}
