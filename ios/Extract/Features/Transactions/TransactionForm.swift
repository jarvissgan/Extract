import SwiftUI

/// Add or edit a transaction. New ones get a quick-add line ("coffee 4.50 #food").
struct TransactionForm: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss

    let existing: Transaction?

    @State private var quick = ""
    @State private var type: TransactionType = .expense
    @State private var name = ""
    @State private var amount: Double?
    @State private var category = "other"
    @State private var categoryTouched = false
    @State private var date = Date()
    @State private var dateOnly = false
    @State private var note = ""
    @State private var suggestions: [Suggestion] = []
    @State private var saving = false
    @State private var error: String?
    @State private var confirmDelete = false
    @FocusState private var focus: Field?

    enum Field { case quick, name, amount }

    init(existing: Transaction? = nil) {
        self.existing = existing
        if let t = existing {
            _type = State(initialValue: t.type)
            _name = State(initialValue: t.name)
            _amount = State(initialValue: t.amount)
            _category = State(initialValue: t.category)
            _categoryTouched = State(initialValue: true)
            _date = State(initialValue: t.date)
            _dateOnly = State(initialValue: t.dateOnly)
            _note = State(initialValue: t.note)
        }
    }

    private var matches: [Suggestion] {
        let q = name.trimmingCharacters(in: .whitespaces).lowercased()
        guard q.count >= 1, focus == .name else { return [] }
        return Array(suggestions.filter { $0.name.lowercased().hasPrefix(q) && $0.name.lowercased() != q }.prefix(4))
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? -1) >= 0 && !saving
    }

    var body: some View {
        NavigationStack {
            Form {
                if existing == nil {
                    Section {
                        TextField("coffee 4.50 · +3200 salary · lunch 12 yesterday #food", text: $quick)
                            .focused($focus, equals: .quick)
                            .submitLabel(.done)
                            .onSubmit(applyQuick)
                            .autocorrectionDisabled()
                    } header: {
                        Text("Quick add")
                    } footer: {
                        Text("Type a line and press return to fill in the form.")
                    }
                }

                Section {
                    Picker("Type", selection: $type) {
                        ForEach(TransactionType.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    TextField("Name", text: $name)
                        .focused($focus, equals: .name)
                        .onChange(of: name) { _, newValue in autoCategory(for: newValue) }
                    ForEach(matches, id: \.self) { s in
                        Button { use(s) } label: {
                            HStack {
                                Image(systemName: "arrow.up.left").foregroundStyle(.secondary)
                                Text(s.name)
                                Spacer()
                                Text(Money.format(s.amount, currency: store.currency)).foregroundStyle(.secondary)
                            }
                        }
                        .foregroundStyle(.primary)
                    }

                    TextField("Amount", value: $amount, format: .number.precision(.fractionLength(0...2)))
                        .keyboardType(.decimalPad)
                        .focused($focus, equals: .amount)

                    Picker("Category", selection: Binding(get: { category }, set: { category = $0; categoryTouched = true })) {
                        ForEach(store.preferences.allCategories) { c in
                            Label { Text(c.label) } icon: { Image(systemName: "circle.fill").foregroundStyle(Palette.color(c.color)) }
                                .tag(c.value)
                        }
                    }

                    if dateOnly {
                        DatePicker("Date", selection: $date, displayedComponents: .date)
                    } else {
                        DatePicker("When", selection: $date)
                    }
                    Toggle("Date only (no time)", isOn: $dateOnly)
                }

                Section("Note") {
                    TextField("Optional", text: $note, axis: .vertical)
                        .lineLimit(2...6)
                }

                if existing != nil {
                    Section {
                        Button("Delete transaction", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(existing == nil ? "Add transaction" : "Edit transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }.disabled(!canSave)
                }
            }
            .confirmationDialog("Delete this transaction?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await delete() } }
            }
            .errorAlert($error)
            .task {
                if existing == nil { focus = .quick }
                suggestions = await store.suggestions()
            }
        }
    }

    private func applyQuick() {
        let parsed = QuickAdd.parse(quick)
        if !parsed.name.isEmpty { name = parsed.name }
        if let a = parsed.amount { amount = a }
        type = parsed.type
        if let c = QuickAdd.matchCategory(parsed.categoryHint, in: store.preferences.allCategories) {
            category = c
            categoryTouched = true
        } else if parsed.type == .income, !categoryTouched {
            category = "income"
        }
        if parsed.daysAgo > 0, let d = Calendar.current.date(byAdding: .day, value: -parsed.daysAgo, to: Date()) {
            date = d
        }
        quick = ""
        focus = amount == nil ? .amount : nil
    }

    private func use(_ s: Suggestion) {
        name = s.name
        type = s.type
        if amount == nil { amount = s.amount }
        category = s.details.category
        categoryTouched = true
        focus = .amount
    }

    private func autoCategory(for name: String) {
        guard !categoryTouched else { return }
        if let rule = store.preferences.categoryFromRules(name) {
            category = rule
        } else if let s = suggestions.first(where: { $0.name.lowercased() == name.lowercased() }) {
            category = s.details.category
        }
    }

    private func save() async {
        guard let amount else { return }
        saving = true
        defer { saving = false }
        var day = date
        if dateOnly {
            // the day at noon, like statement imports, so it stays on that day in nearby time zones
            day = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date
        }
        let input = TransactionInput(
            transaction_type: type,
            transaction_name: name.trimmingCharacters(in: .whitespaces),
            transaction_amount: amount,
            transaction_details: TransactionDetails(category: category, transaction_note: note, date_only: dateOnly ? true : nil),
            transaction_date: ISODate.string(day)
        )
        do {
            try await store.save(input, id: existing?.id)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func delete() async {
        guard let existing else { return }
        do {
            try await store.deleteTransaction(existing.id)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
