import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db-connections.js";
import { requireSetUpUser } from "./currentUser.js";
import { generateDueRecurring, periodOf } from "./recurring.js";
import { asyncRoute, checkCategory, parseOr400 } from "./validate.js";
import { recurringSchema } from "../shared/schemas.js";

const recurringRouter = Router();
recurringRouter.use("/recurring", requireSetUpUser);

const COLUMNS =
  "recurring_uuid, name, amount, category, note, day_of_month, active, start_period, last_generated_period, created_timestamp";

const findRule = async (uuid, userId) =>
  (await query(`SELECT ${COLUMNS} FROM recurring_transaction WHERE recurring_uuid = ? AND user_id = ?`, [uuid, userId]))[0];

recurringRouter.get(
  "/recurring",
  asyncRoute(async (req, res) => {
    const rows = await query(
      `SELECT ${COLUMNS} FROM recurring_transaction WHERE user_id = ? ORDER BY day_of_month, name`,
      [req.currentUser.user_id]
    );
    res.json(rows);
  })
);

// Creates a monthly rule starting this month (or `start_period`). If this month's day has already passed,
// this month's transaction is created straight away.
recurringRouter.post(
  "/recurring",
  asyncRoute(async (req, res) => {
    const body = parseOr400(recurringSchema, req.body, res);
    if (!body || !checkCategory(body.category, req.currentUser, res)) return;

    const uuid = randomUUID();
    const now = new Date();
    await query(
      "INSERT INTO recurring_transaction (recurring_uuid, user_id, name, amount, category, note, day_of_month, active, start_period, created_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [uuid, req.currentUser.user_id, body.name, body.amount, body.category, body.note, body.day_of_month, body.active, body.start_period || periodOf(now), now]
    );
    await generateDueRecurring(query, req.currentUser.user_id, now);
    res.status(200).json(await findRule(uuid, req.currentUser.user_id));
  })
);

// Updates a rule. Only future months use the new values; generated transactions are kept.
// Turning a paused rule back on starts from the current month (missed months aren't backfilled).
recurringRouter.put(
  "/recurring/:uuid",
  asyncRoute(async (req, res) => {
    const existing = await findRule(req.params.uuid, req.currentUser.user_id);
    if (!existing) return res.status(404).json({ message: "Recurring transaction not found." });

    const body = parseOr400(recurringSchema, req.body, res);
    if (!body || !checkCategory(body.category, req.currentUser, res)) return;

    const resuming = body.active && !existing.active;
    const now = new Date();
    await query(
      `UPDATE recurring_transaction SET name = ?, amount = ?, category = ?, note = ?, day_of_month = ?, active = ?, updated_timestamp = ?
       ${resuming ? ", start_period = ?, last_generated_period = NULL" : ""}
       WHERE recurring_uuid = ? AND user_id = ?`,
      [
        body.name, body.amount, body.category, body.note, body.day_of_month, body.active, now,
        ...(resuming ? [periodOf(now)] : []),
        req.params.uuid, req.currentUser.user_id,
      ]
    );
    await generateDueRecurring(query, req.currentUser.user_id, now);
    res.json(await findRule(req.params.uuid, req.currentUser.user_id));
  })
);

// Deletes a rule. Transactions it already created are kept.
recurringRouter.delete(
  "/recurring/:uuid",
  asyncRoute(async (req, res) => {
    const result = await query("DELETE FROM recurring_transaction WHERE recurring_uuid = ? AND user_id = ?", [
      req.params.uuid,
      req.currentUser.user_id,
    ]);
    if (!result.affectedRows) return res.status(404).json({ message: "Recurring transaction not found." });
    res.json({ recurring_uuid: req.params.uuid });
  })
);

export default recurringRouter;
