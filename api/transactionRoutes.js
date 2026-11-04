import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db-connections.js";
import { requireOwnSqid, requireSetUpUser } from "./currentUser.js";
import { generateDueRecurring } from "./recurring.js";
import { asyncRoute, checkCategory, parseOr400 } from "./validate.js";
import { bulkSchema, dateRangeSchema, importSchema, transactionSchema } from "../shared/schemas.js";

const transactionRouter = Router();

const toRow = (userId, t) => [
  randomUUID(),
  userId,
  t.transaction_name,
  t.transaction_amount,
  JSON.stringify(t.transaction_details),
  t.transaction_date ? new Date(t.transaction_date) : new Date(),
  t.transaction_type,
];

const INSERT_COLUMNS =
  "transaction_uuid, user_id, transaction_name, transaction_amount, transaction_details, created_timestamp, transaction_type";

// Lists the signed-in user's transactions, newest first. Optionally filtered by an
// ISO date-time range, e.g. ?startDate=2026-11-01T00:00:00+08:00&endDate=2026-11-30T23:59:59.999+08:00
transactionRouter.get(
  "/transaction/user/:sqid",
  requireOwnSqid,
  asyncRoute(async (req, res) => {
    const { user_id } = req.currentUser;
    await generateDueRecurring(query, user_id);

    let sql = "SELECT * FROM `transaction` WHERE user_id = ?";
    const params = [user_id];

    if (req.query.startDate || req.query.endDate) {
      const range = parseOr400(dateRangeSchema, req.query, res);
      if (!range) return;
      sql += " AND created_timestamp BETWEEN ? AND ?";
      params.push(new Date(range.startDate), new Date(range.endDate));
    }

    const results = await query(`${sql} ORDER BY created_timestamp DESC`, params);
    return res.status(200).json(results);
  })
);

transactionRouter.get(
  "/transaction/:uuid",
  requireSetUpUser,
  asyncRoute(async (req, res) => {
    const [row] = await query("SELECT * FROM `transaction` WHERE transaction_uuid = ? AND user_id = ?", [
      req.params.uuid,
      req.currentUser.user_id,
    ]);
    if (!row) return res.status(404).json({ message: `Transaction '${req.params.uuid}' not found.` });
    return res.status(200).json(row);
  })
);

transactionRouter.post(
  "/transaction",
  requireSetUpUser,
  asyncRoute(async (req, res) => {
    if (req.body.sqid && req.body.sqid !== req.currentUser.user_sqid) {
      return res.status(403).json({ error: "You do not have access to this user." });
    }
    const body = parseOr400(transactionSchema, req.body, res);
    if (!body || !checkCategory(body.transaction_details.category, req.currentUser, res)) return;

    const row = toRow(req.currentUser.user_id, body);
    await query(
      `INSERT INTO \`transaction\` (${INSERT_COLUMNS}) VALUES (?)`,
      [row]
    );
    return res.status(200).json({
      transaction_uuid: row[0],
      user_sqid: req.currentUser.user_sqid,
      created_timestamp: row[5],
    });
  })
);

// Adds many transactions at once (CSV import). All rows are checked before any are saved.
transactionRouter.post(
  "/transaction/import",
  requireSetUpUser,
  asyncRoute(async (req, res) => {
    const body = parseOr400(importSchema, req.body, res);
    if (!body) return;
    for (const t of body.transactions) {
      if (!checkCategory(t.transaction_details.category, req.currentUser, res)) return;
    }

    const rows = body.transactions.map((t) => toRow(req.currentUser.user_id, t));
    await query(
      `INSERT INTO \`transaction\` (${INSERT_COLUMNS}) VALUES ?`,
      [rows]
    );
    return res.status(200).json({ imported: rows.length });
  })
);

// Deletes or re-categorizes many of the signed-in user's transactions at once.
// Transactions that don't exist or belong to someone else are ignored.
transactionRouter.post(
  "/transaction/bulk",
  requireSetUpUser,
  asyncRoute(async (req, res) => {
    const body = parseOr400(bulkSchema, req.body, res);
    if (!body) return;
    const { user_id } = req.currentUser;

    if (body.action === "delete") {
      const result = await query("DELETE FROM `transaction` WHERE user_id = ? AND transaction_uuid IN (?)", [
        user_id,
        body.uuids,
      ]);
      return res.json({ affected: result.affectedRows });
    }

    if (!checkCategory(body.category, req.currentUser, res)) return;
    const result = await query(
      "UPDATE `transaction` SET transaction_details = JSON_SET(COALESCE(transaction_details, '{}'), '$.category', ?), updated_timestamp = ? WHERE user_id = ? AND transaction_uuid IN (?)",
      [body.category, new Date(), user_id, body.uuids]
    );
    return res.json({ affected: result.affectedRows });
  })
);

transactionRouter.put(
  "/transaction/:uuid",
  requireSetUpUser,
  asyncRoute(async (req, res) => {
    const body = parseOr400(transactionSchema, req.body, res);
    if (!body || !checkCategory(body.transaction_details.category, req.currentUser, res)) return;

    const updated_timestamp = new Date();
    const fields = [body.transaction_type, body.transaction_name, body.transaction_amount, JSON.stringify(body.transaction_details), updated_timestamp];
    let sql = "UPDATE `transaction` SET transaction_type = ?, transaction_name = ?, transaction_amount = ?, transaction_details = ?, updated_timestamp = ?";
    if (body.transaction_date) {
      sql += ", created_timestamp = ?";
      fields.push(new Date(body.transaction_date));
    }

    const results = await query(`${sql} WHERE transaction_uuid = ? AND user_id = ?`, [
      ...fields,
      req.params.uuid,
      req.currentUser.user_id,
    ]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: `Transaction ${req.params.uuid} not found.` });
    }
    return res.status(200).json({ transaction_uuid: req.params.uuid, ...body, updated_timestamp });
  })
);

transactionRouter.delete(
  "/transaction/:uuid",
  requireSetUpUser,
  asyncRoute(async (req, res) => {
    const results = await query("DELETE FROM `transaction` WHERE transaction_uuid = ? AND user_id = ?", [
      req.params.uuid,
      req.currentUser.user_id,
    ]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: `Transaction ${req.params.uuid} not found.` });
    }
    return res.status(200).json({ transaction_uuid: req.params.uuid, deleted_timestamp: new Date() });
  })
);

export default transactionRouter;
