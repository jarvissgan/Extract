import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { findCategory } from "./transactions";
import type { CategoryOption, CategoryRule, Transaction, TransactionType } from "./types";
import { categoryFromRules } from "../../shared/schemas.js";
import { categoryFromMerchant } from "../../shared/merchantCategories.js";
import { parseDbsHistoryCsv } from "../../shared/statementParser.js";
import type { StatementResult, StatementRow } from "./pdfStatement";

dayjs.extend(customParseFormat);

const escape = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const transactionsToCsv = (transactions: Transaction[], categories: CategoryOption[]) => {
  const header = ["date", "name", "amount", "type", "category", "note"];
  const lines = transactions.map((t) =>
    [
      dayjs(t.createdAt).format(t.dateOnly ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm"),
      t.name,
      t.amount.toFixed(2),
      t.type,
      findCategory(categories, t.category).label,
      t.note,
    ]
      .map((v) => escape(String(v)))
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
};

export const downloadFile = (filename: string, content: string, type = "text/csv;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
};

// Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
};

const DATE_FORMATS = ["YYYY-MM-DD HH:mm", "YYYY-MM-DD", "D/M/YYYY", "D/M/YYYY HH:mm", "DD/MM/YYYY", "D MMM YYYY"];

// Reads a CSV for the same review screen as statement PDFs: bad lines become warnings
// instead of blocking the whole file. Amounts can be negative (bank exports often are):
// a negative amount with no type column is an expense.
export const csvToStatement = (
  text: string,
  fileName: string,
  categories: CategoryOption[],
  rules: CategoryRule[] = [],
): StatementResult => {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!table.length) return { kind: null, label: fileName, rows: [], warnings: ["The file is empty."] };
  // digibank's transaction history download
  const history = parseDbsHistoryCsv(table);
  if (history) return history as StatementResult;

  const [header, ...lines] = table;
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = {
    date: col("date"),
    name: col("name"),
    amount: col("amount"),
    type: col("type"),
    category: col("category"),
    note: col("note"),
  };
  const missing = (["date", "name", "amount"] as const).filter((k) => idx[k] === -1);
  if (missing.length) {
    return {
      kind: null,
      label: fileName,
      rows: [],
      warnings: [
        `Missing column(s): ${missing.join(", ")}. Use a DBS/POSB transaction history CSV, or a file with date, name and amount columns.`,
      ],
    };
  }

  const rows: StatementRow[] = [];
  const warnings: string[] = [];
  lines.forEach((cells, i) => {
    const line = i + 2;
    const get = (k: keyof typeof idx) => (idx[k] === -1 ? "" : (cells[idx[k]] ?? "").trim());

    const strict = dayjs(get("date"), DATE_FORMATS, true);
    const date = strict.isValid() ? strict : dayjs(get("date"));
    if (!date.isValid()) return warnings.push(`Line ${line}: can't read the date "${get("date")}".`);

    const name = get("name");
    if (!name) return warnings.push(`Line ${line}: the name is empty.`);

    // allows "1,234.50", "$12", "-3.5" and "SGD 4"
    const cleaned = get("amount").replace(/[^0-9.-]/g, "");
    const amount = Number(cleaned);
    if (!/\d/.test(cleaned) || !Number.isFinite(amount)) {
      return warnings.push(`Line ${line}: can't read the amount "${get("amount")}".`);
    }

    const rawType = get("type").toLowerCase();
    if (rawType && rawType !== "expense" && rawType !== "income") {
      return warnings.push(`Line ${line}: type must be "expense" or "income", not "${get("type")}".`);
    }
    const type: TransactionType = rawType ? (rawType as TransactionType) : "expense";

    const rawCategory = get("category").toLowerCase();
    const given = rawCategory
      ? categories.find((c) => c.value === rawCategory || c.label.toLowerCase() === rawCategory)
      : undefined;
    if (rawCategory && !given) return warnings.push(`Line ${line}: unknown category "${get("category")}".`);
    const category =
      given?.value ??
      (type === "income" ? "income" : (categoryFromRules(name, rules) ?? categoryFromMerchant(name) ?? "other"));

    rows.push({
      date: date.format("YYYY-MM-DD"),
      at: get("date").includes(":") ? date.toISOString() : undefined,
      name,
      amount: Math.abs(amount),
      type,
      kind: type === "income" ? "income" : "spend",
      include: amount !== 0,
      note: get("note"),
      source: fileName,
      category,
      categoryGuessed: !given,
    });
  });
  return { kind: null, label: fileName, rows, warnings };
};
