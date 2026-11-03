import express from "express";
import userRouter from "./api/userRoutes.js";
import transactionRouter from "./api/transactionRoutes.js";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";
import { resolveCurrentUser } from "./api/currentUser.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: process.env.AUTH0_TOKEN_SIGNING_ALG,
});

app.use(jwtCheck);
app.get("/authorized", (req, res) => {
  res.send("Secured Resource");
});

app.use("/api", resolveCurrentUser);
app.use("/api", userRouter);
app.use("/api", transactionRouter);

app.listen(port, () =>
  console.log(
    `UI hosted on http://localhost:5173\nAPI Testing is on http://localhost:5173/api\nServer hosted on http://localhost:${port}`
  )
);
