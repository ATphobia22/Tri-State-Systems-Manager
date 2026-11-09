import Foundation

/// Persistent design concepts. These are not model outputs or approved designs.
public struct ScenarioRecord: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let savedAtISO8601: String
    public let linkedWorldSHA256: String?
    public let settings: ScenarioSettings
    public let status: String

    public init(id: UUID = UUID(), name: String, settings: ScenarioSettings,
                linkedWorldSHA256: String? = nil, savedAt: Date = Date()) {
        self.id = id
        self.name = String(name.prefix(80)).trimmingCharacters(in: .whitespacesAndNewlines)
        self.settings = settings
        self.linkedWorldSHA256 = linkedWorldSHA256
        self.savedAtISO8601 = ISO8601DateFormatter().string(from: savedAt)
        self.status = "ILLUSTRATIVE_ONLY"
    }
}

public enum ScenarioArchive {
    public static func encode(_ records: [ScenarioRecord]) throws -> Data {
        guard records.count <= 100 else { throw ArchiveError.tooMany }
        return try JSONEncoder().encode(records)
    }

    public static func decode(_ data: Data) throws -> [ScenarioRecord] {
        guard data.count <= 256_000 else { throw ArchiveError.tooLarge }
        let records = try JSONDecoder().decode([ScenarioRecord].self, from: data)
        guard records.count <= 100 else { throw ArchiveError.tooMany }
        guard records.allSatisfy({ $0.status == "ILLUSTRATIVE_ONLY" && !$0.name.isEmpty }) else {
            throw ArchiveError.invalidStatus
        }
        return records
    }

    public enum ArchiveError: Error { case tooMany, tooLarge, invalidStatus }
}
