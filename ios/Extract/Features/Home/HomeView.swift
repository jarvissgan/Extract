import SwiftUI

struct HomeView: View {
    @Environment(Store.self) private var store
    @State private var month = Calendar.current.startOfMonth(Date())
    @State private var current: [Transaction] = []
    @State private var previous: [Transaction] = []
    @State private var error: String?
    @State private var adding = false
    @State private var editing: Transaction?

    private func total(_ list: [Transaction], _ type: TransactionType) -> Double {
        list.filter { $0.type == type }.reduce(0) { $0 + $1.amount }
    }

    private var spent: Double { total(current, .expense) }
    private var income: Double { total(current, .income) }
    private var lastSpent: Double { total(previous, .expense) }

    private var byCategory: [(CategoryOption, Double)] {
        let groups = Dictionary(grouping: current.filter { $0.type == .expense }, by: \.category)
        return groups.map { (store.preferences.category($0.key), $0.value.reduce(0) { $0 + $1.amount }) }
            .sorted { $0.1 > $1.1 }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    MonthSwitcher(month: $month)

                    HStack(spacing: 12) {
                        StatCard(title: "Spent", value: Money.format(spent, currency: store.currency), color: .pink)
                        StatCard(title: "Income", value: Money.format(income, currency: store.currency), color: .green)
                    }
                    StatCard(
                        title: "Net",
                        value: Money.format(income - spent, currency: store.currency, showSign: true),
                        color: income - spent >= 0 ? .green : .red,
                        caption: comparison
                    )

                    if let budget = store.preferences.budgets.monthly, budget > 0 {
                        BudgetCard(title: "Monthly budget", spent: spent, budget: budget, currency: store.currency)
                    }

                    let categoryBudgets = store.preferences.budgets.categories.filter { $0.value > 0 }
                    if !categoryBudgets.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Category budgets").font(.headline)
                            ForEach(categoryBudgets.sorted { $0.key < $1.key }, id: \.key) { key, budget in
                                let used = current.filter { $0.type == .expense && $0.category == key }.reduce(0) { $0 + $1.amount }
                                BudgetBar(label: store.preferences.category(key).label, spent: used, budget: budget, currency: store.currency)
                            }
                        }
                        .card()
                    }

                    if !byCategory.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Where it went").font(.headline)
                            ForEach(byCategory, id: \.0.value) { category, amount in
                                HStack {
                                    Circle().fill(Palette.color(category.color)).frame(width: 10, height: 10)
                                    Text(category.label)
                                    Spacer()
                                    Text(Money.format(amount, currency: store.currency)).monospacedDigit()
                                    Text(spent > 0 ? "\(Int((amount / spent * 100).rounded()))%" : "")
                                        .font(.caption).foregroundStyle(.secondary).frame(width: 36, alignment: .trailing)
                                }
                            }
                        }
                        .card()
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Recent").font(.headline).padding(.bottom, 4)
                        if current.isEmpty {
                            Text("Nothing this month yet.").foregroundStyle(.secondary)
                        }
                        ForEach(current.prefix(8)) { t in
                            Button { editing = t } label: { TransactionRow(transaction: t, showDate: true) }
                                .foregroundStyle(.primary)
                            if t.id != current.prefix(8).last?.id { Divider() }
                        }
                    }
                    .card()
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Hi, \(store.account?.username ?? "")")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { adding = true } label: { Image(systemName: "plus") }
                }
            }
            .refreshable { await load() }
            .task(id: "\(month.timeIntervalSince1970)-\(store.revision)") { await load() }
            .sheet(isPresented: $adding) { TransactionForm() }
            .sheet(item: $editing) { TransactionForm(existing: $0) }
            .errorAlert($error)
        }
    }

    private var comparison: String? {
        guard lastSpent > 0 else { return nil }
        let change = (spent - lastSpent) / lastSpent * 100
        let pct = Int(abs(change).rounded())
        return change >= 0 ? "Spending up \(pct)% on last month" : "Spending down \(pct)% on last month"
    }

    private func load() async {
        let cal = Calendar.current
        let lastMonth = cal.date(byAdding: .month, value: -1, to: month) ?? month
        do {
            async let now = store.transactions(from: month, to: cal.endOfMonth(month))
            async let before = store.transactions(from: lastMonth, to: cal.endOfMonth(lastMonth))
            (current, previous) = try await (now, before)
        } catch {
            if !error.isCancellation { self.error = error.localizedDescription }
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    var color: Color = .accentColor
    var caption: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.subheadline).foregroundStyle(.secondary)
            Text(value).font(.title2.bold()).foregroundStyle(color).minimumScaleFactor(0.6).lineLimit(1)
            if let caption { Text(caption).font(.caption).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}

struct BudgetCard: View {
    let title: String
    let spent: Double
    let budget: Double
    let currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            BudgetBar(label: nil, spent: spent, budget: budget, currency: currency)
        }
        .card()
    }
}

struct BudgetBar: View {
    let label: String?
    let spent: Double
    let budget: Double
    let currency: String

    private var ratio: Double { budget > 0 ? spent / budget : 0 }
    private var tint: Color { ratio >= 1 ? .red : ratio >= 0.8 ? .orange : .green }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                if let label { Text(label) }
                Spacer()
                Text("\(Money.format(spent, currency: currency)) of \(Money.format(budget, currency: currency))")
                    .font(.caption).foregroundStyle(.secondary)
            }
            ProgressView(value: min(ratio, 1)).tint(tint)
            if ratio >= 1 {
                Text("Over by \(Money.format(spent - budget, currency: currency))").font(.caption).foregroundStyle(.red)
            }
        }
    }
}

extension View {
    func card() -> some View {
        padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}
