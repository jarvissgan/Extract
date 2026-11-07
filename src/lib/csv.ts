import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { findCategory } from "./transactions";
import type { CategoryOption, CategoryRule, Transaction, TransactionType } from "./types";
import { categoryFromRules } from "../../shared/schemas.js";

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
      .join(",")
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

export interface ImportRow {
  transaction_type: TransactionType;
  transaction_name: string;
  transaction_amount: string;
  transaction_date: string;
  transaction_details: { category: string; transaction_note: string };
}

export interface ImportResult {
  rows: ImportRow[];
  errors: string[];
}

// Turns CSV text into API rows. Columns are matched by header name (any order, any case):
// date, name, amount, type (expense/income, optional), category (name or key, optional), note (optional).
// A blank category is filled from the user's rules.
export const csvToImportRows = (
  text: string,
  categories: CategoryOption[],
  rules: CategoryRule[] = []
): ImportResult => {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], errors: ["The file is empty."] };

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
  if (missing.length) return { rows: [], errors: [`Missing column(s): ${missing.join(", ")}.`] };

  const rows: ImportRow[] = [];
  const errors: string[] = [];

  lines.forEach((cells, i) => {
    const line = i + 2;
    const get = (k: keyof typeof idx) => (idx[k] === -1 ? "" : (cells[idx[k]] ?? "").trim());

    const date = dayjs(get("date"), DATE_FORMATS, true);
    const parsedDate = date.isValid() ? date : dayjs(get("date"));
    if (!parsedDate.isValid()) {
      errors.push(`Line ${line}: can't read the date "${get("date")}".`);
      return;
    }

    const rawType = get("type").toLowerCase();
    if (rawType && rawType !== "expense" && rawType !== "income") {
      errors.push(`Line ${line}: type must be "expense" or "income", not "${get("type")}".`);
      return;
    }
    const type: TransactionType = rawType === "income" ? "income" : "expense";

    const rawCategory = get("category").toLowerCase();
    const category = rawCategory
      ? categories.find((c) => c.value === rawCategory || c.label.toLowerCase() === rawCategory)
      : { value: categoryFromRules(get("name"), rules) ?? (type === "income" ? "income" : "other") };
    if (!category) {
      errors.push(`Line ${line}: unknown category "${get("category")}".`);
      return;
    }

    rows.push({
      transaction_type: type,
      transaction_name: get("name"),
      transaction_amount: get("amount").replace(/[^0-9.,-]/g, ""),
      transaction_date: parsedDate.toISOString(),
      transaction_details: {
        category: category.value,
        transaction_note: get("note"),
        ...(get("date").includes(":") ? {} : { date_only: true }),
      },
    });
  });

  return { rows, errors };
};
