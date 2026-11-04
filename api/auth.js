import { auth } from "express-oauth2-jwt-bearer";

export const isDevAuth = () => process.env.AUTH_MODE === "dev";

// Offline auth for local development and tests. Accepts `Authorization: Bearer dev:<email>`
// and treats the request as coming from that email. Never enabled in production.
function devAuth(req, res, next) {
  const match = /^Bearer dev:(.+)$/.exec(req.headers.authorization || "");
  const email = match && decodeURIComponent(match[1]).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(401).json({ error: "Dev auth: send `Authorization: Bearer dev:<email>`." });
  }
  req.auth = { payload: { sub: `dev|${email}` } };
  req.devEmail = email;
  next();
}

export function createAuthMiddleware() {
  if (isDevAuth()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_MODE=dev must never be used with NODE_ENV=production.");
    }
    console.warn("⚠  AUTH_MODE=dev: Auth0 is bypassed. Any `Bearer dev:<email>` token is accepted.");
    return devAuth;
  }

  return auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: process.env.AUTH0_TOKEN_SIGNING_ALG,
  });
}
