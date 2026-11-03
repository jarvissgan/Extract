import dayjs from "dayjs";
import type { Category, Transaction, TransactionDetails, TransactionRow } from "./types";

export const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: "food", label: "Food", color: "orange.6" },
  { value: "housing", label: "Housing", color: "blue.6" },
  { value: "transport", label: "Transport", color: "teal.6" },
  { value: "other", label: "Other", color: "gray.6" },
];

export const CATEGORY_OPTIONS = CATEGORIES.map(({ value, label }) => ({ value, label }));

const findCategory = (value: Category) => CATEGORIES.find((c) => c.value === value);

export const categoryLabel = (value: Category) => findCategory(value)?.label ?? "Other";
export const categoryColor = (value: Category) => findCategory(value)?.color ?? "gray.6";

const parseDetails = (raw: TransactionRow["transaction_details"]): TransactionDetails => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
};

export const toTransaction = (row: TransactionRow): Transaction => {
  const details = parseDetails(row.transaction_details);
  const category =
    details.category && findCategory(details.category) ? details.category : "other";
  return {
    uuid: row.transaction_uuid,
    name: row.transaction_name,
    amount: Number(row.transaction_amount) || 0,
    category,
    note: details.transaction_note ?? "",
    createdAt: row.created_timestamp,
    updatedAt: row.updated_timestamp,
  };
};

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatMoney = (value: number) =>
  `${value < 0 ? "-" : ""}$${money.format(Math.abs(value))}`;

export const formatDateTime = (value: string | null) =>
  value ? dayjs(value).format("D MMM YYYY, h:mm A") : "—";
