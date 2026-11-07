// Generates dummy users and transactions for local development.
//
// Usage: npm run db:seed -- [options]
//   --users a@x.com,b@x.com   emails to create (default: dev@extract.local,alice@extract.local)
//   --months 6                months of history, including the current month (default 6)
//   --per-month 20            random transactions per month, on top of monthly bills (default 20)
//   --budget 2000             monthly budget for each user (default 2000)
//   --seed 42                 random seed, so the same options give the same data (default 42)
//
// Re-running replaces the transactions of the listed users; other users are left alone.
// always the local Docker database, never the one in .env
import "./use-local-db.js";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import Sqids from "sqids";
import { connect } from "./connect.js";
import { generateDueRecurring } from "../api/recurring.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed with NODE_ENV=production.");
  process.exit(1);
}

const { values: opts } = parseArgs({
  options: {
    users: { type: "string", default: "dev@extract.local,alice@extract.local" },
    months: { type: "string", default: "6" },
    "per-month": { type: "string", default: "20" },
    budget: { type: "string", default: "2000" },
    seed: { type: "string", default: "42" },
  },
});

const emails = opts.users.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const months = Math.max(1, Number(opts.months));
const perMonth = Math.max(0, Number(opts["per-month"]));
const budget = Number(opts.budget);

// small deterministic PRNG (mulberry32)
let state = Number(opts.seed) >>> 0;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => Math.round((min + random() * (max - min)) * 100) / 100;

// fixed monthly bills and salary, created as recurring rules: [name, amount, category, day, type]
const RECURRING = [
  ["Salary", 3200, "income", 25, "income"],
  ["Rent", 1200, "housing", 1, "expense"],
  ["Phone plan", 30, "bills", 5, "expense"],
  ["Internet", 49.9, "bills", 15, "expense"],
  ["Streaming subscription", 15.99, "bills", 20, "expense"],
];

// [name, min, max, weight]
const CATALOG = {
  groceries: [["Groceries", 25, 140, 5]],
  food: [
    ["Coffee", 3.5, 7, 6],
    ["Lunch", 8, 22, 6],
    ["Dinner out", 25, 90, 3],
    ["Food delivery", 15, 45, 3],
    ["Bakery", 4, 15, 2],
  ],
  transport: [
    ["Train fare", 1.5, 4, 6],
    ["Bus fare", 1, 3, 4],
    ["Taxi", 10, 35, 2],
    ["Fuel", 40, 90, 1],
    ["Parking", 3, 15, 1],
  ],
  housing: [
    ["Home supplies", 10, 60, 1],
  ],
  travel: [
    ["Weekend trip", 120, 350, 1],
    ["Hotel", 80, 200, 1],
  ],
  other: [
    ["Haircut", 15, 40, 1],
  ],
  entertainment: [["Movie tickets", 12, 30, 1]],
  health: [
    ["Gym day pass", 10, 20, 1],
    ["Pharmacy", 6, 40, 1],
  ],
  shopping: [
    ["Gift", 20, 120, 1],
    ["Bookstore", 10, 45, 1],
  ],
};

const weighted = Object.entries(CATALOG).flatMap(([category, items]) =>
  items.flatMap(([name, min, max, weight]) => Array(weight).fill({ category, name, min, max }))
);

const NOTES = ["", "", "", "", "Paid by card", "Split with a friend", "Monthly", "Work related"];

// a random time in the given month, never in the future
const randomTime = (year, month, day) => {
  const now = new Date();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastDay = year === now.getFullYear() && month === now.getMonth() ? now.getDate() : daysInMonth;
  const d = new Date(year, month, day ?? 1 + Math.floor(random() * lastDay), 7 + Math.floor(random() * 15), Math.floor(random() * 60));
  return d > now ? now : d;
};

function transactionsFor(userId) {
  const rows = [];
  const now = new Date();
  const add = (name, amount, category, when, note = "") =>
    rows.push([randomUUID(), userId, name, amount, JSON.stringify({ category, transaction_note: note }), when]);

  for (let i = months - 1; i >= 0; i--) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const [y, m] = [first.getFullYear(), first.getMonth()];

    // a variable monthly bill (fixed bills come from recurring rules below)
    if (i > 0 || now.getDate() >= 15) add("Electricity bill", between(60, 140), "bills", randomTime(y, m, 15));

    // day-to-day spending (fewer so far in the current month)
    const count = i === 0 ? Math.round((perMonth * now.getDate()) / 30) : perMonth;
    for (let n = 0; n < count; n++) {
      const item = pick(weighted);
      add(item.name, between(item.min, item.max), item.category, randomTime(y, m), pick(NOTES));
    }
  }
  return rows;
}

const sqids = new Sqids({ minLength: 8 });
const db = await connect();

try {
  for (const email of emails) {
    const username = email.split("@")[0].replace(/^./, (c) => c.toUpperCase());
    const prefs = JSON.stringify({
      budgets: { monthly: budget, categories: { food: Math.round(budget * 0.25), transport: Math.round(budget * 0.08) } },
      rules: [
        { pattern: "grab", category: "transport" },
        { pattern: "fairprice", category: "groceries" },
        { pattern: "netflix", category: "bills" },
      ],
      notifications: { email: false },
      currency: "USD",
      categories: [{ value: "pets", label: "Pets", color: "yellow.6" }],
    });

    const existing = await db.query("SELECT user_id FROM users WHERE email = ?", [email]);
    let userId = existing[0]?.user_id;

    if (!userId) {
      const res = await db.query(
        "INSERT INTO users (auth_sub, username, user_details, preference_json, email, account_status, created_timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [`dev|${email}`, username, "{}", prefs, email, JSON.stringify({ status: "active" })]
      );
      userId = res.insertId;
    } else {
      await db.query("UPDATE users SET preference_json = ?, updated_timestamp = NOW() WHERE user_id = ?", [prefs, userId]);
    }

    const sqid = sqids.encode([userId]);
    await db.query("UPDATE users SET user_sqid = ? WHERE user_id = ?", [sqid, userId]);

    await db.query("DELETE FROM `transaction` WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM recurring_transaction WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM savings_entry WHERE user_id = ?", [userId]);
    await db.query("DELETE FROM savings_goal WHERE user_id = ?", [userId]);

    // savings goals with a few deposits each: [name, target, emoji, color, monthsAgo deposits...]
    const goals = [
      ["Japan trip", 3000, "🗾", "pink", [400, 350, 500, 300]],
      ["Emergency fund", 6000, "🛟", "teal", [1000, 500, 500, 250]],
      ["New laptop", 1800, "💻", "grape", [600, 600, 600]],
    ];
    for (const [name, target, emoji, color, deposits] of goals) {
      const goalId = randomUUID();
      const total = deposits.reduce((a, b) => a + b, 0);
      const created = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - deposits.length, 3));
      await db.query(
        "INSERT INTO savings_goal (goal_uuid, user_id, name, target_amount, target_date, emoji, color, reached_timestamp, created_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [goalId, userId, name, target, null, emoji, color, total >= target ? new Date() : null, created]
      );
      await db.query(
        "INSERT INTO savings_entry (entry_uuid, goal_uuid, user_id, amount, note, created_timestamp) VALUES ?",
        [deposits.map((amount, i) => [randomUUID(), goalId, userId, amount, i === 0 ? "First deposit" : null, new Date(created.getTime() + i * 30 * 864e5)])]
      );
    }

    const rows = transactionsFor(userId);
    if (rows.length) {
      await db.query(
        "INSERT INTO `transaction` (transaction_uuid, user_id, transaction_name, transaction_amount, transaction_details, created_timestamp) VALUES ?",
        [rows]
      );
    }

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const startPeriod = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
    await db.query(
      "INSERT INTO recurring_transaction (recurring_uuid, user_id, transaction_type, name, amount, category, note, day_of_month, active, start_period, created_timestamp) VALUES ?",
      [RECURRING.map(([name, amount, category, day, type]) => [randomUUID(), userId, type, name, amount, category, "Monthly", day, true, startPeriod, start])]
    );
    await generateDueRecurring(db.query, userId, now);

    const [{ total }] = await db.query("SELECT COUNT(*) AS total FROM `transaction` WHERE user_id = ?", [userId]);
    console.log(`${email.padEnd(28)} sqid ${sqid}  ${total} transactions over ${months} month(s), ${RECURRING.length} recurring`);
  }
} finally {
  await db.end();
}
