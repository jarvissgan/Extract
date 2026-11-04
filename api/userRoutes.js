import { Router } from "express";
import Sqids from "sqids";
import { query } from "../db-connections.js";
import { requireOwnSqid } from "./currentUser.js";
import { asyncRoute, parseOr400 } from "./validate.js";
import { userSchema } from "../shared/schemas.js";

const userRouter = Router();
const sqids = new Sqids({ minLength: 8 });

const PUBLIC_COLUMNS =
  "user_id, user_sqid, username, email, user_details, preference_json, account_status, created_timestamp, updated_timestamp";

// returns the signed-in user's account, or 202 if they haven't set one up yet
userRouter.get(
  "/user",
  asyncRoute(async (req, res) => {
    if (!req.currentUser.user_id) return res.status(202).json({ message: "User not found" });
    const [user] = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE user_id = ?`, [req.currentUser.user_id]);
    return res.status(200).json(user);
  })
);

userRouter.get(
  "/user/:sqid",
  requireOwnSqid,
  asyncRoute(async (req, res) => {
    const [user] = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE user_sqid = ?`, [req.params.sqid]);
    if (!user) return res.status(404).json({ message: `User with sqid ${req.params.sqid} not found` });
    return res.status(200).json(user);
  })
);

// creates the signed-in user's account; the email always comes from Auth0
userRouter.post(
  "/user",
  asyncRoute(async (req, res) => {
    const { sub, email, user_id } = req.currentUser;
    if (user_id) return res.status(409).json({ error: "An account already exists for this user." });

    const body = parseOr400(userSchema, req.body, res);
    if (!body) return;

    const [taken] = await query("SELECT user_id FROM users WHERE email = ?", [email]);
    if (taken) {
      return res.status(409).json({
        error: "This email already belongs to an account created with a different login method.",
      });
    }

    const created_timestamp = new Date();
    const insert = await query(
      "INSERT INTO users (auth_sub, username, user_details, preference_json, email, account_status, created_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        sub,
        body.username,
        JSON.stringify(body.user_details),
        JSON.stringify(body.preference_json),
        email,
        JSON.stringify(body.account_status),
        created_timestamp,
      ]
    );

    const sqid = sqids.encode([insert.insertId]);
    await query("UPDATE users SET user_sqid = ?, updated_timestamp = ? WHERE user_id = ?", [
      sqid,
      new Date(),
      insert.insertId,
    ]);

    return res.status(200).json({ username: body.username, sqid, created_timestamp });
  })
);

// updates the signed-in user's account (email can't be changed here)
userRouter.put(
  "/user/:sqid",
  requireOwnSqid,
  asyncRoute(async (req, res) => {
    const body = parseOr400(userSchema, req.body, res);
    if (!body) return;

    const updated_timestamp = new Date();
    await query(
      "UPDATE users SET username = ?, user_details = ?, preference_json = ?, account_status = ?, updated_timestamp = ? WHERE user_sqid = ?",
      [
        body.username,
        JSON.stringify(body.user_details),
        JSON.stringify(body.preference_json),
        JSON.stringify(body.account_status),
        updated_timestamp,
        req.params.sqid,
      ]
    );

    return res.status(200).json({ user_sqid: req.params.sqid, ...body, updated_timestamp });
  })
);

userRouter.delete(
  "/user/:sqid",
  requireOwnSqid,
  asyncRoute(async (req, res) => {
    // delete child rows explicitly too, in case older tables have no ON DELETE CASCADE
    const { user_id } = req.currentUser;
    await query("DELETE FROM recurring_transaction WHERE user_id = ?", [user_id]);
    await query("DELETE FROM savings_entry WHERE user_id = ?", [user_id]);
    await query("DELETE FROM savings_goal WHERE user_id = ?", [user_id]);
    await query("DELETE FROM `transaction` WHERE user_id = ?", [user_id]);
    await query("DELETE FROM users WHERE user_id = ?", [user_id]);
    return res.status(200).json({ user_sqid: req.params.sqid, deleted_timestamp: new Date() });
  })
);

export default userRouter;
