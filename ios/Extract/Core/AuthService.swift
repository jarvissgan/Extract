import Foundation
import Observation
import Auth0

/// Signs in with Auth0 (or the offline dev login) and hands out access tokens.
@Observable
@MainActor
final class AuthService {
    private(set) var isSignedIn = false
    private(set) var isWorking = false
    var errorMessage: String?

    /// Offline dev login (backend AUTH_MODE=dev): the email being used.
    private(set) var devEmail: String?

    private static let devEmailKey = "devEmail"
    private let credentialsManager: CredentialsManager?

    init() {
        if AppConfig.isDevAuth {
            credentialsManager = nil
            devEmail = UserDefaults.standard.string(forKey: Self.devEmailKey)
            isSignedIn = devEmail != nil
        } else {
            credentialsManager = CredentialsManager(
                authentication: Auth0.authentication(clientId: AppConfig.auth0ClientID, domain: AppConfig.auth0Domain)
            )
            isSignedIn = credentialsManager?.canRenew() ?? false
        }
        APIClient.shared.tokenProvider = { [weak self] in
            guard let self else { throw APIError(status: 401, message: "Not signed in.") }
            return try await self.accessToken()
        }
    }

    func accessToken() async throws -> String {
        if AppConfig.isDevAuth {
            guard let devEmail else { throw APIError(status: 401, message: "Not signed in.") }
            let encoded = devEmail.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "@.-_"))) ?? devEmail
            return "dev:\(encoded)"
        }
        guard let credentialsManager else { throw APIError(status: 401, message: "Not signed in.") }
        do {
            // renews with the refresh token when the access token is about to expire
            return try await credentialsManager.credentials(minTTL: 60).accessToken
        } catch {
            isSignedIn = false
            throw APIError(status: 401, message: "Your session has ended. Please sign in again.")
        }
    }

    func signIn() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let credentials = try await Auth0
                .webAuth(clientId: AppConfig.auth0ClientID, domain: AppConfig.auth0Domain)
                .audience(AppConfig.auth0Audience)
                .scope("openid profile email offline_access")
                .start()
            _ = credentialsManager?.store(credentials: credentials)
            isSignedIn = true
        } catch {
            // closing the login sheet isn't an error
            if let webAuthError = error as? WebAuthError, webAuthError == .userCancelled { return }
            errorMessage = error.localizedDescription
        }
    }

    func devSignIn(email: String) {
        let clean = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard clean.contains("@") else { errorMessage = "Enter an email address."; return }
        UserDefaults.standard.set(clean, forKey: Self.devEmailKey)
        devEmail = clean
        isSignedIn = true
    }

    func signOut() async {
        if AppConfig.isDevAuth {
            UserDefaults.standard.removeObject(forKey: Self.devEmailKey)
            devEmail = nil
        } else {
            try? await Auth0.webAuth(clientId: AppConfig.auth0ClientID, domain: AppConfig.auth0Domain).clearSession()
            _ = credentialsManager?.clear()
        }
        isSignedIn = false
    }
}
