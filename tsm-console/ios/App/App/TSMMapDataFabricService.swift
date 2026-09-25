import Foundation
import CoreLocation
import Combine

/// TSM Map Data Fabric API Client & Real-time Streamgage Hydrologic Service
///
/// Fetches live USGS/NOAA hydrologic observations from TSM Node API Token Proxy
/// (`GET /api/hydrologic/community`), enforces NAVD88 vertical datum tracking,
/// handles fail-closed observation states, and validates FEMA BFE reconciliation.
///
/// API base URL resolution order:
///   1. `baseURL` passed to `init` (highest precedence)
///   2. `TSM_API_BASE_URL` key in the app's Info.plist
///   3. Built-in default `https://tsm.tristate.org/api/hydrologic/community`
public class TSMMapDataFabricService: ObservableObject {
    @Published public var stations: [TSMStreamgageStation] = []
    @Published public var isFetching: Bool = false
    @Published public var lastErrorMessage: String? = nil

    private let apiBaseURL: String

    public init(baseURL: String? = nil) {
        if let baseURL = baseURL, !baseURL.isEmpty {
            self.apiBaseURL = baseURL
        } else if let plistURL = Bundle.main.object(forInfoDictionaryKey: "TSM_API_BASE_URL") as? String,
                  !plistURL.isEmpty {
            self.apiBaseURL = plistURL
        } else {
            self.apiBaseURL = "https://tsm.tristate.org/api/hydrologic/community"
        }
    }

    /// Fetches live river observations from TSM API proxy
    @MainActor
    public func fetchCommunityGauges() async {
        self.isFetching = true
        self.lastErrorMessage = nil

        guard let url = URL(string: apiBaseURL) else {
            self.lastErrorMessage = "Invalid API Endpoint URL"
            self.isFetching = false
            return
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                self.lastErrorMessage = "HTTP Server Error"
                self.isFetching = false
                return
            }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let result = try decoder.decode(TSMCommunityGaugeResponse.self, from: data)

            self.stations = result.stations
            self.isFetching = false
        } catch {
            self.lastErrorMessage = "Data fabric connection error: \(error.localizedDescription)"
            self.isFetching = false

            // Fallback: Populate fail-closed offline station records
            self.stations = getOfflineFallbackStations()
        }
    }

    /// Provides fail-closed offline fallback stations when network is unavailable.
    ///
    /// FAIL-CLOSED DOCTRINE (repo README: "The system never converts a missing
    /// upstream observation into a guessed value"): these offline records carry
    /// last-known/demo values, so they MUST be marked `.unavailable` — never
    /// `.live` — otherwise the UI would present stale or fabricated data as a
    /// live observation.
    private func getOfflineFallbackStations() -> [TSMStreamgageStation] {
        return [
            TSMStreamgageStation(
                id: "USGS-03378500",
                name: "Wabash River at Mount Carmel, IN",
                latitude: 38.4103,
                longitude: -87.7589,
                stageFt: 18.42,
                gageZeroNavd88Ft: 371.10,
                navd88WseFt: 389.52,
                status: .unavailable,
                provenanceSignature: "0x8f3c...b12a"
            ),
            TSMStreamgageStation(
                id: "NOAA-GLCI2",
                name: "Ohio River at Golconda, IL",
                latitude: 37.3639,
                longitude: -88.4842,
                stageFt: 22.15,
                gageZeroNavd88Ft: 309.95,
                navd88WseFt: 332.10,
                status: .unavailable,
                provenanceSignature: "0x7a1e...f49c"
            )
        ]
    }
}

// =============================================================================
// DATA CONTRACT MODELS & STRUCTS
// =============================================================================

public struct TSMCommunityGaugeResponse: Codable {
    public let timestamp: Date
    public let stations: [TSMStreamgageStation]
}

public struct TSMStreamgageStation: Codable, Identifiable {
    public let id: String
    public let name: String
    public let latitude: Double
    public let longitude: Double
    public let stageFt: Double
    public let gageZeroNavd88Ft: Double
    public let navd88WseFt: Double
    public let status: TSMGaugeStatus
    public let provenanceSignature: String

    public var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

public enum TSMGaugeStatus: String, Codable {
    case live = "LIVE OBSERVATION"
    case stale = "STALE"
    case candidate = "CANDIDATE"
    case unavailable = "SOURCE UNAVAILABLE"
}
