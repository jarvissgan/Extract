import Foundation

enum TransactionType: String, Codable, CaseIterable, Identifiable {
    case expense, income
    var id: String { rawValue }
    var label: String { self == .expense ? "Expense" : "Income" }
}

struct CategoryOption: Codable, Hashable, Identifiable {
    var value: String
    var label: String
    var color: String
    var id: String { value }
}

let builtinCategories: [CategoryOption] = [
    .init(value: "food", label: "Food & dining", color: "orange.6"),
    .init(value: "groceries", label: "Groceries", color: "lime.7"),
    .init(value: "transport", label: "Transport", color: "teal.6"),
    .init(value: "shopping", label: "Shopping", color: "pink.6"),
    .init(value: "bills", label: "Bills & subscriptions", color: "indigo.6"),
    .init(value: "housing", label: "Housing", color: "blue.6"),
    .init(value: "entertainment", label: "Entertainment", color: "grape.6"),
    .init(value: "health", label: "Health", color: "red.6"),
    .init(value: "travel", label: "Travel", color: "cyan.6"),
    .init(value: "transfers", label: "Transfers", color: "violet.6"),
    .init(value: "other", label: "Other", color: "gray.6"),
    .init(value: "income", label: "Income", color: "green.6"),
]

let categoryColors = ["grape.6", "pink.6", "cyan.6", "lime.6", "yellow.6", "indigo.6", "red.6", "violet.6"]
let currencies = ["USD", "SGD", "EUR", "GBP", "AUD", "CAD", "MYR", "JPY", "CNY", "INR", "HKD", "NZD"]

struct TransactionDetails: Codable, Hashable {
    var category: String = "other"
    var transaction_note: String = ""
    var date_only: Bool?

    init(category: String = "other", transaction_note: String = "", date_only: Bool? = nil) {
        self.category = category
        self.transaction_note = transaction_note
        self.date_only = date_only
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = (try? c.decode(String.self, forKey: .category)) ?? "other"
        transaction_note = (try? c.decode(String.self, forKey: .transaction_note)) ?? ""
        date_only = try? c.decode(Bool.self, forKey: .date_only)
    }
}

struct Transaction: Decodable, Identifiable, Hashable {
    var id: String
    var type: TransactionType
    var name: String
    var amount: Double
    var details: TransactionDetails
    var date: Date
    var updatedAt: Date?
    var recurring: Bool

    var category: String { details.category }
    var note: String { details.transaction_note }
    var dateOnly: Bool { details.date_only ?? false }
    /// Spending counts as negative, income as positive.
    var signedAmount: Double { type == .income ? amount : -amount }

    enum CodingKeys: String, CodingKey {
        case transaction_uuid, transaction_type, transaction_name, transaction_amount, transaction_details
        case created_timestamp, updated_timestamp, recurring_uuid
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .transaction_uuid)
        type = (try? c.decode(TransactionType.self, forKey: .transaction_type)) ?? .expense
        name = (try? c.decode(String.self, forKey: .transaction_name)) ?? ""
        amount = c.flexDouble(.transaction_amount)
        details = c.jsonColumn(TransactionDetails.self, .transaction_details) ?? TransactionDetails()
        date = ISODate.parse(try? c.decode(String.self, forKey: .created_timestamp)) ?? Date()
        updatedAt = ISODate.parse(try? c.decode(String.self, forKey: .updated_timestamp))
        recurring = (try? c.decode(String.self, forKey: .recurring_uuid)) != nil
    }
}

/// Body for POST/PUT /transaction.
struct TransactionInput: Encodable {
    var transaction_type: TransactionType
    var transaction_name: String
    var transaction_amount: Double
    var transaction_details: TransactionDetails
    var transaction_date: String?
}

struct Suggestion: Decodable, Hashable {
    var name: String
    var type: TransactionType
    var amount: Double
    var details: TransactionDetails

    enum CodingKeys: String, CodingKey { case name, type, amount, details }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        type = (try? c.decode(TransactionType.self, forKey: .type)) ?? .expense
        amount = c.flexDouble(.amount)
        details = c.jsonColumn(TransactionDetails.self, .details) ?? TransactionDetails()
    }
}

struct CategoryRule: Codable, Hashable {
    var pattern: String
    var category: String
}

struct Budgets: Codable, Hashable {
    var monthly: Double?
    var categories: [String: Double] = [:]

    init(monthly: Double? = nil, categories: [String: Double] = [:]) {
        self.monthly = monthly
        self.categories = categories
    }

    enum CodingKeys: String, CodingKey { case monthly, categories }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        monthly = try? c.decode(Double.self, forKey: .monthly) // "" means none
        categories = (try? c.decode([String: Double].self, forKey: .categories)) ?? [:]
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(monthly, forKey: .monthly)
        try c.encode(categories, forKey: .categories)
    }
}

struct Preferences: Codable, Hashable {
    var budgets = Budgets()
    var rules: [CategoryRule] = []
    var notifications = Notifications()
    var currency = "USD"
    var categories: [CategoryOption] = []

    struct Notifications: Codable, Hashable { var email = false }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        budgets = (try? c.decode(Budgets.self, forKey: .budgets)) ?? Budgets()
        rules = (try? c.decode([CategoryRule].self, forKey: .rules)) ?? []
        notifications = (try? c.decode(Notifications.self, forKey: .notifications)) ?? Notifications()
        currency = (try? c.decode(String.self, forKey: .currency)) ?? "USD"
        categories = (try? c.decode([CategoryOption].self, forKey: .categories)) ?? []
    }

    /// Built-in categories plus the user's own.
    var allCategories: [CategoryOption] {
        builtinCategories + categories.filter { c in !builtinCategories.contains { $0.value == c.value } }
    }

    func category(_ key: String) -> CategoryOption {
        allCategories.first { $0.value == key } ?? CategoryOption(value: key, label: key.capitalized, color: "gray.6")
    }

    /// Category from the user's "name contains" rules (first match wins).
    func categoryFromRules(_ name: String) -> String? {
        let lower = name.lowercased()
        return rules.first { lower.contains($0.pattern.lowercased()) }?.category
    }
}

struct UserAccount: Decodable {
    var user_sqid: String
    var username: String
    var email: String
    var preferences: Preferences
    var user_details: JSONValue
    var account_status: JSONValue

    enum CodingKeys: String, CodingKey { case user_sqid, username, email, preference_json, user_details, account_status }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        user_sqid = try c.decode(String.self, forKey: .user_sqid)
        username = (try? c.decode(String.self, forKey: .username)) ?? ""
        email = (try? c.decode(String.self, forKey: .email)) ?? ""
        preferences = c.jsonColumn(Preferences.self, .preference_json) ?? Preferences()
        user_details = c.jsonColumn(JSONValue.self, .user_details) ?? .object([:])
        account_status = c.jsonColumn(JSONValue.self, .account_status) ?? .object(["status": .string("active")])
    }
}

/// Body for POST /user and PUT /user/:sqid.
struct UserInput: Encodable {
    var username: String
    var user_details: JSONValue = .object([:])
    var preference_json: Preferences
    var account_status: JSONValue = .object(["status": .string("active")])
}

struct RecurringRule: Decodable, Identifiable, Hashable {
    var id: String
    var type: TransactionType
    var name: String
    var amount: Double
    var category: String
    var note: String
    var dayOfMonth: Int
    var active: Bool

    enum CodingKeys: String, CodingKey { case recurring_uuid, transaction_type, name, amount, category, note, day_of_month, active }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .recurring_uuid)
        type = (try? c.decode(TransactionType.self, forKey: .transaction_type)) ?? .expense
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        amount = c.flexDouble(.amount)
        category = (try? c.decode(String.self, forKey: .category)) ?? "other"
        note = (try? c.decode(String.self, forKey: .note)) ?? ""
        dayOfMonth = Int(c.flexDouble(.day_of_month))
        active = c.flexBool(.active, default: true)
    }
}

struct RecurringInput: Encodable {
    var transaction_type: TransactionType
    var name: String
    var amount: Double
    var category: String
    var note: String
    var day_of_month: Int
    var active: Bool
}

let goalColors = ["pink", "grape", "violet", "blue", "teal", "lime", "yellow", "orange"]

struct SavingsGoal: Decodable, Identifiable, Hashable {
    var id: String
    var name: String
    var target: Double
    var targetDate: String?
    var emoji: String?
    var color: String
    var reachedAt: Date?
    var saved: Double
    var entryCount: Int

    var progress: Double { target > 0 ? min(1, saved / target) : 0 }

    enum CodingKeys: String, CodingKey {
        case goal_uuid, name, target_amount, target_date, emoji, color, reached_timestamp, saved, entry_count
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .goal_uuid)
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        target = c.flexDouble(.target_amount)
        targetDate = try? c.decode(String.self, forKey: .target_date)
        emoji = try? c.decode(String.self, forKey: .emoji)
        color = (try? c.decode(String.self, forKey: .color)) ?? "pink"
        reachedAt = ISODate.parse(try? c.decode(String.self, forKey: .reached_timestamp))
        saved = c.flexDouble(.saved)
        entryCount = Int(c.flexDouble(.entry_count))
    }
}

struct SavingsGoalInput: Encodable {
    var name: String
    var target_amount: Double
    var target_date: String?
    var emoji: String?
    var color: String
}

struct SavingsEntry: Decodable, Identifiable, Hashable {
    var id: String
    var amount: Double
    var note: String?
    var date: Date

    enum CodingKeys: String, CodingKey { case entry_uuid, amount, note, created_timestamp }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .entry_uuid)
        amount = c.flexDouble(.amount)
        note = try? c.decode(String.self, forKey: .note)
        date = ISODate.parse(try? c.decode(String.self, forKey: .created_timestamp)) ?? Date()
    }
}

struct SavingsEntryInput: Encodable {
    var kind: String
    var amount: Double
    var note: String
}

struct SavingsEntryResult: Decodable {
    var goal: SavingsGoal
    var reached: Bool?
}

struct SavingsGoalResult: Decodable {
    var goal: SavingsGoal
}
