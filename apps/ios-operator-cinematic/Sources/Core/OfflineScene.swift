import Foundation

/// Checked import format for an offline, preprojected visualization subset.
/// A checksum verifies byte integrity, NOT survey certification or authority.
public struct OfflineScene: Codable, Sendable {
    public let schema: String
    public let datasetID: String
    public let title: String
    public let authority: String
    public let horizontalCRS: String
    public let verticalDatum: String
    public let sourceSHA256: String
    public let transformReceipt: String
    public let originEastFeet: Double
    public let originNorthFeet: Double
    public let acquiredAt: String
    public let buildings: [OfflineBuilding]

    public init(schema: String = "tsm.ios.scene.v1", datasetID: String,
                title: String, authority: String, horizontalCRS: String,
                verticalDatum: String, sourceSHA256: String,
                transformReceipt: String, originEastFeet: Double, originNorthFeet: Double,
                acquiredAt: String, buildings: [OfflineBuilding]) {
        self.schema = schema
        self.datasetID = datasetID
        self.title = title
        self.authority = authority
        self.horizontalCRS = horizontalCRS
        self.verticalDatum = verticalDatum
        self.sourceSHA256 = sourceSHA256
        self.transformReceipt = transformReceipt
        self.originEastFeet = originEastFeet
        self.originNorthFeet = originNorthFeet
        self.acquiredAt = acquiredAt
        self.buildings = buildings
    }

    public func validate() throws {
        guard schema == "tsm.ios.scene.v1" else { throw SceneValidationError.invalidSchema }
        guard !datasetID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              datasetID.count <= 128,
              !title.isEmpty, title.count <= 180,
              !authority.isEmpty, authority.count <= 120,
              !horizontalCRS.isEmpty,
              !verticalDatum.isEmpty,
              !transformReceipt.isEmpty,
              originEastFeet.isFinite, originNorthFeet.isFinite,
              !acquiredAt.isEmpty,
              Self.isSHA256(sourceSHA256) else { throw SceneValidationError.missingEvidence }
        guard !buildings.isEmpty && buildings.count <= 6000 else {
            throw SceneValidationError.featureLimit
        }
        var knownIDs = Set<String>()
        for building in buildings {
            guard !building.id.isEmpty, building.id.count <= 100,
                  knownIDs.insert(building.id).inserted,
                  [building.eastMeters, building.northMeters, building.baseMeters,
                   building.widthMeters, building.depthMeters,
                   building.heightMeters, building.rotationDegrees].allSatisfy(\.isFinite),
                  abs(building.eastMeters) <= 50_000,
                  abs(building.northMeters) <= 50_000,
                  abs(building.baseMeters) <= 10_000,
                  building.widthMeters > 0, building.widthMeters <= 1_000,
                  building.depthMeters > 0, building.depthMeters <= 1_000,
                  building.heightMeters > 0, building.heightMeters <= 600,
                  abs(building.rotationDegrees) <= 360 else {
                throw SceneValidationError.invalidGeometry
            }
        }
    }

    private static func isSHA256(_ value: String) -> Bool {
        value.count == 64 && value.utf8.allSatisfy {
            (48...57).contains($0) || (97...102).contains($0)
        }
    }
}

public struct OfflineBuilding: Codable, Equatable, Sendable {
    public let id: String
    public let eastMeters: Double
    public let northMeters: Double
    public let baseMeters: Double
    public let widthMeters: Double
    public let depthMeters: Double
    public let heightMeters: Double
    public let rotationDegrees: Double
    public init(id: String, eastMeters: Double, northMeters: Double,
                baseMeters: Double, widthMeters: Double, depthMeters: Double,
                heightMeters: Double, rotationDegrees: Double = 0) {
        self.id = id
        self.eastMeters = eastMeters
        self.northMeters = northMeters
        self.baseMeters = baseMeters
        self.widthMeters = widthMeters
        self.depthMeters = depthMeters
        self.heightMeters = heightMeters
        self.rotationDegrees = rotationDegrees
    }
}

public enum SceneValidationError: Error, LocalizedError, Equatable {
    case invalidSchema
    case missingEvidence
    case featureLimit
    case invalidGeometry
    case oversizedEnvelope
    case badEnvelope
    case digestMismatch

    public var errorDescription: String? {
        switch self {
        case .invalidSchema: return "Unsupported offline scene schema."
        case .missingEvidence: return "Required source/projection evidence is missing."
        case .featureLimit: return "Offline scene must contain 1–6000 features per tile."
        case .invalidGeometry: return "Scene geometry is invalid or has duplicate IDs."
        case .oversizedEnvelope: return "Import exceeds the 12 MiB safety cap."
        case .badEnvelope: return "Malformed or unsupported signed-offline scene envelope."
        case .digestMismatch: return "Payload SHA-256 does not match the manifest."
        }
    }
}

/// JSON envelope stores the exact payload bytes as base64; hash validation
/// belongs to platform CryptoKit, so the portable core compiles on Linux.
public struct OfflineSceneEnvelope: Codable, Sendable {
    public let schema: String
    public let payloadBase64: String
    public let payloadSHA256: String
    public init(schema: String = "tsm.ios.envelope.v1", payloadBase64: String,
                payloadSHA256: String) {
        self.schema = schema
        self.payloadBase64 = payloadBase64
        self.payloadSHA256 = payloadSHA256
    }

    public func decodeUntrustedPayload() throws -> (data: Data, scene: OfflineScene) {
        guard schema == "tsm.ios.envelope.v1", payloadSHA256.count == 64,
              payloadSHA256.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }),
              let data = Data(base64Encoded: payloadBase64) else {
            throw SceneValidationError.badEnvelope
        }
        guard data.count <= 10_000_000 else { throw SceneValidationError.oversizedEnvelope }
        let scene = try JSONDecoder().decode(OfflineScene.self, from: data)
        try scene.validate()
        return (data, scene)
    }
}
