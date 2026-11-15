import Foundation

/// Values from Config.xcconfig, passed through Info.plist.
enum AppConfig {
    private static func value(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?
            .trimmingCharacters(in: .whitespaces) ?? ""
    }

    static var apiBaseURL: URL {
        let raw = value("API_BASE_URL")
        return URL(string: raw.hasSuffix("/") ? String(raw.dropLast()) : raw) ?? URL(string: "http://localhost:3000/api")!
    }

    static var isDevAuth: Bool { value("AUTH_MODE").lowercased() != "auth0" }
    static var auth0Domain: String { value("AUTH0_DOMAIN") }
    static var auth0ClientID: String { value("AUTH0_CLIENT_ID") }
    static var auth0Audience: String { value("AUTH0_AUDIENCE") }
}
