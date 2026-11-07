// Unit tests for spotting repeats when importing. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicates, sameName } from "../shared/importDuplicates.js";

const ride = (file, name = "BUS/MRT 123456789") => ({ date: "2026-10-05", amount: 1.79, type: "expense", name, file });

test("names match loosely", () => {
  assert.ok(sameName("BUS/MRT 123456789", "BUS/MRT 987654321"));
  assert.ok(sameName("XXX XXXXXXX XXXXXXX", "XXX XXXXXXX XXXXXXX XXXXX")); // cut short in one file
  assert.ok(!sameName("BUS/MRT 123456789", "GRAB* A-8XYZ123"));
  assert.ok(!sameName("Train fare", "BUS/MRT 123456789"));
});

test("same-day rides in one file are separate rides", () => {
  assert.deepEqual(findDuplicates([ride("a.csv"), ride("a.csv"), ride("a.csv")], []), [null, null, null]);
});

test("each transaction in the app cancels out one imported row", () => {
  const inApp = [ride(null), ride(null)];
  assert.deepEqual(findDuplicates([ride("a.csv"), ride("a.csv"), ride("a.csv")], inApp), ["app", "app", null]);
});

test("a different name on the same day and amount isn't a repeat", () => {
  assert.deepEqual(findDuplicates([ride("a.csv", "GRAB* A-8XYZ123")], [ride(null)]), [null]);
});

test("the same transaction in two files is caught once", () => {
  const rows = [ride("statement.pdf"), ride("statement.pdf"), ride("history.csv"), ride("history.csv"), ride("history.csv")];
  assert.deepEqual(findDuplicates(rows, []), [null, null, "file", "file", null]);
});
