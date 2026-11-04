import express from "express";
import cors from "cors";
import userRouter from "./api/userRoutes.js";
import transactionRouter from "./api/transactionRoutes.js";
import { createAuthMiddleware } from "./api/auth.js";
import { resolveCurrentUser } from "./api/currentUser.js";

// Builds the Express app without starting it, so tests can run it in-process.
export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));

  app.use(createAuthMiddleware());
  app.get("/authorized", (req, res) => {
    res.send("Secured Resource");
  });

  app.use("/api", resolveCurrentUser);
  app.use("/api", userRouter);
  app.use("/api", transactionRouter);

  return app;
}
