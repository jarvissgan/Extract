import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import userRouter from "./api/userRoutes.js";
import transactionRouter from "./api/transactionRoutes.js";
import recurringRouter from "./api/recurringRoutes.js";
import savingsRouter from "./api/savingsRoutes.js";
import { createAuthMiddleware } from "./api/auth.js";
import { resolveCurrentUser } from "./api/currentUser.js";

// Builds the Express app without starting it, so tests can run it in-process.
export function createApp() {
  const app = express();

  app.use(helmet());
  // only the frontend may call the API from a browser
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim()),
    })
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests, please slow down." },
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.use(createAuthMiddleware());
  app.get("/authorized", (req, res) => {
    res.send("Secured Resource");
  });

  app.use("/api", resolveCurrentUser);
  app.use("/api", userRouter);
  app.use("/api", transactionRouter);
  app.use("/api", recurringRouter);
  app.use("/api", savingsRouter);

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
