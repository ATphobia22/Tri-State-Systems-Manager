import Foundation

/// Distinguishes visual models from observations and engineering evidence.
public enum EvidenceState: String, Codable, CaseIterable, Sendable {
    case illustrative = "ILLUSTRATIVE"
    case sourceUnavailable = "SOURCE_UNAVAILABLE"
    case staleObservation = "STALE_OBSERVATION"
    case observed = "LIVE_OBSERVATION"
    case verifiedRecord = "SOURCE_VERIFIED"
}

public struct Provenance: Codable, Equatable, Sendable {
    public let title: String
    public let authority: String
    public let sourceURL: String?
    public let acquiredAtISO8601: String?
    public let checksumSHA256: String?
    public let horizontalCRS: String?
    public let verticalDatum: String?
    public let state: EvidenceState

    public init(title: String, authority: String, sourceURL: String? = nil,
                acquiredAtISO8601: String? = nil, checksumSHA256: String? = nil,
                horizontalCRS: String? = nil, verticalDatum: String? = nil,
                state: EvidenceState) {
        self.title = title
        self.authority = authority
        self.sourceURL = sourceURL
        self.acquiredAtISO8601 = acquiredAtISO8601
        self.checksumSHA256 = checksumSHA256
        self.horizontalCRS = horizontalCRS
        self.verticalDatum = verticalDatum
        self.state = state
    }
}

public struct GaugeSnapshot: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let siteName: String
    public let stageFeet: Double?
    public let measuredAtISO8601: String?
    public let gageZeroNAVD88Feet: Double?
    public let provenance: Provenance

    public init(id: String, siteName: String, stageFeet: Double? = nil,
                measuredAtISO8601: String? = nil, gageZeroNAVD88Feet: Double? = nil,
                provenance: Provenance) {
        self.id = id
        self.siteName = siteName
        self.stageFeet = stageFeet
        self.measuredAtISO8601 = measuredAtISO8601
        self.gageZeroNAVD88Feet = gageZeroNAVD88Feet
        self.provenance = provenance
    }

    /// A stage-to-elevation transform is unavailable without both operands and
    /// source-established matching units and a confirmed NAVD88 gage datum.
    public var waterSurfaceNAVD88Feet: Double? {
        guard provenance.state == .observed || provenance.state == .verifiedRecord,
              provenance.verticalDatum == "NAVD88",
              let stageFeet, let gageZeroNAVD88Feet,
              stageFeet.isFinite, gageZeroNAVD88Feet.isFinite else { return nil }
        return stageFeet + gageZeroNAVD88Feet
    }
}

public struct ScenarioSettings: Equatable, Codable, Sendable {
    public var bermRiseMeters: Double
    public var roadRiseMeters: Double
    public var waterVisualOffsetMeters: Double

    public init(bermRiseMeters: Double = 1.0,
                roadRiseMeters: Double = 0.3,
                waterVisualOffsetMeters: Double = 0.0) {
        self.bermRiseMeters = Self.clamp(bermRiseMeters, low: 0, high: 4)
        self.roadRiseMeters = Self.clamp(roadRiseMeters, low: 0, high: 2)
        self.waterVisualOffsetMeters = Self.clamp(waterVisualOffsetMeters, low: -1, high: 3)
    }

    public static func clamp(_ value: Double, low: Double, high: Double) -> Double {
        guard value.isFinite else { return low }
        return min(high, max(low, value))
    }

    public var bermRiseFeet: Double { bermRiseMeters * 3.280839895 }
    public var roadRiseFeet: Double { roadRiseMeters * 3.280839895 }
}

public struct SiteSnapshot: Codable, Sendable {
    public let title: String
    public let county: String
    public let state: EvidenceState
    public let gauges: [GaugeSnapshot]
    public let disclaimer: String

    /// Embedded snapshot is deliberately data-absent. Never report placeholder stage as live.
    public static var offlineDemo: SiteSnapshot {
        SiteSnapshot(title: "Tri-State River Valley", county: "Posey County, Indiana",
            state: .illustrative,
            gauges: [
                GaugeSnapshot(id: "03378500", siteName: "Wabash River at New Harmony, IN",
                    provenance: Provenance(title: "USGS monitoring station", authority: "USGS",
                        sourceURL: "https://waterdata.usgs.gov/monitoring-location/USGS-03378500/",
                        state: .sourceUnavailable)),
                GaugeSnapshot(id: "03322000", siteName: "Wabash River at Mount Carmel, IL",
                    provenance: Provenance(title: "USGS monitoring station", authority: "USGS",
                        sourceURL: "https://waterdata.usgs.gov/monitoring-location/USGS-03322000/",
                        state: .sourceUnavailable))
            ],
            disclaimer: "Visual concept only. Not a FEMA map, survey, hydrodynamic model or regulatory determination.")
    }
}
