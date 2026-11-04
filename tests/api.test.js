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
  const inRange = await api("GET", `/transaction/user/${sqid}?startDate=2000-01-01&endDate=2999-12-31`, { as: alice });
  const outOfRange = await api("GET", `/transaction/user/${sqid}?startDate=2000-01-01&endDate=2000-01-31`, { as: alice });
  const backwards = await api("GET", `/transaction/user/${sqid}?startDate=2001-01-01&endDate=2000-01-01`, { as: alice });
  const garbage = await api("GET", `/transaction/user/${sqid}?startDate=yesterday&endDate=today`, { as: alice });
  assert.equal(inRange.body.length, 1);
  assert.equal(outOfRange.body.length, 0);
  assert.equal(backwards.status, 400);
  assert.equal(garbage.status, 400);
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
