import Foundation

/// Any JSON value, for fields the app passes back unchanged.
enum JSONValue: Codable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

extension KeyedDecodingContainer {
    /// MySQL DECIMAL and SUM() arrive as strings ("12.50"); plain numbers as numbers.
    func flexDouble(_ key: Key) -> Double {
        if let v = try? decode(Double.self, forKey: key) { return v }
        if let s = try? decode(String.self, forKey: key) { return Double(s.replacingOccurrences(of: ",", with: "")) ?? 0 }
        return 0
    }

    /// TINYINT(1) columns arrive as 0/1 (or true/false).
    func flexBool(_ key: Key, default fallback: Bool = false) -> Bool {
        if let v = try? decode(Bool.self, forKey: key) { return v }
        if let v = try? decode(Int.self, forKey: key) { return v != 0 }
        if let s = try? decode(String.self, forKey: key) { return s == "1" || s == "true" }
        return fallback
    }

    /// JSON columns arrive either parsed or as a JSON string, depending on the database driver.
    func jsonColumn<T: Decodable>(_ type: T.Type, _ key: Key) -> T? {
        // a string holding JSON first, so JSONValue columns don't come back as .string("{...}")
        if let s = try? decode(String.self, forKey: key), let data = s.data(using: .utf8),
           let v = try? JSONDecoder().decode(T.self, from: data) {
            return v
        }
        return try? decode(T.self, forKey: key)
    }
}

/// The API sends and accepts ISO 8601 date-times ("2026-11-15T06:32:00.000Z").
enum ISODate {
    private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ s: String?) -> Date? {
        guard let s, !s.isEmpty else { return nil }
        return fractional.date(from: s) ?? plain.date(from: s)
    }

    static func string(_ date: Date) -> String { fractional.string(from: date) }
}

/// "YYYY-MM-DD" in the device's calendar and time zone.
enum DayString {
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func string(_ date: Date) -> String { formatter.string(from: date) }
    static func date(_ s: String?) -> Date? { s.flatMap { formatter.date(from: String($0.prefix(10))) } }
}
