import Foundation
import CryptoKit

/// Imports a bounded document, verifies the SHA-256 of the exact binary payload,
/// then applies the portable contract. NO arbitrary internet URLs are loaded.
enum OfflineSceneImporter {
    static func load(from url: URL) throws -> OfflineScene {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true,
              let size = values.fileSize, size <= 12_000_000 else {
            throw SceneValidationError.oversizedEnvelope
        }
        let json = try Data(contentsOf: url, options: [.mappedIfSafe])
        guard json.count <= 12_000_000 else { throw SceneValidationError.oversizedEnvelope }
        let envelope = try JSONDecoder().decode(OfflineSceneEnvelope.self, from: json)
        let decoded = try envelope.decodeUntrustedPayload()
        let digest = SHA256.hash(data: decoded.data).map { String(format: "%02x", $0) }.joined()
        guard digest == envelope.payloadSHA256 else { throw SceneValidationError.digestMismatch }
        return decoded.scene
    }
}
