// API integration tests. Run with `npm test` (starts the database if needed).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { query, closeDb } from "../db-connections.js";

const run = Date.now();
const alice = `alice-${run}@test.local`;
const bob = `bob-${run}@test.local`;

let server;
let baseUrl;

const api = async (method, path, { as, body } = {}) => {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(as ? { Authorization: `Bearer dev:${encodeURIComponent(as)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const createUser = (email) =>
  api("POST", "/user", {
    as: email,
    body: {
      username: email.split("@")[0],
      preference_json: { budgets: { monthly: 1000 } },
      account_status: { status: "active" },
    },
  });

const newTransaction = (overrides = {}) => ({
  transaction_name: "Coffee",
  transaction_amount: 4.5,
  transaction_details: { category: "food" },
  ...overrides,
});

const state = {};

before(async () => {
  process.env.AUTH_MODE = "dev";
  await new Promise((resolve) => {
    server = createApp().listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await query("DELETE FROM users WHERE email IN (?, ?)", [alice, bob]);
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
});

test("rejects requests without a token", async () => {
  const res = await api("GET", "/user");
  assert.equal(res.status, 401);
});

test("new users get 202 until they set up an account", async () => {
  const res = await api("GET", "/user", { as: alice });
  assert.equal(res.status, 202);
});

test("creates accounts, and only once per user", async () => {
  const a = await createUser(alice);
  const b = await createUser(bob);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  state.aliceSqid = a.body.sqid;
  state.bobSqid = b.body.sqid;

  const again = await createUser(alice);
  assert.equal(again.status, 409);

  const me = await api("GET", "/user", { as: alice });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, alice);
});

test("users can only read their own account", async () => {
  assert.equal((await api("GET", `/user/${state.aliceSqid}`, { as: alice })).status, 200);
  assert.equal((await api("GET", `/user/${state.aliceSqid}`, { as: bob })).status, 403);
});

test("creates and lists transactions", async () => {
  const created = await api("POST", "/transaction", { as: alice, body: newTransaction() });
  assert.equal(created.status, 200);
  state.aliceTx = created.body.transaction_uuid;

  const list = await api("GET", `/transaction/user/${state.aliceSqid}`, { as: alice });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((t) => t.transaction_uuid), [state.aliceTx]);
});

test("validates transaction input", async () => {
  const noName = await api("POST", "/transaction", { as: alice, body: newTransaction({ transaction_name: " " }) });
  const badAmount = await api("POST", "/transaction", { as: alice, body: newTransaction({ transaction_amount: "abc" }) });
  const negative = await api("POST", "/transaction", { as: alice, body: newTransaction({ transaction_amount: -1 }) });
  assert.equal(noName.status, 400);
  assert.equal(badAmount.status, 400);
  assert.equal(negative.status, 400);
});

test("filters by date range and rejects bad ranges", async () => {
  const sqid = state.aliceSqid;
  const range = (start, end) =>
    `/transaction/user/${sqid}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
  const inRange = await api("GET", range("2000-01-01T00:00:00Z", "2999-12-31T23:59:59Z"), { as: alice });
  const outOfRange = await api("GET", range("2000-01-01T00:00:00Z", "2000-01-31T23:59:59Z"), { as: alice });
  const backwards = await api("GET", range("2001-01-01T00:00:00Z", "2000-01-01T00:00:00Z"), { as: alice });
  const garbage = await api("GET", `/transaction/user/${sqid}?startDate=yesterday&endDate=today`, { as: alice });
  assert.equal(inRange.body.length, 1);
  assert.equal(outOfRange.body.length, 0);
  assert.equal(backwards.status, 400);
  assert.equal(garbage.status, 400);
});

test("rejects unknown categories and accepts the user's custom ones", async () => {
  const unknown = await api("POST", "/transaction", {
    as: alice,
    body: newTransaction({ transaction_details: { category: "travel" } }),
  });
  assert.equal(unknown.status, 400);

  const me = (await api("GET", "/user", { as: alice })).body;
  const prefs = typeof me.preference_json === "string" ? JSON.parse(me.preference_json) : me.preference_json;
  const saved = await api("PUT", `/user/${state.aliceSqid}`, {
    as: alice,
    body: {
      username: me.username,
      preference_json: { ...prefs, currency: "SGD", categories: [{ value: "travel", label: "Travel", color: "grape.6" }] },
    },
  });
  assert.equal(saved.status, 200);

  const known = await api("POST", "/transaction", {
    as: alice,
    body: newTransaction({ transaction_details: { category: "travel" } }),
  });
  assert.equal(known.status, 200);
  await api("DELETE", `/transaction/${known.body.transaction_uuid}`, { as: alice });

  const clash = await api("PUT", `/user/${state.aliceSqid}`, {
    as: alice,
    body: { username: me.username, preference_json: { categories: [{ value: "food", label: "Food 2", color: "red.6" }] } },
  });
  assert.equal(clash.status, 400);
});

test("stores transaction dates in UTC and returns them as ISO", async () => {
  const when = "2026-03-15T23:30:00+08:00"; // 15:30 UTC
  const created = await api("POST", "/transaction", {
    as: alice,
    body: newTransaction({ transaction_name: "Late dinner", transaction_date: when }),
  });
  const fetched = await api("GET", `/transaction/${created.body.transaction_uuid}`, { as: alice });
  assert.equal(fetched.body.created_timestamp, "2026-03-15T15:30:00.000Z");
  assert.equal(typeof fetched.body.transaction_amount, "number");
  await api("DELETE", `/transaction/${created.body.transaction_uuid}`, { as: alice });
});

test("imports many transactions at once, all or nothing", async () => {
  const rows = [
    { transaction_name: "Imported A", transaction_amount: "12.50", transaction_date: "2025-01-02T10:00:00Z" },
    { transaction_name: "Imported B", transaction_amount: 3, transaction_date: "2025-01-03T10:00:00Z", transaction_details: { category: "food" } },
  ];
  const bad = await api("POST", "/transaction/import", {
    as: bob,
    body: { transactions: [...rows, { transaction_name: "", transaction_amount: 1, transaction_date: "2025-01-04T10:00:00Z" }] },
  });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /transactions\.2\.transaction_name/);

  const ok = await api("POST", "/transaction/import", { as: bob, body: { transactions: rows } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.imported, 2);
  const list = await api("GET", `/transaction/user/${state.bobSqid}`, { as: bob });
  assert.equal(list.body.length, 2);
});

test("recurring rules create one transaction per month and can be paused", async () => {
  const now = new Date();
  const today = Math.max(1, now.getUTCDate() - 1);
  // generated transactions are dated 12:00 UTC on their day
  const expected = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), today, 12) <= now.getTime() ? 1 : 0;
  const created = await api("POST", "/recurring", {
    as: alice,
    body: { name: "Gym", amount: 40, category: "other", day_of_month: today },
  });
  assert.equal(created.status, 200);
  const uuid = created.body.recurring_uuid;

  // listing twice must not duplicate this month's transaction
  await api("GET", `/transaction/user/${state.aliceSqid}`, { as: alice });
  const list = await api("GET", `/transaction/user/${state.aliceSqid}`, { as: alice });
  assert.equal(list.body.filter((t) => t.recurring_uuid === uuid).length, expected);

  const paused = await api("PUT", `/recurring/${uuid}`, {
    as: alice,
    body: { name: "Gym", amount: 40, category: "other", day_of_month: today, active: false },
  });
  assert.equal(paused.body.active, 0);

  assert.equal((await api("GET", "/recurring", { as: bob })).body.length, 0);
  assert.equal((await api("DELETE", `/recurring/${uuid}`, { as: bob })).status, 404);
  assert.equal((await api("DELETE", `/recurring/${uuid}`, { as: alice })).status, 200);

  // the generated transaction is kept
  const after = await api("GET", `/transaction/user/${state.aliceSqid}`, { as: alice });
  assert.equal(after.body.filter((t) => t.transaction_name === "Gym").length, expected);
});

test("links an account created before auth_sub existed on next login", async () => {
  const legacy = `legacy-${run}@test.local`;
  await query(
    "INSERT INTO users (username, preference_json, email, account_status, user_sqid) VALUES ('legacy', '{}', ?, '{}', ?)",
    [legacy, `legacy${run}`]
  );
  const me = await api("GET", "/user", { as: legacy });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, legacy);
  const [row] = await query("SELECT auth_sub FROM users WHERE email = ?", [legacy]);
  assert.equal(row.auth_sub, `dev|${legacy}`);
  await query("DELETE FROM users WHERE email = ?", [legacy]);
});

test("users cannot see or change other users' transactions", async () => {
  const tx = state.aliceTx;
  assert.equal((await api("GET", `/transaction/user/${state.aliceSqid}`, { as: bob })).status, 403);
  assert.equal((await api("GET", `/transaction/${tx}`, { as: bob })).status, 404);
  assert.equal((await api("PUT", `/transaction/${tx}`, { as: bob, body: newTransaction() })).status, 404);
  assert.equal((await api("DELETE", `/transaction/${tx}`, { as: bob })).status, 404);
  assert.equal(
    (await api("POST", "/transaction", { as: bob, body: { ...newTransaction(), sqid: state.aliceSqid } })).status,
    403
  );
});

test("owners can update and delete their transactions", async () => {
  const tx = state.aliceTx;
  const updated = await api("PUT", `/transaction/${tx}`, {
    as: alice,
    body: newTransaction({ transaction_name: "Latte", transaction_amount: 5.2 }),
  });
  assert.equal(updated.status, 200);

  const fetched = await api("GET", `/transaction/${tx}`, { as: alice });
  assert.equal(fetched.body.transaction_name, "Latte");
  assert.equal(Number(fetched.body.transaction_amount), 5.2);

  assert.equal((await api("DELETE", `/transaction/${tx}`, { as: alice })).status, 200);
  assert.equal((await api("GET", `/transaction/${tx}`, { as: alice })).status, 404);
});
