import Foundation
import SceneKit
import UIKit
import Combine

/// A local, deliberately illustrative city/river diorama.
/// Scene geometry is NOT survey, lidar, FEMA, or HEC-RAS input.
final class CitySceneController: ObservableObject {
    enum CameraMode: String, CaseIterable, Identifiable {
        case orbit = "Orbit"
        case drone = "Drone"
        case cinema = "Cinema"
        var id: String { rawValue }
    }

    enum MapLayer: String, CaseIterable, Identifiable {
        case buildings = "Buildings"
        case river = "Water"
        case corridors = "Roads"
        case grid = "Survey grid"
        var id: String { rawValue }
    }

    let scene = SCNScene()
    @Published private(set) var selectedAsset = "Tap a structure to inspect"
    @Published private(set) var cameraMode: CameraMode = .orbit
    @Published private(set) var nightMode = false

    private var layerNodes: [MapLayer: SCNNode] = [:]
    private let cameraRig = SCNNode()
    private let cameraNode = SCNNode()
    private let focus = SCNNode()
    private let sun = SCNNode()
    private let fill = SCNNode()
    private let berm = SCNNode()
    private let accessRoad = SCNNode()
    private let river = SCNNode()
    private var terrainNode: SCNNode?
    private var conceptBuildings: SCNNode?
    private var importedBuildings: SCNNode?
    @Published private(set) var importedSummary: String?
    private var selectedNode: SCNNode?
    private var previousEmission: Any?

    init() {
        buildScene()
        changeCamera(to: .orbit)
    }

    private func material(_ color: UIColor, metalness: CGFloat = 0.05,
                          roughness: CGFloat = 0.82, emission: UIColor? = nil) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = color
        m.metalness.contents = metalness
        m.roughness.contents = roughness
        if let emission { m.emission.contents = emission }
        m.isDoubleSided = true
        return m
    }

    private func box(_ width: CGFloat, _ height: CGFloat, _ length: CGFloat,
                     color: UIColor, bevel: CGFloat = 0.05) -> SCNNode {
        let shape = SCNBox(width: width, height: height, length: length, chamferRadius: bevel)
        shape.firstMaterial = material(color)
        return SCNNode(geometry: shape)
    }

    private func landElevation(x: Float, z: Float) -> Float {
        let riverDistance = abs(x + z * 0.53)
        let riverCut = max(0, 5.8 - riverDistance) * 0.43
        return 0.1 + sinf(x * 0.14) * 0.64 + cosf(z * 0.14) * 0.48 - riverCut
    }

    private func buildTerrain() {
        let gridSteps = 60
        let size: Float = 52
        var vertices: [SCNVector3] = []
        var indices: [UInt32] = []
        for z in 0...gridSteps {
            for x in 0...gridSteps {
                let px = (Float(x) / Float(gridSteps) - 0.5) * size
                let pz = (Float(z) / Float(gridSteps) - 0.5) * size
                vertices.append(SCNVector3(px, landElevation(x: px, z: pz), pz))
            }
        }
        for z in 0..<gridSteps {
            for x in 0..<gridSteps {
                let a = UInt32(z * (gridSteps + 1) + x)
                let b = a + 1
                let c = a + UInt32(gridSteps + 1)
                let d = c + 1
                indices += [a, c, b, b, c, d]
            }
        }
        let source = SCNGeometrySource(vertices: vertices)
        let data = indices.withUnsafeBytes { Data($0) }
        let element = SCNGeometryElement(data: data, primitiveType: .triangles,
                                         primitiveCount: indices.count / 3,
                                         bytesPerIndex: MemoryLayout<UInt32>.size)
        let geometry = SCNGeometry(sources: [source], elements: [element])
        geometry.firstMaterial = material(UIColor(red: 0.09, green: 0.19, blue: 0.23, alpha: 1))
        let terrain = SCNNode(geometry: geometry)
        terrain.name = "Illustrative terrain — not GIS"
        terrainNode = terrain
        scene.rootNode.addChildNode(terrain)
    }

    private func buildCity() {
        let districtRoot = SCNNode()
        districtRoot.name = "ILLUSTRATIVE BUILDINGS"
        let facades: [UIColor] = [
            UIColor(red: 0.27, green: 0.39, blue: 0.51, alpha: 1),
            UIColor(red: 0.18, green: 0.43, blue: 0.52, alpha: 1),
            UIColor(red: 0.30, green: 0.29, blue: 0.45, alpha: 1),
            UIColor(red: 0.37, green: 0.42, blue: 0.47, alpha: 1)
        ]
        var identifier = 0
        for row in -6...6 {
            for col in -6...6 {
                let x = Float(col) * 3.65
                let z = Float(row) * 3.65
                // Leave the conceptual river and access corridor clear.
                if abs(x + 0.53 * z) < 5.6 || abs(x - 10) < 1.3 { continue }
                let height = CGFloat(1.0 + Double((col * col + row * row + 13) % 9) * 0.59)
                let baseY = landElevation(x: x, z: z)
                let footprint = SCNNode()
                identifier += 1
                footprint.name = String(format: "Concept structure %03d", identifier)
                let block = box(2.45, height, 2.4, color: facades[identifier % facades.count], bevel: 0.10)
                block.position.y = Float(height) / 2
                footprint.addChildNode(block)
                let crown = box(2.55, 0.11, 2.5,
                                color: UIColor(red: 0.27, green: 0.77, blue: 0.82, alpha: 1), bevel: 0)
                crown.position.y = Float(height) + 0.06
                crown.opacity = 0.76
                footprint.addChildNode(crown)
                if height > 3.4 {
                    let beacon = SCNNode(geometry: SCNSphere(radius: 0.10))
                    beacon.geometry?.firstMaterial = material(.cyan, emission: .cyan)
                    beacon.position = SCNVector3(0, Float(height) + 0.24, 0)
                    footprint.addChildNode(beacon)
                }
                footprint.position = SCNVector3(x, baseY, z)
                districtRoot.addChildNode(footprint)
            }
        }
        scene.rootNode.addChildNode(districtRoot)
        conceptBuildings = districtRoot
        layerNodes[.buildings] = districtRoot
    }

    private func buildRiver() {
        let root = SCNNode()
        let bed = SCNBox(width: 9, height: 0.08, length: 71, chamferRadius: 1.2)
        bed.firstMaterial = material(UIColor(red: 0.014, green: 0.47, blue: 0.69, alpha: 0.82),
                                    metalness: 0.4, roughness: 0.22,
                                    emission: UIColor(red: 0.0, green: 0.08, blue: 0.12, alpha: 1))
        river.geometry = bed
        river.position = SCNVector3(0, -1.15, 0)
        river.eulerAngles.y = -0.49
        river.runAction(.repeatForever(.sequence([
            .moveBy(x: 0, y: 0.065, z: 0, duration: 2.8),
            .moveBy(x: 0, y: -0.065, z: 0, duration: 2.8)
        ])))
        root.addChildNode(river)
        // A surface highlight adds movement without pretending to animate hydraulic velocity.
        for n in 0..<9 {
            let ribbon = box(0.065, 0.018, 3.1, color: UIColor.cyan.withAlphaComponent(0.65), bevel: 0)
            ribbon.opacity = 0.45
            ribbon.position = SCNVector3(Float((n % 3) - 1) * 1.9, 0.13,
                                         Float(n - 4) * 7.0)
            river.addChildNode(ribbon)
        }
        scene.rootNode.addChildNode(root)
        layerNodes[.river] = root
    }

    private func buildInfrastructure() {
        let root = SCNNode()
        for x: Float in [-16, 11, 19] {
            let road = box(0.76, 0.07, 52,
                           color: UIColor(red: 0.21, green: 0.29, blue: 0.34, alpha: 1), bevel: 0)
            road.position = SCNVector3(x, 0.32, 0)
            root.addChildNode(road)
        }
        for z: Float in [-16, 12] {
            let road = box(52, 0.07, 0.8,
                           color: UIColor(red: 0.21, green: 0.29, blue: 0.34, alpha: 1), bevel: 0)
            road.position = SCNVector3(0, 0.34, z)
            root.addChildNode(road)
        }
        berm.geometry = SCNBox(width: 25, height: 1, length: 0.85, chamferRadius: 0.16)
        berm.geometry?.firstMaterial = material(UIColor(red: 0.70, green: 0.35, blue: 0.98, alpha: 1),
                                               metalness: 0.12, roughness: 0.36)
        berm.position = SCNVector3(-7, 1.0, 11)
        berm.eulerAngles.y = -0.45
        berm.name = "Concept berm · non-engineered"
        root.addChildNode(berm)
        accessRoad.geometry = SCNBox(width: 1.5, height: 0.2, length: 23, chamferRadius: 0.1)
        accessRoad.geometry?.firstMaterial = material(UIColor(red: 0.94, green: 0.66, blue: 0.33, alpha: 1))
        accessRoad.position = SCNVector3(11, 0.46, -3)
        accessRoad.name = "Concept access road · non-engineered"
        root.addChildNode(accessRoad)
        scene.rootNode.addChildNode(root)
        layerNodes[.corridors] = root
    }

    private func buildSurveyGrid() {
        let root = SCNNode()
        let lineMaterial = material(UIColor(red: 0.11, green: 0.61, blue: 0.63, alpha: 1),
                                    emission: UIColor(red: 0.0, green: 0.03, blue: 0.03, alpha: 1))
        for v in stride(from: -24, through: 24, by: 4) {
            let alongX = SCNNode(geometry: SCNBox(width: 48, height: 0.015, length: 0.015,
                                                  chamferRadius: 0))
            alongX.geometry?.firstMaterial = lineMaterial
            alongX.position = SCNVector3(0, 0.43, Float(v))
            alongX.opacity = 0.3
            root.addChildNode(alongX)
            let alongZ = SCNNode(geometry: SCNBox(width: 0.015, height: 0.015, length: 48,
                                                  chamferRadius: 0))
            alongZ.geometry?.firstMaterial = lineMaterial
            alongZ.position = SCNVector3(Float(v), 0.43, 0)
            alongZ.opacity = 0.3
            root.addChildNode(alongZ)
        }
        root.isHidden = true
        scene.rootNode.addChildNode(root)
        layerNodes[.grid] = root
    }

    private func buildScene() {
        scene.background.contents = UIColor(red: 0.015, green: 0.032, blue: 0.09, alpha: 1)
        scene.fogColor = UIColor(red: 0.04, green: 0.09, blue: 0.18, alpha: 1)
        scene.fogStartDistance = 64
        scene.fogEndDistance = 125
        buildTerrain()
        buildRiver()
        buildCity()
        buildInfrastructure()
        buildSurveyGrid()

        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.castsShadow = true
        sun.light?.shadowRadius = 8
        sun.light?.shadowSampleCount = 16
        sun.light?.intensity = 1100
        sun.light?.color = UIColor(red: 1.0, green: 0.77, blue: 0.57, alpha: 1)
        sun.eulerAngles = SCNVector3(-0.75, 0.45, 0)
        scene.rootNode.addChildNode(sun)
        fill.light = SCNLight()
        fill.light?.type = .ambient
        fill.light?.intensity = 340
        fill.light?.color = UIColor(red: 0.44, green: 0.68, blue: 1.0, alpha: 1)
        scene.rootNode.addChildNode(fill)

        focus.position = SCNVector3(0, 0, 0)
        scene.rootNode.addChildNode(focus)
        cameraNode.camera = SCNCamera()
        cameraNode.camera?.usesOrthographicProjection = true
        cameraNode.camera?.orthographicScale = 43
        cameraNode.camera?.zNear = 0.1
        cameraNode.camera?.zFar = 300
        cameraNode.constraints = [SCNLookAtConstraint(target: focus)]
        cameraRig.addChildNode(cameraNode)
        scene.rootNode.addChildNode(cameraRig)
    }

    var pointOfView: SCNNode { cameraNode }

    func changeCamera(to mode: CameraMode) {
        cameraMode = mode
        cameraRig.removeAllActions()
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 1.25
        switch mode {
        case .orbit:
            cameraRig.eulerAngles = SCNVector3Zero
            cameraNode.position = SCNVector3(37, 34, 37)
            cameraNode.camera?.orthographicScale = 43
        case .drone:
            cameraRig.eulerAngles = SCNVector3Zero
            cameraNode.position = SCNVector3(-6, 57, 12)
            cameraNode.camera?.orthographicScale = 54
        case .cinema:
            cameraRig.eulerAngles = SCNVector3Zero
            cameraNode.position = SCNVector3(33, 26, 33)
            cameraNode.camera?.orthographicScale = 40
        }
        SCNTransaction.commit()
        if mode == .cinema {
            cameraRig.runAction(.repeatForever(.rotateBy(x: 0, y: CGFloat.pi * 2, z: 0,
                                                         duration: 56)))
        }
    }

    func setNight(_ night: Bool) {
        nightMode = night
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 1.5
        sun.light?.intensity = night ? 135 : 1100
        fill.light?.intensity = night ? 210 : 340
        scene.background.contents = night ? UIColor(red: 0.008, green: 0.013, blue: 0.038, alpha: 1)
                                          : UIColor(red: 0.015, green: 0.032, blue: 0.09, alpha: 1)
        SCNTransaction.commit()
    }

    func setLayer(_ layer: MapLayer, visible: Bool) {
        layerNodes[layer]?.isHidden = !visible
    }

    func updateScenario(_ scenario: ScenarioSettings) {
        let bermHeight = Float(scenario.bermRiseMeters)
        let roadHeight = Float(scenario.roadRiseMeters)
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.55
        // Scene units are metres. Presentation height only; no hydraulic result.
        berm.scale.y = max(0.02, bermHeight)
        berm.position.y = 0.55 + bermHeight / 2
        accessRoad.position.y = 0.42 + roadHeight
        river.position.y = -1.15 + Float(scenario.waterVisualOffsetMeters)
        SCNTransaction.commit()
    }

    func selectNode(_ node: SCNNode) {
        var candidate: SCNNode? = node
        while let current = candidate, current !== scene.rootNode {
            if let name = current.name, (name.hasPrefix("Concept") || name.hasPrefix("Imported")) {
                if let prior = selectedNode { prior.geometry?.firstMaterial?.emission.contents = previousEmission }
                let visible = current.geometry != nil ? current :
                    (current.childNodes.first { $0.geometry != nil } ?? current)
                selectedNode = visible
                previousEmission = visible.geometry?.firstMaterial?.emission.contents
                visible.geometry?.firstMaterial?.emission.contents = UIColor(red: 0.18, green: 0.75, blue: 0.91, alpha: 1)
                selectedAsset = name
                return
            }
            candidate = current.parent
        }
        selectedAsset = "Terrain (illustrative)"
    }
    /// Adds a checksummed (but still unreviewed) geospatial bounding-box preview.
    /// The entire scene is display-scaled to fit; dimensions are NOT survey tools.
    func loadOfflineScene(_ payload: OfflineScene) throws {
        try payload.validate()
        let minE = payload.buildings.map(\.eastMeters).min() ?? 0
        let maxE = payload.buildings.map(\.eastMeters).max() ?? 0
        let minN = payload.buildings.map(\.northMeters).min() ?? 0
        let maxN = payload.buildings.map(\.northMeters).max() ?? 0
        let span = max(maxE - minE, maxN - minN, 30)
        let displayScale = Float(min(1, 48 / span))
        let centerE = Float((minE + maxE) / 2)
        let centerN = Float((minN + maxN) / 2)
        let root = SCNNode()
        root.name = "CHECKSUMMED PREVIEW — NOT A CERTIFIED SURVEY"
        for (index, source) in payload.buildings.enumerated() {
            let node = SCNNode()
            node.name = "Imported structure " + source.id
            let geometry = SCNBox(width: CGFloat(source.widthMeters),
                                  height: CGFloat(source.heightMeters),
                                  length: CGFloat(source.depthMeters), chamferRadius: 0)
            let tint: UIColor = index % 3 == 0
                ? UIColor(red: 0.22, green: 0.64, blue: 0.77, alpha: 1)
                : UIColor(red: 0.32, green: 0.38, blue: 0.58, alpha: 1)
            geometry.firstMaterial = material(tint, metalness: 0.15, roughness: 0.7)
            node.geometry = geometry
            node.position = SCNVector3(Float(source.eastMeters) - centerE,
                                       Float(source.baseMeters + source.heightMeters / 2),
                                       -(Float(source.northMeters) - centerN))
            node.eulerAngles.y = Float(source.rotationDegrees * .pi / 180)
            root.addChildNode(node)
        }
        root.scale = SCNVector3(displayScale, displayScale, displayScale)
        importedBuildings?.removeFromParentNode()
        scene.rootNode.addChildNode(root)
        importedBuildings = root
        conceptBuildings?.isHidden = true
        terrainNode?.isHidden = true
        layerNodes[.river]?.isHidden = true
        layerNodes[.corridors]?.isHidden = true
        layerNodes[.grid]?.isHidden = true
        layerNodes[.buildings] = root
        selectedAsset = "Imported subset — SHA checked, source UNREVIEWED"
        importedSummary = "\(payload.buildings.count) bounds preview • \(payload.horizontalCRS) • \(payload.verticalDatum) • display scale \(String(format: "%.4f", displayScale))×"
        changeCamera(to: .orbit)
    }

    func restoreConceptCity() {
        importedBuildings?.removeFromParentNode()
        importedBuildings = nil
        importedSummary = nil
        terrainNode?.isHidden = false
        conceptBuildings?.isHidden = false
        layerNodes[.river]?.isHidden = false
        layerNodes[.corridors]?.isHidden = false
        layerNodes[.grid]?.isHidden = true
        if let conceptBuildings { layerNodes[.buildings] = conceptBuildings }
        selectedAsset = "Tap a concept structure to inspect"
        changeCamera(to: .orbit)
    }

}
