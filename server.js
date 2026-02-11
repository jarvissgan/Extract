import express from "express";
import userRouter from "./api/userRoutes.js";
import transactionRouter from "./api/transactionRoutes.js";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const jwtCheck = auth({
  audience: process.env.VITE_authApiAudience,
  issuerBaseURL: process.env.VITE_authApiIssuerBaseURL,
  tokenSigningAlg: process.env.VITE_authApiTokenSigningAlg,
});

app.use(jwtCheck);
app.get("/authorized", (req, res) => {
  res.send("Secured Resource");
});

app.use("/api", userRouter);
app.use("/api", transactionRouter);

app.listen(3000, () =>
  console.log(
    "UI hosted on http://localhost:5173\nAPI Testing is on http://localhost:5173/api\nServer hosted on http://localhost:3000"
  )
);
