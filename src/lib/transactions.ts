import dayjs from "dayjs";
import { parseJson, type CategoryOption, type Transaction, type TransactionRow } from "./types";

export const toTransaction = (row: TransactionRow): Transaction => {
  const details = parseJson(row.transaction_details, {});
  return {
    uuid: row.transaction_uuid,
    name: row.transaction_name,
    amount: Number(row.transaction_amount) || 0,
    category: details.category || "other",
    note: details.transaction_note ?? "",
    createdAt: row.created_timestamp,
    updatedAt: row.updated_timestamp,
    recurring: !!row.recurring_uuid,
  };
};

const UNKNOWN_CATEGORY = { label: "Other", color: "gray.6" };

export const findCategory = (categories: CategoryOption[], value: string) =>
  categories.find((c) => c.value === value) ?? { value, ...UNKNOWN_CATEGORY };

export const makeMoneyFormatter = (currency: string) => {
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat("en-US", { style: "currency", currency });
  } catch {
    format = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  }
  return (value: number) => format.format(value);
};

// "$", "S$", "€"... for input prefixes
export const currencySymbol = (currency: string) => {
  try {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? "$"
    );
  } catch {
    return "$";
  }
};

export const formatDateTime = (value: string | null) =>
  value ? dayjs(value).format("D MMM YYYY, h:mm A") : "—";

export const formatDate = (value: string | null) => (value ? dayjs(value).format("D MMM YYYY") : "—");
