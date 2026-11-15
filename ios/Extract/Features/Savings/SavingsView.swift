import SwiftUI

struct SavingsView: View {
    @Environment(Store.self) private var store
    @State private var goals: [SavingsGoal] = []
    @State private var loading = true
    @State private var error: String?
    @State private var creating = false

    var body: some View {
        NavigationStack {
            List {
                if !loading && goals.isEmpty {
                    ContentUnavailableView("No savings goals", systemImage: "target",
                                           description: Text("Save towards something: a trip, a new phone, a rainy-day fund."))
                }
                ForEach(goals) { goal in
                    NavigationLink(value: goal) { GoalRow(goal: goal, currency: store.currency) }
                }
            }
            .navigationTitle("Savings")
            .navigationDestination(for: SavingsGoal.self) { goal in
                GoalDetailView(goal: goal) { await load() }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { creating = true } label: { Image(systemName: "plus") }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $creating) { GoalForm(goal: nil) { _ in await load() } }
            .errorAlert($error)
        }
    }

    private func load() async {
        defer { loading = false }
        do { goals = try await APIClient.shared.get("savings") }
        catch { if !error.isCancellation { self.error = error.localizedDescription } }
    }
}

struct ProgressRing: View {
    let progress: Double
    let color: Color
    var lineWidth: CGFloat = 6

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.2), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct GoalRow: View {
    let goal: SavingsGoal
    let currency: String

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                ProgressRing(progress: goal.progress, color: Palette.color(goal.color))
                Text(goal.emoji ?? "💰")
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(goal.name).font(.headline)
                    if goal.reachedAt != nil { Image(systemName: "checkmark.seal.fill").foregroundStyle(.green) }
                }
                Text("\(Money.format(goal.saved, currency: currency)) of \(Money.format(goal.target, currency: currency))")
                    .font(.subheadline).foregroundStyle(.secondary)
                if let d = DayString.date(goal.targetDate) {
                    Text("By \(d.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(goal.progress.formatted(.percent.precision(.fractionLength(0))))
                .font(.subheadline.bold()).foregroundStyle(Palette.color(goal.color))
        }
        .padding(.vertical, 4)
    }
}

struct GoalDetailView: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var goal: SavingsGoal
    let onChange: () async -> Void

    @State private var entries: [SavingsEntry] = []
    @State private var entryKind: String?
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var celebrate = false
    @State private var error: String?

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    ZStack {
                        ProgressRing(progress: goal.progress, color: Palette.color(goal.color), lineWidth: 14)
                        VStack {
                            Text(goal.emoji ?? "💰").font(.largeTitle)
                            Text(goal.progress.formatted(.percent.precision(.fractionLength(0)))).font(.title2.bold())
                        }
                    }
                    .frame(width: 160, height: 160)
                    Text("\(Money.format(goal.saved, currency: store.currency)) of \(Money.format(goal.target, currency: store.currency))")
                        .font(.headline)
                    if goal.saved < goal.target {
                        Text("\(Money.format(goal.target - goal.saved, currency: store.currency)) to go")
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Goal reached! 🎉").foregroundStyle(.green)
                    }
                    HStack {
                        Button { entryKind = "deposit" } label: { Label("Add money", systemImage: "plus") }
                            .buttonStyle(.borderedProminent)
                        Button { entryKind = "withdraw" } label: { Label("Take out", systemImage: "minus") }
                            .buttonStyle(.bordered)
                            .disabled(goal.saved <= 0)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical)
            }

            Section("History") {
                if entries.isEmpty { Text("No entries yet.").foregroundStyle(.secondary) }
                ForEach(entries) { entry in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(entry.note?.isEmpty == false ? entry.note! : (entry.amount >= 0 ? "Added" : "Taken out"))
                            Text(entry.date.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(Money.format(entry.amount, currency: store.currency, showSign: true))
                            .monospacedDigit()
                            .foregroundStyle(entry.amount >= 0 ? .green : .red)
                    }
                    .swipeActions {
                        Button(role: .destructive) { Task { await deleteEntry(entry) } } label: { Label("Delete", systemImage: "trash") }
                    }
                }
            }

            Section {
                Button("Delete goal", role: .destructive) { confirmDelete = true }
            }
        }
        .navigationTitle(goal.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { Button("Edit") { editing = true } }
        .task { await loadEntries() }
        .sheet(item: Binding(get: { entryKind.map { EntryKind(kind: $0) } }, set: { entryKind = $0?.kind })) { kind in
            EntryForm(goal: goal, kind: kind.kind) { result in
                goal = result.goal
                if result.reached == true { celebrate = true }
                await loadEntries()
                await onChange()
            }
        }
        .sheet(isPresented: $editing) {
            GoalForm(goal: goal) { updated in
                goal = updated
                await onChange()
            }
        }
        .confirmationDialog("Delete this goal and its history?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await deleteGoal() } }
        }
        .alert("You reached your goal! 🎉", isPresented: $celebrate) { Button("Yay!") {} }
        .sensoryFeedback(.success, trigger: celebrate)
        .errorAlert($error)
    }

    private struct EntryKind: Identifiable { let kind: String; var id: String { kind } }

    private func loadEntries() async {
        do { entries = try await APIClient.shared.get("savings/\(goal.id)/entries") }
        catch { if !error.isCancellation { self.error = error.localizedDescription } }
    }

    private func deleteEntry(_ entry: SavingsEntry) async {
        do {
            let result: SavingsGoalResult = try await APIClient.shared.send(method: "DELETE", "savings/\(goal.id)/entries/\(entry.id)")
            goal = result.goal
            await loadEntries()
            await onChange()
        } catch { self.error = error.localizedDescription }
    }

    private func deleteGoal() async {
        do {
            try await APIClient.shared.delete("savings/\(goal.id)")
            await onChange()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct EntryForm: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss
    let goal: SavingsGoal
    let kind: String
    let onSaved: (SavingsEntryResult) async -> Void

    @State private var amount: Double?
    @State private var note = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Amount", value: $amount, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                TextField("Note (optional)", text: $note)
            }
            .navigationTitle(kind == "deposit" ? "Add money" : "Take out money")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }.disabled((amount ?? 0) <= 0)
                }
            }
            .errorAlert($error)
        }
        .presentationDetents([.medium])
    }

    private func save() async {
        guard let amount else { return }
        do {
            let result: SavingsEntryResult = try await APIClient.shared.post(
                "savings/\(goal.id)/entries", SavingsEntryInput(kind: kind, amount: amount, note: note)
            )
            await onSaved(result)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct GoalForm: View {
    @Environment(\.dismiss) private var dismiss
    let goal: SavingsGoal?
    let onSaved: (SavingsGoal) async -> Void

    @State private var name = ""
    @State private var target: Double?
    @State private var hasDate = false
    @State private var date = Calendar.current.date(byAdding: .month, value: 6, to: Date()) ?? Date()
    @State private var emoji = ""
    @State private var color = "pink"
    @State private var error: String?

    init(goal: SavingsGoal?, onSaved: @escaping (SavingsGoal) async -> Void) {
        self.goal = goal
        self.onSaved = onSaved
        if let goal {
            _name = State(initialValue: goal.name)
            _target = State(initialValue: goal.target)
            _emoji = State(initialValue: goal.emoji ?? "")
            _color = State(initialValue: goal.color)
            if let d = DayString.date(goal.targetDate) {
                _hasDate = State(initialValue: true)
                _date = State(initialValue: d)
            }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name (e.g. Japan trip)", text: $name)
                TextField("Target amount", value: $target, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                TextField("Emoji (optional)", text: $emoji)
                Toggle("Target date", isOn: $hasDate)
                if hasDate { DatePicker("By", selection: $date, displayedComponents: .date) }
                Section("Colour") {
                    HStack {
                        ForEach(goalColors, id: \.self) { c in
                            Circle()
                                .fill(Palette.color(c))
                                .frame(width: 30, height: 30)
                                .overlay { if c == color { Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(.white) } }
                                .onTapGesture { color = c }
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .navigationTitle(goal == nil ? "New goal" : "Edit goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || (target ?? 0) <= 0)
                }
            }
            .errorAlert($error)
        }
    }

    private func save() async {
        guard let target else { return }
        let body = SavingsGoalInput(
            name: name.trimmingCharacters(in: .whitespaces),
            target_amount: target,
            target_date: hasDate ? DayString.string(date) : nil,
            emoji: emoji.isEmpty ? nil : String(emoji.prefix(4)),
            color: color
        )
        do {
            let saved: SavingsGoal = goal == nil
                ? try await APIClient.shared.post("savings", body)
                : try await APIClient.shared.put("savings/\(goal!.id)", body)
            await onSaved(saved)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
