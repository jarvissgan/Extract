import { Router } from "express";
import { query } from "../db-connections.js";
import { requireOwnSqid } from "./currentUser.js";

import Sqids from "sqids";

const userRouter = Router();
const sqids = new Sqids({ minLength: 8 });

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (typeof value === "object" && Object.keys(value).length === 0);

const firstEmptyField = (fields) =>
  Object.entries(fields).find(([, value]) => isEmpty(value))?.[0];

// returns the signed-in user's account, or 202 if they haven't set one up yet
userRouter.get("/user", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM users WHERE email = ?", [req.currentUser.email]);
    if (rows.length === 0) {
      return res.status(202).json({ message: "User not found" });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error retrieving user:", err.message);
    return res.status(500).json({ error: "Database error" });
  }
});

// gets user based on id via sqid (only the signed-in user's own sqid)
userRouter.get("/user/:sqid", requireOwnSqid, async (req, res) => {
  try {
    const rows = await query("SELECT * FROM users WHERE user_sqid = ?", [req.params.sqid]);
    if (rows.length === 0) {
      return res.status(404).json({ message: `User with sqid ${req.params.sqid} not found` });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error retrieving user:", err.message);
    return res.status(500).json({ error: "Database error" });
  }
});

// creates the signed-in user's account; the email always comes from Auth0
userRouter.post("/user", async (req, res) => {
  const { email, user_id } = req.currentUser;
  if (user_id) {
    return res.status(409).json({ error: "An account already exists for this user." });
  }

  const { username, user_details = {}, preference_json, account_status } = req.body;
  const missing = firstEmptyField({ username, preference_json, account_status });
  if (missing) {
    return res.status(400).json({
      error: `${missing} doesn't contain anything. Please check and try again.`,
    });
  }

  const created_timestamp = new Date();

  try {
    const insertResults = await query(
      "INSERT INTO users (username, user_details, preference_json, email, account_status, created_timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [
        username,
        JSON.stringify(user_details),
        JSON.stringify(preference_json),
        email,
        JSON.stringify(account_status),
        created_timestamp,
      ]
    );

    const newUserId = insertResults.insertId;
    const sqid = sqids.encode([newUserId]);
    await query("UPDATE users SET user_sqid = ?, updated_timestamp = ? WHERE user_id = ?", [
      sqid,
      new Date(),
      newUserId,
    ]);

    console.log(`Created user '${username}' (sqid '${sqid}')`);
    return res.status(200).json({ username, sqid, created_timestamp });
  } catch (err) {
    console.error(`Error creating user: ${err.message}`);
    return res.status(500).json({ error: "Database error" });
  }
});

// modifies the signed-in user's account (email can't be changed)
userRouter.put("/user/:sqid", requireOwnSqid, async (req, res) => {
  const { username, user_details = {}, preference_json, account_status } = req.body;
  const missing = firstEmptyField({ username, preference_json, account_status });
  if (missing) {
    return res.status(400).json({
      error: `${missing} doesn't contain anything. Please check and try again.`,
    });
  }

  const updated_timestamp = new Date();

  try {
    const results = await query(
      "UPDATE users SET username = ?, user_details = ?, preference_json = ?, account_status = ?, updated_timestamp = ? WHERE user_sqid = ?",
      [
        username,
        JSON.stringify(user_details),
        JSON.stringify(preference_json),
        JSON.stringify(account_status),
        updated_timestamp,
        req.params.sqid,
      ]
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: `User ${req.params.sqid} not found.` });
    }

    return res.status(200).json({
      user_sqid: req.params.sqid,
      username,
      user_details,
      preference_json,
      account_status,
      updated_timestamp,
    });
  } catch (err) {
    console.error(`Error updating user: ${err.message}`);
    return res.status(500).json({ error: "Database error" });
  }
});

userRouter.delete("/user/:sqid", requireOwnSqid, async (req, res) => {
  try {
    const results = await query("DELETE FROM users WHERE user_sqid = ?", [req.params.sqid]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: `User ${req.params.sqid} not found.` });
    }
    return res.status(200).json({ user_sqid: req.params.sqid, deleted_timestamp: new Date() });
  } catch (err) {
    console.error(`Error deleting user: ${err.message}`);
    return res.status(500).json({ error: "Database error" });
  }
});

export default userRouter;
