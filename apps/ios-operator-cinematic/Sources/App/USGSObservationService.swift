import Foundation

@MainActor
final class USGSObservationService: ObservableObject {
    @Published private(set) var gauges = SiteSnapshot.offlineDemo.gauges
    @Published private(set) var isFetching = false
    @Published private(set) var statusMessage = "OFFLINE — No USGS observations requested"

    func refresh() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        let ids = ["03378500", "03322000"]
        var results: [GaugeSnapshot] = []
        for id in ids {
            var parts = URLComponents(string:
                "https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items")!
            parts.queryItems = [
                URLQueryItem(name: "f", value: "json"),
                URLQueryItem(name: "monitoring_location_id", value: "USGS-" + id),
                URLQueryItem(name: "parameter_code", value: "00065"),
                URLQueryItem(name: "limit", value: "30")
            ]
            guard let url = parts.url, url.host == "api.waterdata.usgs.gov" else { continue }
            var request = URLRequest(url: url)
            request.timeoutInterval = 20
            request.setValue("application/geo+json, application/json", forHTTPHeaderField: "Accept")
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse,
                      http.statusCode == 200, data.count <= 1_000_000,
                      response.url?.host == "api.waterdata.usgs.gov" else { continue }
                if let gauge = try USGSObservationParser.latestStage(from: data, stationID: id) {
                    results.append(gauge)
                }
            } catch { /* Absence is not turned into fabricated telemetry. */ }
        }
        let fallback = SiteSnapshot.offlineDemo.gauges
        gauges = ids.compactMap { id in
            results.first(where: { $0.id == id }) ?? fallback.first(where: { $0.id == id })
        }
        statusMessage = results.isEmpty ? "USGS unavailable — no live data shown" :
            "USGS stage observations received; datum remains unverified"
    }
}
