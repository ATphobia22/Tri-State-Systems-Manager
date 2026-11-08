import SwiftUI
import UniformTypeIdentifiers

private enum TSMStyle {
    static let ink = Color(red: 0.015, green: 0.026, blue: 0.065)
    static let panel = Color(red: 0.045, green: 0.074, blue: 0.12)
    static let border = Color(red: 0.12, green: 0.23, blue: 0.32)
    static let cyan = Color(red: 0.36, green: 0.90, blue: 0.95)
    static let lilac = Color(red: 0.75, green: 0.52, blue: 0.99)
    static let pale = Color(red: 0.70, green: 0.77, blue: 0.85)
}

private struct GlassPanel<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content
            .padding(16)
            .background(TSMStyle.panel.opacity(0.91), in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(TSMStyle.border.opacity(0.85)))
    }
}

private enum OperatorTab: String, CaseIterable, Identifiable {
    case world = "WORLD"
    case gauges = "GAUGES"
    case studio = "STUDIO"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .world: return "square.3.layers.3d"
        case .gauges: return "water.waves"
        case .studio: return "slider.horizontal.3"
        }
    }
}

struct OperatorDashboardView: View {
    @StateObject private var city = CitySceneController()
    @State private var activeTab: OperatorTab = .world
    @State private var layers: Set<CitySceneController.MapLayer> = [.buildings, .river, .corridors]
    @State private var scenario = ScenarioSettings()
    @State private var scenarioMessage: String?
    @State private var incidentReview = false
    @State private var showFileImporter = false
    @State private var fileImportMessage: String?
    @StateObject private var observations = USGSObservationService()
    private let site = SiteSnapshot.offlineDemo

    var body: some View {
        ZStack {
            TSMStyle.ink.ignoresSafeArea()
            RadialGradient(colors: [TSMStyle.cyan.opacity(0.11), .clear],
                           center: .topLeading, startRadius: 40, endRadius: 460)
                .ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        headline
                        if activeTab == .world {
                            worldContent
                        } else if activeTab == .gauges {
                            gaugesContent
                        } else {
                            studioContent
                        }
                        disclaimer
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .padding(.bottom, 18)
                }
                bottomNavigation
            }
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.json]) { result in
            Task { @MainActor in
                do {
                    let scene = try OfflineSceneImporter.load(from: result.get())
                    try city.loadOfflineScene(scene)
                    layers = [.buildings]
                    fileImportMessage = "SHA-256 matched • dataset remains UNREVIEWED"
                } catch {
                    fileImportMessage = "Import rejected: " + error.localizedDescription
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(TSMStyle.cyan.opacity(0.11))
                    .frame(width: 38, height: 38)
                Image(systemName: "cpu.fill")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(TSMStyle.cyan)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("TRI-STATE / SYSTEMS")
                    .font(.system(size: 12, weight: .heavy, design: .monospaced))
                    .tracking(1.3)
                Text("RIVER VALLEY • OPERATOR")
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundStyle(TSMStyle.pale)
            }
            Spacer(minLength: 4)
            Button {
                incidentReview.toggle()
            } label: {
                Image(systemName: incidentReview ? "exclamationmark.shield.fill" : "shield.lefthalf.filled")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(incidentReview ? .orange : TSMStyle.cyan)
                    .frame(width: 42, height: 42)
                    .background(TSMStyle.panel, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(TSMStyle.border))
            }
            .accessibilityLabel("Toggle review-only alert overlay")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(TSMStyle.ink.opacity(0.9))
        .overlay(alignment: .bottom) { Rectangle().fill(TSMStyle.border).frame(height: 1) }
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Circle().fill(incidentReview ? .orange : TSMStyle.lilac)
                    .frame(width: 7, height: 7)
                Text(incidentReview ? "REVIEW-ONLY ALERT OVERLAY" : "INTERACTIVE ENGINEERING CONCEPT")
                    .foregroundStyle(incidentReview ? .orange : TSMStyle.lilac)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                Spacer()
                Text("LOCAL / OFFLINE")
                    .foregroundStyle(TSMStyle.pale)
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
            }
            Text(activeTab == .world ? "Living Watershed" : activeTab == .gauges ? "River Intelligence" : "Scenario Studio")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .tracking(-1.1)
                .foregroundStyle(.white)
            Text(activeTab == .world ? "An explorable miniature world for engineering exploration." :
                 activeTab == .gauges ? "Observation status and verified-source boundaries." :
                 "Shape the visual concept. Engineering results require a model run.")
                .font(.system(size: 12))
                .foregroundStyle(TSMStyle.pale)
            if incidentReview {
                Text("REVIEW MODE IS VISUAL ONLY — NO INCIDENT DETECTED OR ALERT ISSUED")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(.orange)
                    .padding(9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.11), in: RoundedRectangle(cornerRadius: 9))
            }
        }
    }

    private var worldContent: some View {
        VStack(spacing: 14) {
            ZStack(alignment: .top) {
                CinematicSceneView(controller: city)
                    .frame(height: 410)
                    .background(TSMStyle.ink)
                    .overlay(alignment: .topLeading) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("WORLD / 01")
                                .font(.system(size: 10, weight: .black, design: .monospaced))
                                .foregroundStyle(TSMStyle.cyan)
                            Text("3D LANDSCAPE ENGINE")
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(.white)
                            Text(city.importedSummary == nil ? "PROCEDURAL • NON-GEOSPATIAL" : "LOCAL GIS PREVIEW • UNREVIEWED")
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundStyle(TSMStyle.pale)
                        }
                        .padding(11)
                        .background(TSMStyle.ink.opacity(0.82), in: RoundedRectangle(cornerRadius: 12))
                        .padding(12)
                    }
                    .overlay(alignment: .topTrailing) {
                        Button {
                            city.setNight(!city.nightMode)
                        } label: {
                            Image(systemName: city.nightMode ? "sun.max.fill" : "moon.stars.fill")
                                .font(.system(size: 17))
                                .foregroundStyle(TSMStyle.cyan)
                                .padding(11)
                                .background(TSMStyle.ink.opacity(0.83), in: RoundedRectangle(cornerRadius: 11))
                        }
                        .accessibilityLabel("Toggle day and night lighting")
                        .padding(12)
                    }
                    .overlay(alignment: .bottom) {
                        VStack(spacing: 9) {
                            HStack {
                                Image(systemName: "scope")
                                    .foregroundStyle(TSMStyle.cyan)
                                Text(city.selectedAsset)
                                    .font(.system(size: 10, design: .monospaced))
                                    .lineLimit(1)
                                Spacer()
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(TSMStyle.ink.opacity(0.85), in: RoundedRectangle(cornerRadius: 9))
                            HStack(spacing: 7) {
                                ForEach(CitySceneController.CameraMode.allCases) { mode in
                                    Button {
                                        city.changeCamera(to: mode)
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: mode == .cinema ? "film" : mode == .drone ? "airplane" : "rotate.3d")
                                            Text(mode.rawValue.uppercased())
                                        }
                                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                                        .foregroundStyle(city.cameraMode == mode ? TSMStyle.ink : TSMStyle.pale)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(city.cameraMode == mode ? TSMStyle.cyan : TSMStyle.ink.opacity(0.88),
                                                    in: RoundedRectangle(cornerRadius: 9))
                                    }
                                }
                            }
                        }
                        .padding(12)
                    }
            }
            .clipShape(RoundedRectangle(cornerRadius: 21))
            .overlay(RoundedRectangle(cornerRadius: 21).stroke(TSMStyle.border))

            GlassPanel {
                VStack(alignment: .leading, spacing: 10) {
                    sectionTitle("LOCAL OFFLINE SCENE", icon: "square.and.arrow.down")
                    if let imported = city.importedSummary {
                        Text(imported)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(TSMStyle.cyan)
                    } else {
                        Text("Procedural concept is loaded. You may import a SHA-256 checked local tile of preprocessed buildings.")
                            .font(.system(size: 11))
                            .foregroundStyle(TSMStyle.pale)
                    }
                    HStack(spacing: 8) {
                        Button { showFileImporter = true } label: {
                            Label("IMPORT CHECKED TILE", systemImage: "square.and.arrow.down")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(TSMStyle.cyan)
                        if city.importedSummary != nil {
                            Button("RESET DEMO") {
                                city.restoreConceptCity()
                                layers = [.buildings, .river, .corridors]
                                fileImportMessage = nil
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    if let fileImportMessage {
                        Text(fileImportMessage)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(fileImportMessage.hasPrefix("Import rejected") ? .orange : TSMStyle.pale)
                    }
                    Text("Source checksums prove byte integrity, not positional accuracy, approval, or survey certification.")
                        .font(.system(size: 10))
                        .foregroundStyle(TSMStyle.pale)
                }
            }
            GlassPanel {
                VStack(alignment: .leading, spacing: 13) {
                    HStack {
                        sectionTitle("SCENE LAYERS", icon: "square.3.layers.3d.down.right")
                        Spacer()
                        Text("ILLUSTRATIVE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(TSMStyle.lilac)
                    }
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
                        ForEach(CitySceneController.MapLayer.allCases) { layer in
                            Button {
                                if layers.contains(layer) { layers.remove(layer) }
                                else { layers.insert(layer) }
                                city.setLayer(layer, visible: layers.contains(layer))
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: layers.contains(layer) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(layers.contains(layer) ? TSMStyle.cyan : TSMStyle.pale)
                                    Text(layer.rawValue)
                                        .foregroundStyle(.white)
                                    Spacer(minLength: 0)
                                }
                                .font(.system(size: 12, weight: .semibold))
                                .padding(11)
                                .background(TSMStyle.ink.opacity(0.8), in: RoundedRectangle(cornerRadius: 10))
                            }
                            .accessibilityLabel("Toggle concept layer \(layer.rawValue)")
                        }
                    }
                    Text("Touch a building to inspect it • Pinch and drag to explore • Cinema flyover is automatic")
                        .font(.system(size: 10))
                        .foregroundStyle(TSMStyle.pale)
                }
            }
            HStack(spacing: 10) {
                metricTile(title: "CITY FABRIC", value: city.importedSummary == nil ? "PROCEDURAL" : "IMPORTED", unit: "Not a certified survey", tint: TSMStyle.cyan)
                metricTile(title: "HYDRAULICS", value: "NOT RUN", unit: "Model evidence absent", tint: TSMStyle.lilac)
            }
        }
    }

    private var gaugesContent: some View {
        VStack(spacing: 12) {
            GlassPanel {
                VStack(alignment: .leading, spacing: 10) {
                    sectionTitle("AUTHORITY FEEDS", icon: "antenna.radiowaves.left.and.right")
                    Text(observations.statusMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(TSMStyle.pale)
                    Button {
                        Task { await observations.refresh() }
                    } label: {
                        Label(observations.isFetching ? "QUERYING USGS…" : "REFRESH OFFICIAL USGS STAGE",
                              systemImage: "arrow.clockwise")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TSMStyle.cyan)
                    .disabled(observations.isFetching)
                    Text("Online only when requested. Readings remain in GAGE_DATUM; NAVD88 conversion is disabled without verified metadata.")
                        .font(.system(size: 10))
                        .foregroundStyle(TSMStyle.pale)
                }
            }
            ForEach(observations.gauges) { gauge in
                GlassPanel {
                    VStack(alignment: .leading, spacing: 11) {
                        HStack {
                            Text("USGS / \(gauge.id)")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(TSMStyle.cyan)
                            Spacer()
                            Text(gauge.provenance.state.rawValue.replacingOccurrences(of: "_", with: " "))
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(.orange)
                        }
                        Text(gauge.siteName)
                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                        if let timestamp = gauge.measuredAtISO8601 {
                            Text("OBSERVED: " + timestamp + " • STAGE RELATIVE TO GAGE DATUM")
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundStyle(TSMStyle.pale)
                        }
                        HStack(alignment: .firstTextBaseline) {
                            Text(gauge.stageFeet.map { String(format: "%.2f ft", $0) } ?? "—")
                                .font(.system(size: 32, weight: .bold, design: .monospaced))
                                .foregroundStyle(.white)
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) {
                                Text("NAVD88 ELEVATION")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                    .foregroundStyle(TSMStyle.pale)
                                Text(gauge.waterSurfaceNAVD88Feet.map { String(format: "%.2f ft", $0) } ?? "UNVERIFIED")
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .foregroundStyle(.orange)
                            }
                        }
                        if let urlText = gauge.provenance.sourceURL, let url = URL(string: urlText) {
                            Link(destination: url) {
                                Label("OPEN OFFICIAL USGS STATION", systemImage: "arrow.up.right")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(TSMStyle.cyan)
                            }
                        }
                    }
                }
            }
            GlassPanel {
                VStack(alignment: .leading, spacing: 7) {
                    sectionTitle("GEODETIC SAFETY", icon: "checkmark.shield")
                    Text("USGS gauge stage is relative to its gauge datum. NAVD88 elevation requires a verified station-specific conversion. No conversion is performed without evidence.")
                        .font(.system(size: 12))
                        .foregroundStyle(TSMStyle.pale)
                }
            }
        }
    }

    private var studioContent: some View {
        VStack(spacing: 14) {
            GlassPanel {
                VStack(alignment: .leading, spacing: 18) {
                    sectionTitle("CONCEPT GEOMETRY CONTROLS", icon: "square.stack.3d.up")
                    Text("These controls change the illustrative 3D scene only. They do not compute water-surface elevation, freeboard, runoff, cut/fill, or structural stability.")
                        .font(.system(size: 12))
                        .foregroundStyle(TSMStyle.pale)
                    scenarioSlider("BERM RISE", value: Binding(
                        get: { scenario.bermRiseMeters },
                        set: { scenario.bermRiseMeters = $0; city.updateScenario(scenario) }),
                        range: 0...4, tint: TSMStyle.lilac)
                    scenarioSlider("ROAD LIFT", value: Binding(
                        get: { scenario.roadRiseMeters },
                        set: { scenario.roadRiseMeters = $0; city.updateScenario(scenario) }),
                        range: 0...2, tint: TSMStyle.cyan)
                    scenarioSlider("WATER SURFACE OFFSET (VISUAL)", value: Binding(
                        get: { scenario.waterVisualOffsetMeters },
                        set: { scenario.waterVisualOffsetMeters = $0; city.updateScenario(scenario) }),
                        range: -1...3, tint: .blue)
                    HStack(spacing: 8) {
                        Button("SAVE LOCAL PRESET") {
                            do {
                                let data = try JSONEncoder().encode(scenario)
                                UserDefaults.standard.set(data, forKey: "tsm.ios.concept.scenario.v1")
                                scenarioMessage = "Saved on this device • visual-only preset"
                            } catch {
                                scenarioMessage = "Could not save preset: " + error.localizedDescription
                            }
                        }
                        Button("RESTORE PRESET") {
                            if let bytes = UserDefaults.standard.data(forKey: "tsm.ios.concept.scenario.v1"),
                               let restored = try? JSONDecoder().decode(ScenarioSettings.self, from: bytes) {
                                scenario = ScenarioSettings(bermRiseMeters: restored.bermRiseMeters,
                                    roadRiseMeters: restored.roadRiseMeters,
                                    waterVisualOffsetMeters: restored.waterVisualOffsetMeters)
                                city.updateScenario(scenario)
                                scenarioMessage = "Restored local concept preset"
                            } else {
                                scenarioMessage = "No valid saved preset"
                            }
                        }
                    }
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .buttonStyle(.bordered)
                    .tint(TSMStyle.cyan)
                    if let scenarioMessage {
                        Text(scenarioMessage)
                            .font(.system(size: 10))
                            .foregroundStyle(TSMStyle.pale)
                    }
                    Button {
                        scenario = ScenarioSettings()
                        city.updateScenario(scenario)
                    } label: {
                        Label("RESET CONCEPT", systemImage: "arrow.counterclockwise")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .frame(maxWidth: .infinity)
                            .padding(13)
                            .background(TSMStyle.cyan.opacity(0.13), in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(TSMStyle.cyan)
                    }
                }
            }
            GlassPanel {
                VStack(alignment: .leading, spacing: 9) {
                    sectionTitle("ENGINEERING RELEASE GATES", icon: "list.bullet.rectangle.portrait")
                    gate("Authoritative topography", detail: "Not loaded", icon: "mountain.2")
                    gate("FEMA effective NFHL", detail: "Not loaded", icon: "map")
                    gate("Validated model run", detail: "Not available", icon: "waveform.path.ecg")
                    gate("Licensed survey review", detail: "Not evidenced", icon: "checkmark.seal")
                }
            }
        }
    }

    private func scenarioSlider(_ label: String, value: Binding<Double>,
                                range: ClosedRange<Double>, tint: Color) -> some View {
        VStack(spacing: 5) {
            HStack {
                Text(label)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(TSMStyle.pale)
                Spacer()
                Text(String(format: "%.1f m", value.wrappedValue))
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(tint)
            }
            Slider(value: value, in: range, step: 0.1).tint(tint)
                .accessibilityLabel(label)
        }
    }

    private func sectionTitle(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.system(size: 11, weight: .heavy, design: .monospaced))
            .tracking(0.8)
            .foregroundStyle(.white)
    }

    private func gate(_ title: String, detail: String, icon: String) -> some View {
        HStack(spacing: 9) {
            Image(systemName: icon).foregroundStyle(TSMStyle.cyan).frame(width: 22)
            Text(title).font(.system(size: 12)).foregroundStyle(.white)
            Spacer()
            Text(detail).font(.system(size: 10, design: .monospaced)).foregroundStyle(.orange)
        }
        .padding(.vertical, 5)
    }

    private func metricTile(title: String, value: String, unit: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                .foregroundStyle(TSMStyle.pale)
            Text(value)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(unit)
                .font(.system(size: 10))
                .foregroundStyle(TSMStyle.pale)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(TSMStyle.panel, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(TSMStyle.border))
    }

    private var disclaimer: some View {
        HStack(alignment: .top, spacing: 7) {
            Image(systemName: "info.circle").foregroundStyle(.orange)
            Text(site.disclaimer)
                .font(.system(size: 10))
                .foregroundStyle(TSMStyle.pale)
        }
        .padding(5)
    }

    private var bottomNavigation: some View {
        HStack(spacing: 8) {
            ForEach(OperatorTab.allCases) { tab in
                Button { withAnimation(.easeInOut(duration: 0.24)) { activeTab = tab } } label: {
                    VStack(spacing: 5) {
                        Image(systemName: tab.icon).font(.system(size: 18, weight: .semibold))
                        Text(tab.rawValue)
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                    }
                    .foregroundStyle(activeTab == tab ? TSMStyle.cyan : TSMStyle.pale)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(activeTab == tab ? TSMStyle.cyan.opacity(0.11) : Color.clear,
                                in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
        .padding(8)
        .background(TSMStyle.panel)
        .overlay(alignment: .top) { Rectangle().fill(TSMStyle.border).frame(height: 1) }
    }
}
