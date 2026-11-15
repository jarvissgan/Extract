import Foundation

/// Parses one-line entries the same way as the website's quick-add bar:
///   "coffee 4.50", "4.50 coffee", "+3200 salary", "lunch 12 yesterday", "dinner 30 fri", "grab 15 #transport"
struct QuickAdd {
    var name = ""
    var amount: Double?
    var type: TransactionType = .expense
    var categoryHint: String?
    var daysAgo = 0

    private static let weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    private static let amountPattern = try! NSRegularExpression(pattern: #"^(\+)?[^\d\s+#-]{0,3}(\d{1,9}(?:[.,]\d{1,2})?)$"#)
    private static let weekdayWord = try! NSRegularExpression(
        pattern: #"^(sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?)$"#
    )

    static func parse(_ input: String, now: Date = Date(), calendar: Calendar = .current) -> QuickAdd {
        var result = QuickAdd()
        var nameParts: [String] = []
        for token in input.split(whereSeparator: \.isWhitespace).map(String.init) {
            let lower = token.lowercased()
            let range = NSRange(token.startIndex..., in: token)
            if result.amount == nil, let m = amountPattern.firstMatch(in: token, range: range),
               let numberRange = Range(m.range(at: 2), in: token) {
                result.amount = Double(token[numberRange].replacingOccurrences(of: ",", with: "."))
                if m.range(at: 1).location != NSNotFound { result.type = .income }
            } else if lower == "+" {
                result.type = .income
            } else if lower.hasPrefix("#"), lower.count > 1 {
                result.categoryHint = String(lower.dropFirst())
            } else if lower == "today" {
                result.daysAgo = 0
            } else if lower == "yesterday" || lower == "yday" {
                result.daysAgo = 1
            } else if weekdayWord.firstMatch(in: lower, range: NSRange(lower.startIndex..., in: lower)) != nil,
                      let index = weekdays.firstIndex(of: String(lower.prefix(3))) {
                let today = calendar.component(.weekday, from: now) - 1
                result.daysAgo = (today - index + 7) % 7
            } else {
                nameParts.append(token)
            }
        }
        result.name = nameParts.joined(separator: " ")
        return result
    }

    /// A category for a hint like "food", "Food" or "trans".
    static func matchCategory(_ hint: String?, in categories: [CategoryOption]) -> String? {
        guard let h = hint?.lowercased(), !h.isEmpty else { return nil }
        if let exact = categories.first(where: { $0.value == h || $0.label.lowercased() == h }) { return exact.value }
        return categories.first { $0.value.hasPrefix(h) || $0.label.lowercased().hasPrefix(h) }?.value
    }
}
