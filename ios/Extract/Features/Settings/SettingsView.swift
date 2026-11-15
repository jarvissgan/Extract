import SwiftUI

struct SettingsView: View {
    @Environment(Store.self) private var store
    @Environment(AuthService.self) private var auth
    @State private var confirmDelete = false
    @State private var serverVersion: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    NavigationLink { ProfileSettings() } label: {
                        LabeledContent("Name", value: store.account?.username ?? "")
                    }
                    LabeledContent("Email", value: store.account?.email ?? "")
                }
                Section("Money") {
                    NavigationLink("Budgets") { BudgetSettings() }
                    NavigationLink("Categories") { CategorySettings() }
                    NavigationLink("Categorization rules") { RuleSettings() }
                    NavigationLink("Recurring bills & income") { RecurringSettings() }
                }
                Section("About") {
                    LabeledContent("App version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
                    LabeledContent("Server version", value: serverVersion ?? "…")
                }
                Section {
                    Button("Sign out") { Task { await auth.signOut() } }
                    Button("Delete account", role: .destructive) { confirmDelete = true }
                }
            }
            .navigationTitle("Settings")
            .task {
                struct Version: Decodable { let version: String }
                serverVersion = (try? await APIClient.shared.get("version") as Version)?.version ?? "unknown"
            }
            .confirmationDialog("Delete your account and all your data? This can't be undone.",
                                isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) {
                    Task {
                        do {
                            try await store.deleteAccount()
                            await auth.signOut()
                        } catch { self.error = error.localizedDescription }
                    }
                }
            }
            .errorAlert($error)
        }
    }
}

/// Saves edited preferences when "Save" is tapped.
private struct SaveButton: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    var username: String?
    let preferences: Preferences
    @Binding var error: String?
    @State private var saving = false

    var body: some View {
        Button("Save") {
            Task {
                saving = true
                defer { saving = false }
                do {
                    try await store.save(username: username, preferences: preferences)
                    dismiss()
                } catch { self.error = error.localizedDescription }
            }
        }
        .disabled(saving)
    }
}

struct ProfileSettings: View {
    @Environment(Store.self) private var store
    @State private var name = ""
    @State private var prefs = Preferences()
    @State private var error: String?

    var body: some View {
        Form {
            TextField("Name", text: $name)
            Picker("Currency", selection: $prefs.currency) {
                ForEach(currencies, id: \.self) { Text($0) }
            }
            Toggle("Email notifications", isOn: $prefs.notifications.email)
        }
        .navigationTitle("Profile")
        .toolbar { SaveButton(username: name.trimmingCharacters(in: .whitespaces), preferences: prefs, error: $error)
            .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty) }
        .onAppear {
            name = store.account?.username ?? ""
            prefs = store.preferences
        }
        .errorAlert($error)
    }
}

struct BudgetSettings: View {
    @Environment(Store.self) private var store
    @State private var prefs = Preferences()
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                TextField("No budget", value: $prefs.budgets.monthly, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
            } header: {
                Text("Monthly budget (\(prefs.currency))")
            } footer: {
                Text("Total spending you aim to stay under each month.")
            }
            Section("Per category") {
                ForEach(prefs.allCategories.filter { $0.value != "income" && $0.value != "transfers" }) { c in
                    HStack {
                        Circle().fill(Palette.color(c.color)).frame(width: 10, height: 10)
                        Text(c.label)
                        Spacer()
                        TextField("—", value: Binding(
                            get: { prefs.budgets.categories[c.value] },
                            set: { prefs.budgets.categories[c.value] = ($0 ?? 0) > 0 ? $0 : nil }
                        ), format: .number.precision(.fractionLength(0...2)))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 110)
                    }
                }
            }
        }
        .navigationTitle("Budgets")
        .toolbar { SaveButton(preferences: prefs, error: $error) }
        .onAppear { prefs = store.preferences }
        .errorAlert($error)
    }
}

struct CategorySettings: View {
    @Environment(Store.self) private var store
    @State private var prefs = Preferences()
    @State private var newName = ""
    @State private var error: String?

    var body: some View {
        Form {
            Section("Your categories") {
                if prefs.categories.isEmpty { Text("None yet").foregroundStyle(.secondary) }
                ForEach(prefs.categories) { c in
                    Label { Text(c.label) } icon: { Image(systemName: "circle.fill").foregroundStyle(Palette.color(c.color)) }
                }
                .onDelete { prefs.categories.remove(atOffsets: $0) }
                HStack {
                    TextField("New category", text: $newName)
                    Button("Add", action: add).disabled(key(newName).isEmpty)
                }
            }
            Section("Built in") {
                ForEach(builtinCategories) { c in
                    Label { Text(c.label) } icon: { Image(systemName: "circle.fill").foregroundStyle(Palette.color(c.color)) }
                }
            }
        }
        .navigationTitle("Categories")
        .toolbar { SaveButton(preferences: prefs, error: $error) }
        .onAppear { prefs = store.preferences }
        .errorAlert($error)
    }

    private func key(_ label: String) -> String {
        let lowered = label.lowercased().trimmingCharacters(in: .whitespaces)
        let mapped = lowered.map { $0.isLetter || $0.isNumber ? String($0) : "-" }.joined()
        return String(mapped.split(separator: "-").joined(separator: "-").prefix(40))
    }

    private func add() {
        let value = key(newName)
        guard !prefs.allCategories.contains(where: { $0.value == value }) else {
            error = "There's already a category called that."
            return
        }
        let color = categoryColors[prefs.categories.count % categoryColors.count]
        prefs.categories.append(CategoryOption(value: value, label: newName.trimmingCharacters(in: .whitespaces), color: color))
        newName = ""
    }
}

struct RuleSettings: View {
    @Environment(Store.self) private var store
    @State private var prefs = Preferences()
    @State private var pattern = ""
    @State private var category = "food"
    @State private var error: String?

    var body: some View {
        Form {
            Section {
                ForEach(prefs.rules, id: \.self) { rule in
                    HStack {
                        Text("“\(rule.pattern)”")
                        Image(systemName: "arrow.right").foregroundStyle(.secondary)
                        Text(prefs.category(rule.category).label)
                    }
                }
                .onDelete { prefs.rules.remove(atOffsets: $0) }
                .onMove { prefs.rules.move(fromOffsets: $0, toOffset: $1) }
            } header: {
                Text("If the name contains…")
            } footer: {
                Text("Checked in order; the first match wins.")
            }
            Section("New rule") {
                TextField("Name contains (e.g. grab)", text: $pattern)
                    .textInputAutocapitalization(.never)
                Picker("Category", selection: $category) {
                    ForEach(prefs.allCategories) { Text($0.label).tag($0.value) }
                }
                Button("Add rule") {
                    prefs.rules.append(CategoryRule(pattern: pattern.trimmingCharacters(in: .whitespaces), category: category))
                    pattern = ""
                }
                .disabled(pattern.trimmingCharacters(in: .whitespaces).count < 2)
            }
        }
        .navigationTitle("Rules")
        .toolbar {
            ToolbarItem(placement: .primaryAction) { SaveButton(preferences: prefs, error: $error) }
            ToolbarItem(placement: .bottomBar) { EditButton() }
        }
        .onAppear { prefs = store.preferences }
        .errorAlert($error)
    }
}

struct RecurringSettings: View {
    @Environment(Store.self) private var store
    @State private var rules: [RecurringRule] = []
    @State private var editing: RecurringRule?
    @State private var creating = false
    @State private var error: String?

    var body: some View {
        List {
            if rules.isEmpty {
                ContentUnavailableView("Nothing recurring", systemImage: "repeat",
                                       description: Text("Add rent, subscriptions or salary once and they're added every month."))
            }
            ForEach(rules) { rule in
                Button { editing = rule } label: {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(rule.name).foregroundStyle(rule.active ? .primary : .secondary)
                            Text("Day \(rule.dayOfMonth) · \(store.preferences.category(rule.category).label)\(rule.active ? "" : " · Paused")")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(Money.format(rule.type == .income ? rule.amount : -rule.amount, currency: store.currency))
                            .foregroundStyle(rule.type == .income ? .green : .primary)
                    }
                }
                .foregroundStyle(.primary)
                .swipeActions {
                    Button(role: .destructive) {
                        Task {
                            do { try await APIClient.shared.delete("recurring/\(rule.id)"); await load() }
                            catch { self.error = error.localizedDescription }
                        }
                    } label: { Label("Delete", systemImage: "trash") }
                }
            }
        }
        .navigationTitle("Recurring")
        .toolbar { Button { creating = true } label: { Image(systemName: "plus") } }
        .task { await load() }
        .sheet(item: $editing) { RecurringForm(rule: $0) { await load() } }
        .sheet(isPresented: $creating) { RecurringForm(rule: nil) { await load() } }
        .errorAlert($error)
    }

    private func load() async {
        do { rules = try await APIClient.shared.get("recurring") }
        catch { if !error.isCancellation { self.error = error.localizedDescription } }
        store.transactionsChanged()
    }
}

struct RecurringForm: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    let rule: RecurringRule?
    let onSaved: () async -> Void

    @State private var type: TransactionType = .expense
    @State private var name = ""
    @State private var amount: Double?
    @State private var category = "bills"
    @State private var note = ""
    @State private var day = 1
    @State private var active = true
    @State private var error: String?

    init(rule: RecurringRule?, onSaved: @escaping () async -> Void) {
        self.rule = rule
        self.onSaved = onSaved
        if let rule {
            _type = State(initialValue: rule.type)
            _name = State(initialValue: rule.name)
            _amount = State(initialValue: rule.amount)
            _category = State(initialValue: rule.category)
            _note = State(initialValue: rule.note)
            _day = State(initialValue: rule.dayOfMonth)
            _active = State(initialValue: rule.active)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $type) {
                    ForEach(TransactionType.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                TextField("Name (e.g. Rent)", text: $name)
                TextField("Amount", value: $amount, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                Picker("Category", selection: $category) {
                    ForEach(store.preferences.allCategories) { Text($0.label).tag($0.value) }
                }
                Stepper("Every month on day \(day)", value: $day, in: 1...31)
                TextField("Note (optional)", text: $note)
                Toggle("Active", isOn: $active)
            }
            .navigationTitle(rule == nil ? "New recurring" : "Edit recurring")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || amount == nil)
                }
            }
            .errorAlert($error)
        }
    }

    private func save() async {
        guard let amount else { return }
        let body = RecurringInput(transaction_type: type, name: name.trimmingCharacters(in: .whitespaces), amount: amount,
                                  category: category, note: note, day_of_month: day, active: active)
        do {
            if let rule {
                let _: JSONValue = try await APIClient.shared.put("recurring/\(rule.id)", body)
            } else {
                let _: JSONValue = try await APIClient.shared.post("recurring", body)
            }
            await onSaved()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
