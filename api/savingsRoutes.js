import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db-connections.js";
import { requireSetUpUser } from "./currentUser.js";
import { asyncRoute, parseOr400 } from "./validate.js";
import { savingsEntrySchema, savingsGoalSchema } from "../shared/schemas.js";

const savingsRouter = Router();
savingsRouter.use("/savings", requireSetUpUser);

const GOAL_SELECT = `
  SELECT g.goal_uuid, g.name, g.target_amount, DATE_FORMAT(g.target_date, '%Y-%m-%d') AS target_date,
         g.emoji, g.color, g.reached_timestamp, g.created_timestamp,
         COALESCE(SUM(e.amount), 0) AS saved, COUNT(e.entry_uuid) AS entry_count
  FROM savings_goal g
  LEFT JOIN savings_entry e ON e.goal_uuid = g.goal_uuid
  WHERE g.user_id = ?`;

const findGoal = async (uuid, userId) =>
  (await query(`${GOAL_SELECT} AND g.goal_uuid = ? GROUP BY g.goal_uuid`, [userId, uuid]))[0];

// All goals with how much has been saved towards each; unfinished first.
savingsRouter.get(
  "/savings",
  asyncRoute(async (req, res) => {
    const rows = await query(
      `${GOAL_SELECT} GROUP BY g.goal_uuid ORDER BY g.reached_timestamp IS NOT NULL, g.created_timestamp`,
      [req.currentUser.user_id]
    );
    res.json(rows);
  })
);

savingsRouter.post(
  "/savings",
  asyncRoute(async (req, res) => {
    const body = parseOr400(savingsGoalSchema, req.body, res);
    if (!body) return;
    const uuid = randomUUID();
    await query(
      "INSERT INTO savings_goal (goal_uuid, user_id, name, target_amount, target_date, emoji, color, created_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [uuid, req.currentUser.user_id, body.name, body.target_amount, body.target_date, body.emoji, body.color, new Date()]
    );
    res.json(await findGoal(uuid, req.currentUser.user_id));
  })
);

savingsRouter.put(
  "/savings/:uuid",
  asyncRoute(async (req, res) => {
    const existing = await findGoal(req.params.uuid, req.currentUser.user_id);
    if (!existing) return res.status(404).json({ message: "Savings goal not found." });
    const body = parseOr400(savingsGoalSchema, req.body, res);
    if (!body) return;

    // raising the target above what's saved makes the goal unfinished again
    const reached = Number(existing.saved) >= body.target_amount;
    await query(
      `UPDATE savings_goal SET name = ?, target_amount = ?, target_date = ?, emoji = ?, color = ?, updated_timestamp = ?,
       reached_timestamp = ${reached ? "COALESCE(reached_timestamp, ?)" : "NULL"}
       WHERE goal_uuid = ? AND user_id = ?`,
      [
        body.name, body.target_amount, body.target_date, body.emoji, body.color, new Date(),
        ...(reached ? [new Date()] : []),
        req.params.uuid, req.currentUser.user_id,
      ]
    );
    res.json(await findGoal(req.params.uuid, req.currentUser.user_id));
  })
);

savingsRouter.delete(
  "/savings/:uuid",
  asyncRoute(async (req, res) => {
    const { user_id } = req.currentUser;
    // entries explicitly too, in case the tables have no foreign keys (non-InnoDB)
    await query("DELETE FROM savings_entry WHERE goal_uuid = ? AND user_id = ?", [req.params.uuid, user_id]);
    const result = await query("DELETE FROM savings_goal WHERE goal_uuid = ? AND user_id = ?", [req.params.uuid, user_id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Savings goal not found." });
    res.json({ goal_uuid: req.params.uuid });
  })
);

savingsRouter.get(
  "/savings/:uuid/entries",
  asyncRoute(async (req, res) => {
    if (!(await findGoal(req.params.uuid, req.currentUser.user_id))) {
      return res.status(404).json({ message: "Savings goal not found." });
    }
    const rows = await query(
      "SELECT entry_uuid, amount, note, created_timestamp FROM savings_entry WHERE goal_uuid = ? AND user_id = ? ORDER BY created_timestamp DESC",
      [req.params.uuid, req.currentUser.user_id]
    );
    res.json(rows);
  })
);

// Adds or takes out money. `reached` is true only on the entry that first meets the target.
savingsRouter.post(
  "/savings/:uuid/entries",
  asyncRoute(async (req, res) => {
    const { user_id } = req.currentUser;
    const goal = await findGoal(req.params.uuid, user_id);
    if (!goal) return res.status(404).json({ message: "Savings goal not found." });
    const body = parseOr400(savingsEntrySchema, req.body, res);
    if (!body) return;

    const saved = Number(goal.saved);
    const amount = body.kind === "withdraw" ? -body.amount : body.amount;
    if (saved + amount < 0) {
      return res.status(400).json({ error: "You can't take out more than you've saved." });
    }

    await query(
      "INSERT INTO savings_entry (entry_uuid, goal_uuid, user_id, amount, note, created_timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [randomUUID(), req.params.uuid, user_id, amount, body.note || null, body.entry_date ? new Date(body.entry_date) : new Date()]
    );

    const target = Number(goal.target_amount);
    const reached = !goal.reached_timestamp && saved + amount >= target;
    if (reached) {
      await query("UPDATE savings_goal SET reached_timestamp = ? WHERE goal_uuid = ?", [new Date(), req.params.uuid]);
    }
    res.json({ goal: await findGoal(req.params.uuid, user_id), reached });
  })
);

savingsRouter.delete(
  "/savings/:uuid/entries/:entry",
  asyncRoute(async (req, res) => {
    const result = await query("DELETE FROM savings_entry WHERE entry_uuid = ? AND goal_uuid = ? AND user_id = ?", [
      req.params.entry,
      req.params.uuid,
      req.currentUser.user_id,
    ]);
    if (!result.affectedRows) return res.status(404).json({ message: "Entry not found." });
    res.json({ goal: await findGoal(req.params.uuid, req.currentUser.user_id) });
  })
);

export default savingsRouter;
