import SwiftUI

@main
struct ExtractApp: App {
    @State private var auth = AuthService()
    @State private var store = Store()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(store)
        }
    }
}

struct RootView: View {
    @Environment(AuthService.self) private var auth
    @Environment(Store.self) private var store

    var body: some View {
        Group {
            if !auth.isSignedIn {
                SignInView()
            } else {
                switch store.phase {
                case .loading:
                    ProgressView("Loading…")
                case .needsSetup:
                    SetupView()
                case .ready:
                    MainTabs()
                case .failed(let message):
                    ContentUnavailableView {
                        Label("Can't reach Extract", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try again") { Task { await store.load() } }
                            .buttonStyle(.borderedProminent)
                        Button("Sign out") { Task { await auth.signOut() } }
                    }
                }
            }
        }
        .task(id: auth.isSignedIn) {
            if auth.isSignedIn { await store.load() } else { store.reset() }
        }
    }
}

struct MainTabs: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
            TransactionsView()
                .tabItem { Label("Transactions", systemImage: "list.bullet") }
            SavingsView()
                .tabItem { Label("Savings", systemImage: "target") }
            ReportsView()
                .tabItem { Label("Reports", systemImage: "chart.bar") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
