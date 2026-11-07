// Unit tests for the statement redaction script. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { redactLine } from "../scripts/redact-statement.js";

test("masks names, addresses, merchants and every digit", () => {
  assert.equal(redactLine("MR JARVIS TAN WEI MING"), "XX XXXXXX XXX XXX XXXX");
  assert.equal(redactLine("123 Orchard Road #12-34"), "999 Xxxxxxx Xxxx #99-99");
  assert.equal(redactLine("CARD NO.: 4119 1100 2233 4455"), "CARD NO.: 9999 9999 9999 9999");
  assert.equal(redactLine("14 OCT NTUC FAIRPRICE TAMPINES SINGAPORE SG 86.35"), "99 OCT XXXX XXXXXXXXX XXXXXXXX SINGAPORE SG 99.99");
});

test("keeps statement structure: months, headings, markers, currencies", () => {
  assert.equal(redactLine("DATE DESCRIPTION AMOUNT (S$)"), "DATE DESCRIPTION AMOUNT (S$)");
  assert.equal(redactLine("10 OCT PAYMENT - DBS INTERNET/WIRELESS 1,523.40 CR"), "99 OCT PAYMENT - DBS INTERNET/WIRELESS 9,999.99 CR");
  assert.equal(redactLine("02/10/2026 Point-of-Sale Transaction 23.45"), "99/99/9999 Point-of-Sale Transaction 99.99");
  assert.equal(redactLine("U.S. DOLLAR 17.99 USD"), "X.X. XXXXXX 99.99 USD");
});

test("masks other scripts and lookalike currency labels", () => {
  assert.equal(redactLine("Zoë 陈"), "XXX X");
  assert.equal(redactLine("J$ 5"), "X$ 9");
});
