// Offline login for local development. Only active on the Vite dev server with
// VITE_AUTH_MODE=dev; production builds always use Auth0.
export const DEV_AUTH = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === "dev";

export interface DevUser {
  email: string;
  name: string;
}

const STORAGE_KEY = "extract-dev-user";

// Matches the users created by `npm run db:seed`.
export const SEEDED_DEV_USERS: DevUser[] = [
  { email: "dev@extract.local", name: "Dev" },
  { email: "alice@extract.local", name: "Alice" },
];

export const loadDevUser = (): DevUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevUser) : null;
  } catch {
    return null;
  }
};

export const saveDevUser = (user: DevUser | null) => {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable; the session just won't persist
  }
};

// The backend's AUTH_MODE=dev accepts this as `Authorization: Bearer dev:<email>`.
export const devToken = (user: DevUser) => `dev:${encodeURIComponent(user.email)}`;
