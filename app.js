import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { existsSync } from "node:fs";
import { rateLimit } from "express-rate-limit";
import userRouter from "./api/userRoutes.js";
import transactionRouter from "./api/transactionRoutes.js";
import recurringRouter from "./api/recurringRoutes.js";
import savingsRouter from "./api/savingsRoutes.js";
import { createAuthMiddleware } from "./api/auth.js";
import { resolveCurrentUser } from "./api/currentUser.js";
import { query } from "./db-connections.js";

// What the browser may load. In production this server also serves the website, so the
// policy has to allow Auth0 (login, token refresh) and Google Fonts.
const contentSecurityPolicy = () => {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL;
  const auth0 = issuer ? new URL(issuer).origin : null;
  return {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "connect-src": ["'self'", ...(auth0 ? [auth0] : [])],
      "frame-src": ["'self'", ...(auth0 ? [auth0] : [])],
      "img-src": ["'self'", "data:", "blob:"],
      "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
      // Mantine sets inline styles
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "worker-src": ["'self'", "blob:"],
      "manifest-src": ["'self'"],
    },
  };
};

// Builds the Express app without starting it, so tests can run it in-process.
export function createApp() {
  const app = express();

  // Behind a reverse proxy (Caddy) set TRUST_PROXY=1, so rate limiting sees each
  // visitor's real IP instead of the proxy's.
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  app.use(helmet({ contentSecurityPolicy: contentSecurityPolicy() }));

  // For Docker health checks and uptime monitors. No auth; reveals nothing.
  app.get("/healthz", async (req, res) => {
    try {
      await query("SELECT 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  const requireAuth = createAuthMiddleware();

  app.use(
    "/api",
    // only the frontend may call the API from a browser
    cors({
      origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim()),
    }),
    rateLimit({
      windowMs: 60_000,
      limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests, please slow down." },
    }),
    express.json({ limit: "1mb" }),
    requireAuth,
    resolveCurrentUser
  );
  app.use("/api", userRouter);
  app.use("/api", transactionRouter);
  app.use("/api", recurringRouter);
  app.use("/api", savingsRouter);
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

  app.get("/authorized", requireAuth, (req, res) => {
    res.send("Secured Resource");
  });

  // Production: also serve the built website (STATIC_DIR=dist). Hashed assets are cached
  // for a year; index.html is never cached so new deploys show up straight away.
  const staticDir = process.env.STATIC_DIR && path.resolve(process.env.STATIC_DIR);
  if (staticDir && existsSync(path.join(staticDir, "index.html"))) {
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders: (res, file) => {
          res.setHeader(
            "Cache-Control",
            file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache"
          );
        },
      })
    );
    // single-page app: every other GET gets index.html and the router takes over
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // body-parser and Auth0 errors carry a 4xx status
    const status = err.status || err.statusCode;
    if (status >= 400 && status < 500) return res.status(status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

  return app;
}
