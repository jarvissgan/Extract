import SwiftUI

struct SignInView: View {
    @Environment(AuthService.self) private var auth
    @State private var email = "dev@extract.local"

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "dollarsign.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(.tint)
            VStack(spacing: 8) {
                Text("Extract").font(.largeTitle.bold())
                Text("Track spending, income, budgets and savings goals.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if AppConfig.isDevAuth {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Offline login (dev)").font(.caption).foregroundStyle(.orange)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                    HStack {
                        ForEach(["dev@extract.local", "alice@extract.local"], id: \.self) { seeded in
                            Button(seeded.components(separatedBy: "@")[0].capitalized) { email = seeded }
                                .buttonStyle(.bordered)
                        }
                    }
                    Button { auth.devSignIn(email: email) } label: {
                        Text("Log in").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            } else {
                Button {
                    Task { await auth.signIn() }
                } label: {
                    Group {
                        if auth.isWorking { ProgressView() } else { Text("Log in or sign up") }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(auth.isWorking)
            }
            if let error = auth.errorMessage {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        }
        .padding(24)
    }
}

struct SetupView: View {
    @Environment(Store.self) private var store
    @Environment(AuthService.self) private var auth
    @State private var username = ""
    @State private var currency = Locale.current.currency?.identifier.flatMap { currencies.contains($0) ? $0 : nil } ?? "USD"
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Your name", text: $username)
                        .textContentType(.name)
                    Picker("Currency", selection: $currency) {
                        ForEach(currencies, id: \.self) { Text($0) }
                    }
                } footer: {
                    Text("You can change these later in Settings.")
                }
                Section {
                    Button {
                        Task {
                            saving = true
                            defer { saving = false }
                            do { try await store.createAccount(username: username.trimmingCharacters(in: .whitespaces), currency: currency) }
                            catch { self.error = error.localizedDescription }
                        }
                    } label: {
                        if saving { ProgressView() } else { Text("Create account") }
                    }
                    .disabled(username.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
            .navigationTitle("Welcome")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Sign out") { Task { await auth.signOut() } }
                }
            }
            .errorAlert($error)
        }
    }
}
