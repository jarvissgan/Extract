// Unit tests for the quick-add parser. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCategory, parseQuickAdd } from "../shared/quickAdd.js";

const friday = new Date(2026, 10, 6); // Fri 6 Nov 2026

test("name and amount in either order", () => {
  assert.deepEqual(parseQuickAdd("coffee 4.50"), { name: "coffee", amount: 4.5, type: "expense", categoryHint: null, daysAgo: 0 });
  assert.equal(parseQuickAdd("4.50 iced latte").name, "iced latte");
  assert.equal(parseQuickAdd("4.50 iced latte").amount, 4.5);
});

test("currency symbols and comma decimals", () => {
  assert.equal(parseQuickAdd("lunch $12").amount, 12);
  assert.equal(parseQuickAdd("lunch S$12.30").amount, 12.3);
  assert.equal(parseQuickAdd("lunch 12,30").amount, 12.3);
  assert.equal(parseQuickAdd("taxi €8").amount, 8);
});

test("only the first number is the amount", () => {
  const r = parseQuickAdd("7 eleven 3.20");
  assert.equal(r.amount, 7);
  assert.equal(r.name, "eleven 3.20");
  const r2 = parseQuickAdd("snacks 3.20 at 7-eleven");
  assert.equal(r2.amount, 3.2);
  assert.equal(r2.name, "snacks at 7-eleven");
});

test("a leading + makes it income", () => {
  assert.equal(parseQuickAdd("+3200 salary").type, "income");
  assert.equal(parseQuickAdd("salary +3200").type, "income");
  assert.equal(parseQuickAdd("refund + 20").type, "income");
  assert.equal(parseQuickAdd("salary 3200").type, "expense");
});

test("dates: today, yesterday and weekdays", () => {
  assert.equal(parseQuickAdd("lunch 12 yesterday").daysAgo, 1);
  assert.equal(parseQuickAdd("lunch 12 today").daysAgo, 0);
  assert.equal(parseQuickAdd("lunch 12 wed", friday).daysAgo, 2);
  assert.equal(parseQuickAdd("lunch 12 friday", friday).daysAgo, 0);
  assert.equal(parseQuickAdd("lunch 12 sat", friday).daysAgo, 6);
  // words that merely start like a weekday stay in the name
  assert.equal(parseQuickAdd("sunscreen 9", friday).name, "sunscreen");
  assert.equal(parseQuickAdd("monitor 199", friday).daysAgo, 0);
});

test("#category hints", () => {
  const r = parseQuickAdd("grab 15 #transport");
  assert.equal(r.categoryHint, "transport");
  assert.equal(r.name, "grab");
  const categories = [
    { value: "food", label: "Food" },
    { value: "transport", label: "Transport" },
    { value: "pets", label: "Pets" },
  ];
  assert.equal(matchCategory("Food", categories), "food");
  assert.equal(matchCategory("trans", categories), "transport");
  assert.equal(matchCategory("zzz", categories), null);
});

test("no amount or no name", () => {
  assert.equal(parseQuickAdd("coffee").amount, null);
  assert.equal(parseQuickAdd("12").name, "");
  assert.equal(parseQuickAdd("   ").name, "");
});
