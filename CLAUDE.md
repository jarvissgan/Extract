# Extract: notes for contributors (and Claude)

Personal expense tracker. React 19 + Vite + Mantine 8 (TypeScript) frontend in `src/`,
Express API in `api/`, MariaDB with SQL migrations in `db/migrations/`, validation shared
between both in `shared/`. See README.md for setup and scripts.

## Mobile first: every change must work on a phone

Most use is on phones. Treat 390px wide as the main layout and widen from there.

- **Check it at phone size.** Before finishing UI work, look at it at 390×844 (or run
  `npm run test:e2e`, which includes the `mobile` project) in Light, Dark and A mode.
- **No sideways page scrolling.** `tests/e2e/mobile.spec.ts` fails if any page is wider than
  the screen. Add new pages to that test.
- **No fixed widths on phones.** Use responsive style props: `w={{ base: "100%", sm: 200 }}`,
  `cols={{ base: 1, sm: 2 }}`, `hiddenFrom` / `visibleFrom`. Avoid `w={200}` on its own.
- **No tables on phones.** Render a list instead (see `TransactionTable` for the pattern) or a
  stacked layout; `Table.ScrollContainer` is for desktop only.
- **Change structure only with `useIsMobile()`** (`src/hooks/useIsMobile.ts`, below the `sm`
  breakpoint). For styling, prefer responsive props and CSS.
- **Dialogs:** `fullScreen={isMobile}` with `transitionProps={{ transition: isMobile ? "slide-up" : "pop" }}`
  for forms; date pickers use `dropdownType={isMobile ? "modal" : "popover"}`; hide number
  input up/down controls on phones (`hideControls={isMobile}`).
- **Tap targets at least 44px** tall; put the main action within thumb reach.
- **Inputs stay at 16px+ on phones** (global CSS in `src/index.css`) so iOS doesn't zoom.
- **Navigation:** phones use the bottom tab bar (`MobileNav`) and the header account menu
  (`AccountMenu`); the sidebar is desktop only. New top-level pages need a place in both.
- **Keyboard shortcuts are a desktop bonus,** never the only way to do something.

## Other conventions

- **Appearance:** three modes in `src/theme/Appearance.tsx`. A mode is butter yellow and pink
  with classic Pooh accents (`src/components/Pooh.tsx`) and **no gradients**; use
  `ctaProps(appearance)` for primary buttons instead of hard-coding a gradient.
- **Validation:** request bodies are checked with the zod schemas in `shared/schemas.js`, on
  both the API and the forms. Add new fields there first.
- **Schema changes:** add a new numbered file in `db/migrations/`; never edit an applied one.
  Copy `users.user_id`'s type for foreign keys (see `003_recurring.sql`), since existing
  databases may differ from `001_initial.sql`.
- **Security:** every API query is scoped to `req.currentUser`; only `VITE_*` env vars reach the
  browser, so never put secrets in them.
- **Before pushing:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
