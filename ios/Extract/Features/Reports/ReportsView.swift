import SwiftUI
import Charts

struct ReportsView: View {
    @Environment(Store.self) private var store
    @State private var months = 6
    @State private var transactions: [Transaction] = []
    @State private var error: String?

    private struct MonthTotal: Identifiable {
        let month: Date
        let kind: String
        let amount: Double
        var id: String { "\(month.timeIntervalSince1970)-\(kind)" }
    }

    private var monthStarts: [Date] {
        let cal = Calendar.current
        let thisMonth = cal.startOfMonth(Date())
        return (0..<months).reversed().compactMap { cal.date(byAdding: .month, value: -$0, to: thisMonth) }
    }

    private func monthOf(_ date: Date) -> Date { Calendar.current.startOfMonth(date) }

    private var totals: [MonthTotal] {
        monthStarts.flatMap { m -> [MonthTotal] in
            let list = transactions.filter { monthOf($0.date) == m }
            return [
                MonthTotal(month: m, kind: "Income", amount: list.filter { $0.type == .income }.reduce(0) { $0 + $1.amount }),
                MonthTotal(month: m, kind: "Spending", amount: list.filter { $0.type == .expense }.reduce(0) { $0 + $1.amount }),
            ]
        }
    }

    private var categoryTotals: [(CategoryOption, Double)] {
        let groups = Dictionary(grouping: transactions.filter { $0.type == .expense }, by: \.category)
        return groups.map { (store.preferences.category($0.key), $0.value.reduce(0) { $0 + $1.amount }) }.sorted { $0.1 > $1.1 }
    }

    private var savingsRate: Double? {
        let income = transactions.filter { $0.type == .income }.reduce(0) { $0 + $1.amount }
        let spent = transactions.filter { $0.type == .expense }.reduce(0) { $0 + $1.amount }
        return income > 0 ? (income - spent) / income : nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Picker("Period", selection: $months) {
                        Text("3 months").tag(3)
                        Text("6 months").tag(6)
                        Text("12 months").tag(12)
                    }
                    .pickerStyle(.segmented)

                    VStack(alignment: .leading) {
                        Text("Income vs spending").font(.headline)
                        Chart(totals) { item in
                            BarMark(
                                x: .value("Month", item.month, unit: .month),
                                y: .value("Amount", item.amount)
                            )
                            .foregroundStyle(by: .value("Kind", item.kind))
                            .position(by: .value("Kind", item.kind))
                        }
                        .chartForegroundStyleScale(["Income": Color.green, "Spending": Color.pink])
                        .chartXAxis {
                            AxisMarks(values: .stride(by: .month)) { _ in
                                AxisValueLabel(format: .dateTime.month(.narrow))
                            }
                        }
                        .frame(height: 220)
                    }
                    .card()

                    if let rate = savingsRate {
                        StatCard(
                            title: "Savings rate",
                            value: rate.formatted(.percent.precision(.fractionLength(0))),
                            color: rate >= 0 ? .green : .red,
                            caption: "Share of income not spent over the period"
                        )
                    }

                    if !categoryTotals.isEmpty {
                        VStack(alignment: .leading) {
                            Text("Spending by category").font(.headline)
                            Chart(categoryTotals, id: \.0.value) { category, amount in
                                SectorMark(angle: .value("Amount", amount), innerRadius: .ratio(0.6), angularInset: 1)
                                    .foregroundStyle(Palette.color(category.color))
                            }
                            .frame(height: 200)
                            ForEach(categoryTotals, id: \.0.value) { category, amount in
                                HStack {
                                    Circle().fill(Palette.color(category.color)).frame(width: 10, height: 10)
                                    Text(category.label)
                                    Spacer()
                                    Text(Money.format(amount, currency: store.currency)).monospacedDigit()
                                }
                                .font(.subheadline)
                            }
                        }
                        .card()
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Reports")
            .task(id: "\(months)-\(store.revision)") { await load() }
            .refreshable { await load() }
            .errorAlert($error)
        }
    }

    private func load() async {
        guard let first = monthStarts.first else { return }
        do {
            transactions = try await store.transactions(from: first, to: Date())
        } catch {
            if !error.isCancellation { self.error = error.localizedDescription }
        }
    }
}
