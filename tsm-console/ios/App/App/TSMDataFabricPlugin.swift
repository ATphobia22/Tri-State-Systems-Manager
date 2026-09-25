import Foundation
import Capacitor

/// Capacitor bridge exposing `TSMMapDataFabricService` to the web layer.
///
/// JavaScript usage (after `npx cap sync ios`):
/// ```js
/// const { TSMDataFabric } = Capacitor.Plugins;
/// const { stations, error } = await TSMDataFabric.fetchGauges();
/// // stations: [{ id, name, latitude, longitude, stageFt, gageZeroNavd88Ft,
/// //              navd88WseFt, status, provenanceSignature }]
/// // status is one of: "LIVE OBSERVATION" | "STALE" | "CANDIDATE" | "SOURCE UNAVAILABLE"
/// ```
///
/// Auto-registered at runtime via `CAPBridgedPlugin` (Capacitor 5+); no
/// Objective-C `.m` registration file is required. The class only needs to be
/// compiled into the App target's Sources build phase.
@objc(TSMDataFabricPlugin)
public class TSMDataFabricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TSMDataFabricPlugin"
    public let jsName = "TSMDataFabric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fetchGauges", returnType: CAPPluginReturnPromise)
    ]

    private let service = TSMMapDataFabricService()

    /// Fetches community river gauges via the native data-fabric service and
    /// resolves with the decoded stations as JSON. On network failure the
    /// service returns fail-closed offline records (status "SOURCE
    /// UNAVAILABLE") and the error is surfaced in the `error` field — the call
    /// still resolves so the web layer can render the unavailable state.
    @objc func fetchGauges(_ call: CAPPluginCall) {
        Task { @MainActor in
            await service.fetchCommunityGauges()
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            do {
                let data = try encoder.encode(service.stations)
                let json = try JSONSerialization.jsonObject(with: data)
                var result: [String: Any] = ["stations": json]
                if let errorMessage = service.lastErrorMessage {
                    result["error"] = errorMessage
                }
                call.resolve(result)
            } catch {
                call.reject("Failed to encode gauge stations: \(error.localizedDescription)")
            }
        }
    }
}
