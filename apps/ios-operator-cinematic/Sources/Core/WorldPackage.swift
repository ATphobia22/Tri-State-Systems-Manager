import Foundation

/// A deliberately bounded offline rendering format. All coordinates and heights in
/// the geometry are LOCAL metres; geodetic transformations happen upstream.
/// A matching SHA-256 proves byte-level integrity, not source authenticity.
public struct WorldPackage: Codable, Sendable {
    public let format: String
    public let name: String
    public let createdAtISO8601: String
    public let provenance: WorldProvenance
    public let geometry: WorldGeometry
    public let geometrySHA256: String
    // Hash the exact stored JSON bytes, not a re-encoding that may differ
    // between Apple Foundation and Linux Foundation implementations.
    let geometryBytes: Data

    private enum CodingKeys: String, CodingKey {
        case format, name, createdAtISO8601, provenance, geometryBytes, geometrySHA256
    }

    init(format: String, name: String, createdAtISO8601: String,
         provenance: WorldProvenance, geometry: WorldGeometry,
         geometryBytes: Data, geometrySHA256: String) {
        self.format = format; self.name = name; self.createdAtISO8601 = createdAtISO8601
        self.provenance = provenance; self.geometry = geometry
        self.geometryBytes = geometryBytes; self.geometrySHA256 = geometrySHA256
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        format = try c.decode(String.self, forKey: .format)
        name = try c.decode(String.self, forKey: .name)
        createdAtISO8601 = try c.decode(String.self, forKey: .createdAtISO8601)
        provenance = try c.decode(WorldProvenance.self, forKey: .provenance)
        geometrySHA256 = try c.decode(String.self, forKey: .geometrySHA256)
        geometryBytes = try c.decode(Data.self, forKey: .geometryBytes)
        geometry = try JSONDecoder().decode(WorldGeometry.self, from: geometryBytes)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(format, forKey: .format)
        try c.encode(name, forKey: .name)
        try c.encode(createdAtISO8601, forKey: .createdAtISO8601)
        try c.encode(provenance, forKey: .provenance)
        try c.encode(geometrySHA256, forKey: .geometrySHA256)
        try c.encode(geometryBytes, forKey: .geometryBytes)
    }
}

public struct WorldProvenance: Codable, Equatable, Sendable {
    public let authority: String
    public let sourceDataset: String
    public let sourceURL: String?
    public let acquiredAtISO8601: String?
    public let sourceSHA256: String?
    public let reviewState: EvidenceState

    public init(authority: String, sourceDataset: String, sourceURL: String? = nil,
                acquiredAtISO8601: String? = nil, sourceSHA256: String? = nil,
                reviewState: EvidenceState = .illustrative) {
        self.authority = authority
        self.sourceDataset = sourceDataset
        self.sourceURL = sourceURL
        self.acquiredAtISO8601 = acquiredAtISO8601
        self.sourceSHA256 = sourceSHA256
        self.reviewState = reviewState
    }
}

public struct WorldPoint: Codable, Equatable, Sendable {
    public let x: Double
    public let z: Double
    public init(x: Double, z: Double) { self.x = x; self.z = z }
}

public struct WorldTerrain: Codable, Sendable {
    public let width: Int
    public let depth: Int
    public let cellSizeMeters: Double
    public let originX: Double
    public let originZ: Double
    public let elevationsMeters: [Double]

    public init(width: Int, depth: Int, cellSizeMeters: Double, originX: Double,
                originZ: Double, elevationsMeters: [Double]) {
        self.width = width; self.depth = depth; self.cellSizeMeters = cellSizeMeters
        self.originX = originX; self.originZ = originZ
        self.elevationsMeters = elevationsMeters
    }
}

public struct WorldBuilding: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let xMeters: Double
    public let zMeters: Double
    public let widthMeters: Double
    public let lengthMeters: Double
    public let heightMeters: Double

    public init(id: String, name: String, xMeters: Double, zMeters: Double,
                widthMeters: Double, lengthMeters: Double, heightMeters: Double) {
        self.id = id; self.name = name; self.xMeters = xMeters; self.zMeters = zMeters
        self.widthMeters = widthMeters; self.lengthMeters = lengthMeters
        self.heightMeters = heightMeters
    }
}

public struct WorldRiver: Codable, Sendable {
    public let centerline: [WorldPoint]
    public let widthMeters: Double
    public init(centerline: [WorldPoint], widthMeters: Double) {
        self.centerline = centerline; self.widthMeters = widthMeters
    }
}

public struct WorldGeometry: Codable, Sendable {
    public let coordinateFrame: String
    public let sourceHorizontalCRS: String
    public let sourceVerticalDatum: String
    public let sourceUnits: String
    public let geoidModel: String?
    public let localOriginLatitude: Double?
    public let localOriginLongitude: Double?
    public let terrain: WorldTerrain
    public let buildings: [WorldBuilding]
    public let river: WorldRiver?

    public init(coordinateFrame: String = "LOCAL_ENU_METERS",
                sourceHorizontalCRS: String, sourceVerticalDatum: String,
                sourceUnits: String, geoidModel: String? = nil,
                localOriginLatitude: Double? = nil, localOriginLongitude: Double? = nil,
                terrain: WorldTerrain, buildings: [WorldBuilding], river: WorldRiver? = nil) {
        self.coordinateFrame = coordinateFrame
        self.sourceHorizontalCRS = sourceHorizontalCRS
        self.sourceVerticalDatum = sourceVerticalDatum
        self.sourceUnits = sourceUnits
        self.geoidModel = geoidModel
        self.localOriginLatitude = localOriginLatitude
        self.localOriginLongitude = localOriginLongitude
        self.terrain = terrain; self.buildings = buildings; self.river = river
    }
}

public enum WorldPackageError: Error, LocalizedError, Equatable {
    case tooLarge
    case unsupportedFormat
    case checksumMismatch
    case invalidGeometry(String)

    public var errorDescription: String? {
        switch self {
        case .tooLarge: return "World package exceeds the 8 MB device import cap."
        case .unsupportedFormat: return "Unsupported TSM world package format."
        case .checksumMismatch: return "World geometry checksum does not match."
        case .invalidGeometry(let reason): return "Invalid world geometry: \(reason)"
        }
    }
}

public enum WorldPackageCodec {
    public static let format = "tsm.world.local-metric.v1"
    public static let maximumBytes = 8 * 1024 * 1024

    public static func encode(name: String, provenance: WorldProvenance,
                              geometry: WorldGeometry, createdAt: String = "1970-01-01T00:00:00Z") throws -> Data {
        try validate(geometry)
        let geometryBytes = try canonicalGeometry(geometry)
        let digest = SHA256Digest.hex(geometryBytes)
        let package = WorldPackage(format: format, name: name, createdAtISO8601: createdAt,
                                   provenance: provenance, geometry: geometry,
                                   geometryBytes: geometryBytes, geometrySHA256: digest)
        let data = try JSONEncoder().encode(package)
        if data.count > maximumBytes { throw WorldPackageError.tooLarge }
        return data
    }

    public static func decode(_ data: Data) throws -> WorldPackage {
        guard data.count <= maximumBytes else { throw WorldPackageError.tooLarge }
        let package = try JSONDecoder().decode(WorldPackage.self, from: data)
        guard package.format == format else { throw WorldPackageError.unsupportedFormat }
        guard package.name.count <= 160, !package.name.isEmpty,
              package.provenance.authority.count <= 160,
              !package.provenance.authority.isEmpty,
              !package.provenance.sourceDataset.isEmpty,
              package.provenance.sourceDataset.count <= 256 else {
            throw WorldPackageError.invalidGeometry("invalid provenance or title")
        }
        try validate(package.geometry)
        let expected = SHA256Digest.hex(package.geometryBytes)
        guard package.geometrySHA256 == expected else { throw WorldPackageError.checksumMismatch }
        return package
    }

    public static func canonicalGeometry(_ geometry: WorldGeometry) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(geometry)
    }

    public static func validate(_ world: WorldGeometry) throws {
        func fail(_ reason: String) -> WorldPackageError { .invalidGeometry(reason) }
        guard world.coordinateFrame == "LOCAL_ENU_METERS" else { throw fail("not local metric coordinates") }
        guard !world.sourceHorizontalCRS.isEmpty, world.sourceHorizontalCRS.count < 128,
              !world.sourceVerticalDatum.isEmpty, world.sourceVerticalDatum.count < 128,
              ["m", "ft", "ftUS", "unknown"].contains(world.sourceUnits) else {
            throw fail("source coordinate metadata missing")
        }
        if let lat = world.localOriginLatitude, !lat.isFinite || abs(lat) > 90 { throw fail("latitude") }
        if let lon = world.localOriginLongitude, !lon.isFinite || abs(lon) > 180 { throw fail("longitude") }
        let t = world.terrain
        guard (2...257).contains(t.width), (2...257).contains(t.depth),
              t.elevationsMeters.count == t.width * t.depth,
              t.cellSizeMeters.isFinite, (0.01...1000).contains(t.cellSizeMeters),
              t.originX.isFinite, t.originZ.isFinite,
              abs(t.originX) < 100_000, abs(t.originZ) < 100_000,
              t.elevationsMeters.allSatisfy({ $0.isFinite && abs($0) < 20_000 }) else {
            throw fail("terrain grid dimensions, bounds or elevations")
        }
        guard world.buildings.count <= 25_000 else { throw fail("building count cap") }
        var ids = Set<String>()
        for building in world.buildings {
            guard !building.id.isEmpty, building.id.count <= 128,
                  building.name.count <= 160, ids.insert(building.id).inserted,
                  [building.xMeters, building.zMeters, building.widthMeters,
                   building.lengthMeters, building.heightMeters].allSatisfy(\.isFinite),
                  (0.1...1000).contains(building.widthMeters),
                  (0.1...1000).contains(building.lengthMeters),
                  (0.1...1000).contains(building.heightMeters),
                  building.xMeters >= t.originX - 1000,
                  building.xMeters <= t.originX + Double(t.width - 1) * t.cellSizeMeters + 1000,
                  building.zMeters >= t.originZ - 1000,
                  building.zMeters <= t.originZ + Double(t.depth - 1) * t.cellSizeMeters + 1000 else {
                throw fail("building ID, footprint or position")
            }
        }
        if let river = world.river {
            guard river.centerline.count >= 2, river.centerline.count <= 2000,
                  river.widthMeters.isFinite, (0.1...1000).contains(river.widthMeters),
                  river.centerline.allSatisfy({ $0.x.isFinite && $0.z.isFinite &&
                      abs($0.x) < 100_000 && abs($0.z) < 100_000 }) else {
                throw fail("river centerline")
            }
        }
    }
}

/// Portable SHA-256 for on-device and Linux build/test parity.
/// SHA-256 is an integrity check only; this package format is not signed.
public enum SHA256Digest {
    private static let constants: [UInt32] = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]
    private static func rotate(_ v: UInt32, _ count: UInt32) -> UInt32 {
        (v >> count) | (v << (32 - count))
    }
    public static func hex(_ data: Data) -> String {
        var bytes = Array(data)
        let bits = UInt64(bytes.count) &* 8
        bytes.append(0x80)
        while bytes.count % 64 != 56 { bytes.append(0) }
        for shift in stride(from: 56, through: 0, by: -8) {
            bytes.append(UInt8((bits >> UInt64(shift)) & 0xff))
        }
        var h: [UInt32] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
                           0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
        for offset in stride(from: 0, to: bytes.count, by: 64) {
            var w = [UInt32](repeating: 0, count: 64)
            for i in 0..<16 {
                let j = offset + i * 4
                w[i] = UInt32(bytes[j]) << 24 | UInt32(bytes[j+1]) << 16 |
                       UInt32(bytes[j+2]) << 8 | UInt32(bytes[j+3])
            }
            for i in 16..<64 {
                let a = rotate(w[i-15], 7) ^ rotate(w[i-15], 18) ^ (w[i-15] >> 3)
                let b = rotate(w[i-2], 17) ^ rotate(w[i-2], 19) ^ (w[i-2] >> 10)
                w[i] = w[i-16] &+ a &+ w[i-7] &+ b
            }
            var a = h[0], b = h[1], c = h[2], d = h[3]
            var e = h[4], f = h[5], g = h[6], q = h[7]
            for i in 0..<64 {
                let s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
                let choice = (e & f) ^ (~e & g)
                let temp1 = q &+ s1 &+ choice &+ constants[i] &+ w[i]
                let s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
                let majority = (a & b) ^ (a & c) ^ (b & c)
                let temp2 = s0 &+ majority
                q = g; g = f; f = e; e = d &+ temp1
                d = c; c = b; b = a; a = temp1 &+ temp2
            }
            let state = [a,b,c,d,e,f,g,q]
            for i in 0..<8 { h[i] = h[i] &+ state[i] }
        }
        return h.map { String(format: "%08x", $0) }.joined()
    }
}
