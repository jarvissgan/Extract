# Extract for iPhone

A native SwiftUI app that talks to the same Express API as the website. Nothing changes on the server.

- Home: month totals, comparison with last month, monthly and per-category budgets, where the money went
- Transactions: month list grouped by day, search and filters, swipe to delete, add/edit with the same quick-add line as the website (`coffee 4.50`, `+3200 salary`, `lunch 12 yesterday #food`), suggestions from your history and your categorization rules
- Savings goals: progress rings, add or take out money, history
- Reports: income vs spending (3/6/12 months), spending by category, savings rate
- Settings: name, currency, budgets, custom categories, rules, recurring bills and income, delete account

Not in the app yet (use the website): CSV/PDF statement import, bulk edits, data export.

## Run it

Needs a Mac with Xcode 15 or newer (iOS 17+), and [XcodeGen](https://github.com/yonaskolb/XcodeGen) to create the Xcode project:

```bash
brew install xcodegen
cd ios
xcodegen          # creates Extract.xcodeproj
open Extract.xcodeproj
```

Pick an iPhone simulator and press Run. Xcode downloads the Auth0 Swift package the first time.

### Against your local backend (offline login)

`Config.xcconfig` is set up for this already: `AUTH_MODE = dev` and `API_BASE_URL = http://localhost:3000/api`.
Start the backend with `npm run local` (it uses `AUTH_MODE=dev`), then log in as `dev@extract.local` or `alice@extract.local`.
The Simulator reaches your Mac as `localhost`. On a real iPhone, use your Mac's LAN address instead (e.g. `http://192.168.1.20:3000/api`).

### With Auth0 (real accounts)

1. In Auth0, create an application of type **Native** (the website's SPA app won't work for the phone).
2. In its settings, add this as an **Allowed Callback URL** and **Allowed Logout URL**
   (replace the bundle id and domain with yours):
   `com.example.extract://your-tenant.us.auth0.com/ios/com.example.extract/callback`
3. Turn on **Refresh Token Rotation** and allow the **Refresh Token** grant, so people stay signed in.
4. Create `ios/Config.local.xcconfig` (ignored by git) with your values:

   ```
   APP_BUNDLE_ID = com.yourname.extract
   DEVELOPMENT_TEAM = ABCDE12345
   API_BASE_URL = https:/$()/extract.yourdomain.com/api
   AUTH_MODE = auth0
   AUTH0_DOMAIN = your-tenant.us.auth0.com
   AUTH0_CLIENT_ID = <the Native app's client id>
   AUTH0_AUDIENCE = https:/$()/your-api-identifier
   ```

   (`/$()/` is how xcconfig files write `//`.) Use the same audience as the website's `AUTH0_AUDIENCE`.
5. Run `xcodegen` again and build.

## Layout

- `project.yml`: XcodeGen project (iOS 17, SwiftUI, Auth0 via Swift Package Manager)
- `Extract/Core`: API client, sign-in, shared state, helpers
- `Extract/Models`: the API's JSON shapes
- `Extract/Features`: one folder per tab
