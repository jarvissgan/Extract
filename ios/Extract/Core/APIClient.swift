import Foundation

struct APIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}

/// Talks to the Express API with the signed-in user's access token.
final class APIClient {
    static let shared = APIClient()

    /// Supplies the bearer token; set by AuthService.
    var tokenProvider: (() async throws -> String)?

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }()

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    struct Empty: Codable {}

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await send("GET", path, query: query, body: Optional<Empty>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, _ body: B) async throws -> T {
        try await send("POST", path, body: body)
    }

    func put<T: Decodable, B: Encodable>(_ path: String, _ body: B) async throws -> T {
        try await send("PUT", path, body: body)
    }

    @discardableResult
    func delete(_ path: String, query: [String: String] = [:]) async throws -> JSONValue {
        try await send("DELETE", path, query: query, body: Optional<Empty>.none)
    }

    func send<T: Decodable>(method: String, _ path: String, query: [String: String] = [:]) async throws -> T {
        try await send(method, path, query: query, body: Optional<Empty>.none)
    }

    /// Raw response, for endpoints whose status matters (GET /user answers 202 before setup).
    func raw(_ method: String, _ path: String, query: [String: String] = [:], body: Data? = nil,
             contentType: String = "application/json") async throws -> (Data, Int) {
        var components = URLComponents(url: AppConfig.apiBaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
            // "+" in time zone offsets must be escaped or the server reads it as a space
            components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        if let tokenProvider {
            request.setValue("Bearer \(try await tokenProvider())", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status >= 400 {
            let payload = try? JSONDecoder().decode([String: JSONValue].self, from: data)
            var message = "Request failed (\(status))."
            for key in ["error", "message"] {
                if case .string(let s)? = payload?[key] { message = s; break }
            }
            throw APIError(status: status, message: message)
        }
        return (data, status)
    }

    private func send<T: Decodable, B: Encodable>(_ method: String, _ path: String, query: [String: String] = [:], body: B?) async throws -> T {
        let data = try body.map { try encoder.encode($0) }
        let (response, _) = try await raw(method, path, query: query, body: data)
        if T.self == JSONValue.self, response.isEmpty { return JSONValue.null as! T }
        do {
            return try decoder.decode(T.self, from: response)
        } catch {
            throw APIError(status: 0, message: "Unexpected response from the server.")
        }
    }
}

extension Error {
    /// A request dropped because its screen went away; not worth showing.
    var isCancellation: Bool {
        self is CancellationError || (self as? URLError)?.code == .cancelled
    }
}
