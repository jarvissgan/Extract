import { query } from "../db-connections.js";

// Resolves the Auth0 user behind the request's access token to a row in `users`.
// The access token only carries `sub`, so the email is looked up once via
// Auth0's /userinfo endpoint and cached per `sub`.
const emailBySub = new Map();

const issuerBaseURL = () => (process.env.AUTH0_ISSUER_BASE_URL || "").replace(/\/+$/, "");

async function fetchEmail(req) {
  const sub = req.auth.payload.sub;
  if (emailBySub.has(sub)) return emailBySub.get(sub);

  const res = await fetch(`${issuerBaseURL()}/userinfo`, {
    headers: { Authorization: req.headers.authorization },
  });
  if (!res.ok) {
    throw new Error(`userinfo request failed with status ${res.status}`);
  }
  const { email, email_verified } = await res.json();
  if (!email) {
    throw new Error("userinfo response has no email; request the `email` scope");
  }
  if (email_verified === false) {
    throw new Error("email is not verified");
  }
  emailBySub.set(sub, email);
  return email;
}

// Sets req.currentUser = { email, user_id, user_sqid } (user_id/user_sqid are null
// until the account has been set up).
export async function resolveCurrentUser(req, res, next) {
  try {
    const email = await fetchEmail(req);
    const rows = await query("SELECT user_id, user_sqid FROM users WHERE email = ?", [email]);
    req.currentUser = {
      email,
      user_id: rows[0]?.user_id ?? null,
      user_sqid: rows[0]?.user_sqid ?? null,
    };
    next();
  } catch (err) {
    console.error("Unable to resolve current user:", err.message);
    res.status(401).json({ error: "Unable to identify the signed-in user." });
  }
}

// Rejects requests for a sqid that doesn't belong to the signed-in user.
export function requireOwnSqid(req, res, next) {
  const { user_sqid } = req.currentUser;
  if (!user_sqid) {
    return res.status(403).json({ error: "Account setup is not complete." });
  }
  if (req.params.sqid !== user_sqid) {
    return res.status(403).json({ error: "You do not have access to this user." });
  }
  next();
}

export function requireSetUpUser(req, res, next) {
  if (!req.currentUser.user_id) {
    return res.status(403).json({ error: "Account setup is not complete." });
  }
  next();
}
