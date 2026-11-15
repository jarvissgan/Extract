import Foundation
import Observation

/// The signed-in user's account, shared by every screen.
@Observable
@MainActor
final class Store {
    enum Phase { case loading, needsSetup, ready, failed(String) }

    private(set) var phase: Phase = .loading
    private(set) var account: UserAccount?
    /// Bumped whenever transactions change, so open screens reload.
    private(set) var revision = 0

    var preferences: Preferences { account?.preferences ?? Preferences() }
    var currency: String { preferences.currency }
    var sqid: String { account?.user_sqid ?? "" }

    private let api = APIClient.shared

    func load() async {
        phase = .loading
        do {
            let (data, status) = try await api.raw("GET", "user")
            if status == 202 {
                account = nil
                phase = .needsSetup
                return
            }
            account = try JSONDecoder().decode(UserAccount.self, from: data)
            phase = .ready
        } catch let error as APIError where error.status == 401 {
            phase = .failed("Your session has ended. Please sign in again.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func createAccount(username: String, currency: String) async throws {
        var prefs = Preferences()
        prefs.currency = currency
        let _: JSONValue = try await api.post("user", UserInput(username: username, preference_json: prefs))
        await load()
    }

    /// Saves the username and preferences.
    func save(username: String? = nil, preferences: Preferences) async throws {
        guard let account else { return }
        let body = UserInput(
            username: username ?? account.username,
            user_details: account.user_details,
            preference_json: preferences,
            account_status: account.account_status
        )
        let _: JSONValue = try await api.put("user/\(account.user_sqid)", body)
        self.account?.preferences = preferences
        if let username { self.account?.username = username }
    }

    func deleteAccount() async throws {
        guard let account else { return }
        try await api.delete("user/\(account.user_sqid)")
        self.account = nil
    }

    func transactionsChanged() { revision += 1 }

    func reset() {
        account = nil
        phase = .loading
    }

    // MARK: - Transactions

    func transactions(from start: Date, to end: Date) async throws -> [Transaction] {
        try await api.get("transaction/user/\(sqid)", query: [
            "startDate": ISODate.string(start),
            "endDate": ISODate.string(end),
        ])
    }

    func save(_ input: TransactionInput, id: String?) async throws {
        if let id {
            let _: JSONValue = try await api.put("transaction/\(id)", input)
        } else {
            let _: JSONValue = try await api.post("transaction", input)
        }
        transactionsChanged()
    }

    func deleteTransaction(_ id: String) async throws {
        try await api.delete("transaction/\(id)")
        transactionsChanged()
    }

    func suggestions() async -> [Suggestion] {
        (try? await api.get("transaction/suggestions")) ?? []
    }
}

enum Money {
    static func format(_ amount: Double, currency: String, showSign: Bool = false) -> String {
        let style = FloatingPointFormatStyle<Double>.Currency(code: currency)
            .sign(strategy: showSign ? .always() : .automatic)
        return amount.formatted(style)
    }
}

extension Calendar {
    func startOfMonth(_ date: Date) -> Date {
        self.date(from: dateComponents([.year, .month], from: date)) ?? date
    }

    func endOfMonth(_ date: Date) -> Date {
        let start = startOfMonth(date)
        return self.date(byAdding: DateComponents(month: 1, second: -1), to: start) ?? date
    }
}
