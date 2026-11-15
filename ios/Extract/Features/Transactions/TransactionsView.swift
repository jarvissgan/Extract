import SwiftUI

struct TransactionsView: View {
    @Environment(Store.self) private var store
    @State private var month = Calendar.current.startOfMonth(Date())
    @State private var transactions: [Transaction] = []
    @State private var search = ""
    @State private var filter: TransactionType?
    @State private var category: String?
    @State private var loading = true
    @State private var error: String?
    @State private var editing: Transaction?
    @State private var adding = false

    private var filtered: [Transaction] {
        transactions.filter { t in
            (filter == nil || t.type == filter) &&
            (category == nil || t.category == category) &&
            (search.isEmpty || t.name.localizedCaseInsensitiveContains(search) || t.note.localizedCaseInsensitiveContains(search))
        }
    }

    private var days: [(Date, [Transaction])] {
        let groups = Dictionary(grouping: filtered) { Calendar.current.startOfDay(for: $0.date) }
        return groups.keys.sorted(by: >).map { ($0, groups[$0]!.sorted { $0.date > $1.date }) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack { Spacer(); MonthSwitcher(month: $month); Spacer() }
                }
                if loading && transactions.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if days.isEmpty {
                    ContentUnavailableView(
                        search.isEmpty ? "No transactions" : "No matches",
                        systemImage: "tray",
                        description: Text(search.isEmpty ? "Tap + to add one." : "Try a different search.")
                    )
                }
                ForEach(days, id: \.0) { day, items in
                    Section {
                        ForEach(items) { t in
                            Button { editing = t } label: { TransactionRow(transaction: t) }
                                .foregroundStyle(.primary)
                                .swipeActions {
                                    Button(role: .destructive) { Task { await delete(t) } } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    } header: {
                        HStack {
                            Text(day.formatted(.dateTime.weekday(.wide).day().month(.abbreviated)))
                            Spacer()
                            Text(Money.format(items.reduce(0) { $0 + $1.signedAmount }, currency: store.currency))
                        }
                    }
                }
            }
            .searchable(text: $search, prompt: "Search names and notes")
            .navigationTitle("Transactions")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Picker("Type", selection: $filter) {
                            Text("All").tag(TransactionType?.none)
                            ForEach(TransactionType.allCases) { Text($0.label).tag(TransactionType?.some($0)) }
                        }
                        Picker("Category", selection: $category) {
                            Text("Any category").tag(String?.none)
                            ForEach(store.preferences.allCategories) { Text($0.label).tag(String?.some($0.value)) }
                        }
                    } label: {
                        Image(systemName: filter == nil && category == nil
                              ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { adding = true } label: { Image(systemName: "plus") }
                }
            }
            .refreshable { await load() }
            .task(id: "\(month.timeIntervalSince1970)-\(store.revision)") { await load() }
            .sheet(item: $editing) { TransactionForm(existing: $0) }
            .sheet(isPresented: $adding) { TransactionForm() }
            .errorAlert($error)
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            transactions = try await store.transactions(from: month, to: Calendar.current.endOfMonth(month))
        } catch {
            if !error.isCancellation { self.error = error.localizedDescription }
        }
    }

    private func delete(_ t: Transaction) async {
        do { try await store.deleteTransaction(t.id) } catch { self.error = error.localizedDescription }
    }
}
