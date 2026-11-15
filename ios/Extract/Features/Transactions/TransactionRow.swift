import SwiftUI

struct TransactionRow: View {
    @Environment(Store.self) private var store
    let transaction: Transaction
    var showDate = false

    var body: some View {
        let category = store.preferences.category(transaction.category)
        HStack(spacing: 12) {
            Circle()
                .fill(Palette.color(category.color).opacity(0.2))
                .frame(width: 36, height: 36)
                .overlay(
                    Text(String(transaction.name.prefix(1)).uppercased())
                        .font(.subheadline.bold())
                        .foregroundStyle(Palette.color(category.color))
                )
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(transaction.name).lineLimit(1)
                    if transaction.recurring {
                        Image(systemName: "repeat").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                Text(subtitle(category.label))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(Money.format(transaction.signedAmount, currency: store.currency, showSign: transaction.type == .income))
                .font(.body.monospacedDigit())
                .foregroundStyle(transaction.type == .income ? .green : .primary)
        }
        .padding(.vertical, 2)
    }

    private func subtitle(_ categoryLabel: String) -> String {
        var parts = [categoryLabel]
        if showDate { parts.append(transaction.date.formatted(.dateTime.day().month(.abbreviated))) }
        if !transaction.dateOnly { parts.append(transaction.date.formatted(date: .omitted, time: .shortened)) }
        return parts.joined(separator: " · ")
    }
}

/// "‹ November 2026 ›"
struct MonthSwitcher: View {
    @Binding var month: Date

    var body: some View {
        HStack {
            Button { shift(-1) } label: { Image(systemName: "chevron.left") }
            Text(month.formatted(.dateTime.month(.wide).year()))
                .font(.headline)
                .frame(minWidth: 150)
            Button { shift(1) } label: { Image(systemName: "chevron.right") }
                .disabled(Calendar.current.isDate(month, equalTo: Date(), toGranularity: .month))
        }
        .buttonStyle(.borderless)
    }

    private func shift(_ months: Int) {
        if let d = Calendar.current.date(byAdding: .month, value: months, to: month) { month = d }
    }
}
