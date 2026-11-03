import { Router } from "express";
import { query } from "../db-connections.js";
import { v4 as uuidv4 } from "uuid";
import { requireOwnSqid, requireSetUpUser } from "./currentUser.js";

const transactionRouter = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;

// returns an error message, or null when the transaction body is valid
function validateTransaction({ transaction_name, transaction_amount, transaction_details }) {
  if (typeof transaction_name !== "string" || !transaction_name.trim()) {
    return "transaction_name doesn't contain anything. Please check and try again.";
  }
  const amount = Number(transaction_amount);
  if (transaction_amount === "" || transaction_amount === null || !Number.isFinite(amount) || amount < 0) {
    return "transaction_amount must be a number that is 0 or more.";
  }
  if (transaction_details !== undefined && (typeof transaction_details !== "object" || transaction_details === null)) {
    return "transaction_details must be an object.";
  }
  return null;
}

// gets the signed-in user's transactions, optionally filtered by date range
// example: /transaction/user/abc12345?startDate=2024-03-01 00:00:00&endDate=2024-03-31 23:59:59
transactionRouter.get("/transaction/user/:sqid", requireOwnSqid, async (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = "SELECT * FROM transaction WHERE user_id = ?";
  const params = [req.currentUser.user_id];

  if (startDate || endDate) {
    if (!DATE_PATTERN.test(startDate || "") || !DATE_PATTERN.test(endDate || "")) {
      return res.status(400).json({
        error: "startDate and endDate must both be given as YYYY-MM-DD or YYYY-MM-DD HH:MM:SS.",
      });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: "startDate must be on or before endDate." });
    }
    sql += " AND created_timestamp BETWEEN ? AND ?";
    params.push(startDate, endDate);
  }

  sql += " ORDER BY created_timestamp DESC";

  try {
    const results = await query(sql, params);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Error retrieving transactions:", err.message);
    return res.status(500).json({ error: "Database error" });
  }
});

// gets one of the signed-in user's transactions via UUID
transactionRouter.get("/transaction/:uuid", requireSetUpUser, async (req, res) => {
  try {
    const results = await query(
      "SELECT * FROM transaction WHERE transaction_uuid = ? AND user_id = ?",
      [req.params.uuid, req.currentUser.user_id]
    );
    if (results.length === 0) {
      return res.status(404).json({
        message: `Transaction with transaction_uuid '${req.params.uuid}' not found. Check and try again.`,
      });
    }
    return res.status(200).json(results[0]);
  } catch (err) {
    console.error("Error retrieving transaction:", err.message);
    return res.status(500).json({ error: "Database error" });
  }
});

// creates a transaction for the signed-in user and assigns it a transaction_uuid
transactionRouter.post("/transaction", requireSetUpUser, async (req, res) => {
  const { sqid, transaction_name, transaction_amount, transaction_details = {} } = req.body;

  if (sqid && sqid !== req.currentUser.user_sqid) {
    return res.status(403).json({ error: "You do not have access to this user." });
  }

  const validationError = validateTransaction(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const transaction_uuid = uuidv4();
  const created_timestamp = new Date();

  try {
    await query(
      "INSERT INTO transaction (transaction_uuid, user_id, transaction_name, transaction_amount, transaction_details, created_timestamp) VALUES (?,?,?,?,?,?)",
      [
        transaction_uuid,
        req.currentUser.user_id,
        transaction_name.trim(),
        Number(transaction_amount),
        JSON.stringify(transaction_details),
        created_timestamp,
      ]
    );
    return res.status(200).json({
      transaction_uuid,
      user_sqid: req.currentUser.user_sqid,
      created_timestamp,
    });
  } catch (err) {
    console.error(`Error creating transaction: ${err.message}`);
    return res.status(500).json({ error: "Database error" });
  }
});

// modifies one of the signed-in user's transactions via UUID
transactionRouter.put("/transaction/:uuid", requireSetUpUser, async (req, res) => {
  const { transaction_name, transaction_amount, transaction_details = {} } = req.body;

  const validationError = validateTransaction(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const updated_timestamp = new Date();

  try {
    const results = await query(
      "UPDATE transaction SET transaction_name = ?, transaction_amount = ?, transaction_details = ?, updated_timestamp = ? WHERE transaction_uuid = ? AND user_id = ?",
      [
        transaction_name.trim(),
        Number(transaction_amount),
        JSON.stringify(transaction_details),
        updated_timestamp,
        req.params.uuid,
        req.currentUser.user_id,
      ]
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: `Transaction ${req.params.uuid} not found.` });
    }

    return res.status(200).json({
      transaction_uuid: req.params.uuid,
      transaction_name: transaction_name.trim(),
      transaction_amount: Number(transaction_amount),
      transaction_details,
      updated_timestamp,
    });
  } catch (err) {
    console.error(`Error updating transaction: ${err.message}`);
    return res.status(500).json({ error: "Database error" });
  }
});

// deletes one of the signed-in user's transactions via UUID
transactionRouter.delete("/transaction/:uuid", requireSetUpUser, async (req, res) => {
  try {
    const results = await query(
      "DELETE FROM transaction WHERE transaction_uuid = ? AND user_id = ?",
      [req.params.uuid, req.currentUser.user_id]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: `Transaction ${req.params.uuid} not found.` });
    }
    return res.status(200).json({ transaction_uuid: req.params.uuid, deleted_timestamp: new Date() });
  } catch (err) {
    console.error(`Error deleting transaction: ${err.message}`);
    return res.status(500).json({ error: "Database error" });
  }
});

export default transactionRouter;
