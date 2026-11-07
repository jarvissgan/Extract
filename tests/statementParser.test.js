// Statement import: parses fake DBS-style PDFs (tests/fixtures, layouts copied from real
// statements) with the same pdf.js + parser code the browser uses. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { itemsToLines } from "../shared/pdfLines.js";
import { parseStatement } from "../shared/statementParser.js";

const readPdf = async (name) => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(new URL(`./fixtures/${name}`, import.meta.url)));
  const doc = await getDocument({ data, disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(itemsToLines(items));
  }
  return pages;
};

const pick = (rows, keys = ["date", "name", "amount", "type", "kind", "include", "category"]) =>
  rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));

test("credit card statement", async () => {
  const result = parseStatement(await readPdf("dbs-card.pdf"));
  assert.equal(result.kind, "card");
  assert.equal(result.label, "DBS card statement, Oct 2026");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(pick(result.rows), [
    { date: "2026-10-02", name: "Card bill payment", amount: 500, type: "income", kind: "transfer", include: false, category: "income" },
    { date: "2026-10-08", name: "Card bill payment", amount: 1023.4, type: "income", kind: "transfer", include: false, category: "income" },
    { date: "2026-09-16", name: "GRAB* A-8XYZ123", amount: 18.6, type: "expense", kind: "spend", include: true, category: "transport" },
    { date: "2026-09-18", name: "NTUC FAIRPRICE TAMPINES", amount: 86.35, type: "expense", kind: "spend", include: true, category: "food" },
    { date: "2026-09-20", name: "NETFLIX.COM LOS GATOS US", amount: 24.71, type: "expense", kind: "spend", include: true, category: "other" },
    { date: "2026-09-25", name: "Refund: SHOPEE SINGAPORE MP", amount: 42.1, type: "income", kind: "refund", include: true, category: "income" },
    { date: "2026-09-25", name: "CCY CONVERSION FEE", amount: 0.8, type: "expense", kind: "fee", include: true, category: "other" },
    { date: "2026-10-01", name: "IPP INSTALMENT 3/12 COURTS", amount: 133.25, type: "expense", kind: "spend", include: true, category: "other" },
    { date: "2026-10-03", name: "STARBUCKS", amount: 7.2, type: "expense", kind: "spend", include: true, category: "food" },
    { date: "2026-10-10", name: "BUS/MRT 123456789", amount: 2.17, type: "expense", kind: "spend", include: true, category: "transport" },
    { date: "2026-10-12", name: "SP DIGITAL PTE. LTD.", amount: 98.4, type: "expense", kind: "spend", include: true, category: "housing" },
    { date: "2026-09-28", name: "Cashback (DBS CASHBACK - VISA LIVE)", amount: 5, type: "income", kind: "refund", include: true, category: "income" },
  ]);
  const netflix = result.rows.find((r) => r.name.startsWith("NETFLIX"));
  assert.equal(netflix.note, "Foreign currency: U.S. DOLLAR 17.99");
  assert.match(result.rows[2].source, /••4455$/);
});

test("card purchases in December on a January statement get last year's date", () => {
  const line = (text) => ({ text, items: [] });
  const result = parseStatement([
    [
      line("STATEMENT DATE   CREDIT LIMIT"),
      line("05 Jan 2027   $5,000.00"),
      line("DATE   DESCRIPTION   AMOUNT (S$)"),
      line("DBS VISA CARD NO.: 4119 0000 0000 1234"),
      line("28 DEC   COLD STORAGE   45.00"),
      line("02 JAN   GRAB*RIDE   12.00"),
    ],
  ]);
  assert.deepEqual(result.rows.map((r) => r.date), ["2026-12-28", "2027-01-02"]);
});

test("deposit account statement", async () => {
  const result = parseStatement(await readPdf("dbs-account.pdf"));
  assert.equal(result.kind, "account");
  assert.equal(result.label, "DBS/POSB account statement, Oct 2026");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(pick(result.rows), [
    { date: "2026-10-01", name: "PayNow from JOHN TAN (JOHN TAN)", amount: 50, type: "income", kind: "income", include: true, category: "income" },
    { date: "2026-10-02", name: "ATM cash withdrawal", amount: 100, type: "expense", kind: "cash", include: true, category: "other" },
    { date: "2026-10-03", name: "Cashback (DBS VISA DEBIT CASHBACK JULY)", amount: 2.5, type: "income", kind: "refund", include: true, category: "income" },
    { date: "2026-10-04", name: "PayLah! top-up", amount: 20, type: "expense", kind: "transfer", include: false, category: "other" },
    { date: "2026-10-05", name: "BUS/MRT 123456789", amount: 12.3, type: "expense", kind: "spend", include: true, category: "transport" },
    { date: "2026-10-06", name: "Credit card bill payment", amount: 300, type: "expense", kind: "transfer", include: false, category: "other" },
    { date: "2026-10-25", name: "Salary", amount: 4850, type: "income", kind: "income", include: true, category: "income" },
    { date: "2026-10-26", name: "PayNow to MARY LIM", amount: 45, type: "expense", kind: "spend", include: true, category: "other" },
    { date: "2026-10-27", name: "Bill payment SP-87654321", amount: 60, type: "expense", kind: "spend", include: true, category: "other" },
    { date: "2026-10-31", name: "Interest earned", amount: 0.41, type: "income", kind: "income", include: true, category: "income" },
  ]);
  assert.match(result.rows[0].source, /^DBS Multiplier Account ••4567$/);
});

test("other PDFs are rejected with a clear message", () => {
  const result = parseStatement([[{ text: "Hello world", items: [] }]]);
  assert.equal(result.kind, null);
  assert.equal(result.rows.length, 0);
  assert.match(result.warnings[0], /doesn't look like a DBS\/POSB/);
});
