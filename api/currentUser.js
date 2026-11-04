import { query } from "../db-connections.js";

// Identifies the signed-in user from the Auth0 user ID (`sub`) in their access token.
//
// Accounts are linked by `sub`, so changing email or logging in with a different
// provider can't move data between accounts. The email is only fetched from Auth0
// (/userinfo) for users without an account yet, and to link accounts created before
// `sub` was stored.
const emailBySub = new Map();

const issuerBaseURL = () => (process.env.AUTH0_ISSUER_BASE_URL || "").replace(/\/+$/, "");

export async function fetchEmail(req) {
  // set by the offline dev auth middleware (AUTH_MODE=dev)
  if (req.devEmail) return req.devEmail;

  const sub = req.auth.payload.sub;
  if (emailBySub.has(sub)) return emailBySub.get(sub);

  const res = await fetch(`${issuerBaseURL()}/userinfo`, {
    headers: { Authorization: req.headers.authorization },
  });
  if (!res.ok) throw new Error(`userinfo request failed with status ${res.status}`);

  const { email, email_verified } = await res.json();
  if (!email) throw new Error("userinfo response has no email; request the `email` scope");
  if (email_verified === false) throw new Error("email is not verified");

  emailBySub.set(sub, email.toLowerCase());
  return email.toLowerCase();
}

const parsePreferences = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
};

const findBySub = (sub) =>
  query("SELECT user_id, user_sqid, email, preference_json FROM users WHERE auth_sub = ?", [sub]);

// Sets req.currentUser = { sub, email, user_id, user_sqid, preferences }.
// user_id / user_sqid are null until the account has been set up.
export async function resolveCurrentUser(req, res, next) {
  try {
    const sub = req.auth.payload.sub;
    let [row] = await findBySub(sub);

    if (!row) {
      const email = await fetchEmail(req);
      // account created before auth_sub existed: link it to this login
      const linked = await query(
        "UPDATE users SET auth_sub = ? WHERE email = ? AND auth_sub IS NULL",
        [sub, email]
      );
      if (linked.affectedRows) [row] = await findBySub(sub);
      if (!row) {
        req.currentUser = { sub, email, user_id: null, user_sqid: null, preferences: {} };
        return next();
      }
    }

    req.currentUser = {
      sub,
      email: row.email,
      user_id: row.user_id,
      user_sqid: row.user_sqid,
      preferences: parsePreferences(row.preference_json),
    };
    next();
  } catch (err) {
    // Database problems (e.g. a missing column) are server errors, not "not signed in";
    // reporting them as 401 hides the real cause.
    if (err.sqlMessage || err.code?.startsWith?.("ER_") || err.code === "ECONNREFUSED") {
      console.error("Database error while looking up the signed-in user:", err.message);
      return res.status(500).json({ error: "Server error" });
    }
    console.error("Unable to resolve current user:", err.message);
    res.status(401).json({ error: "Unable to identify the signed-in user." });
  }
}

// Rejects requests for a sqid that doesn't belong to the signed-in user.
export function requireOwnSqid(req, res, next) {
  const { user_sqid } = req.currentUser;
  if (!user_sqid) return res.status(403).json({ error: "Account setup is not complete." });
  if (req.params.sqid !== user_sqid) {
    return res.status(403).json({ error: "You do not have access to this user." });
  }
  next();
}

export function requireSetUpUser(req, res, next) {
  if (!req.currentUser.user_id) return res.status(403).json({ error: "Account setup is not complete." });
  next();
}
