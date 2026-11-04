// JSON columns may arrive as strings or already parsed, depending on the database driver.
type JsonColumn<T> = string | T | null;

export interface CategoryOption {
  value: string;
  label: string;
  color: string;
}

export interface TransactionDetails {
  category?: string;
  transaction_note?: string;
}

export type TransactionType = "expense" | "income";

export interface TransactionRow {
  transaction_uuid: string;
  transaction_type?: TransactionType;
  user_id: number;
  transaction_name: string;
  transaction_amount: number | string;
  transaction_details: JsonColumn<TransactionDetails>;
  created_timestamp: string;
  updated_timestamp: string | null;
  recurring_uuid?: string | null;
}

export interface Transaction {
  uuid: string;
  type: TransactionType;
  name: string;
  amount: number;
  category: string;
  note: string;
  createdAt: string;
  updatedAt: string | null;
  recurring: boolean;
}

export interface CategoryRule {
  pattern: string;
  category: string;
}

export interface UserPreferences {
  budgets?: { monthly?: number | ""; categories?: Record<string, number> };
  rules?: CategoryRule[];
  notifications?: { email?: boolean };
  currency?: string;
  categories?: CategoryOption[];
}

export interface UserRow {
  user_id: number;
  user_sqid: string;
  username: string;
  email: string;
  preference_json: JsonColumn<UserPreferences>;
  account_status: JsonColumn<{ status: string }>;
}

export interface RecurringRule {
  recurring_uuid: string;
  transaction_type: TransactionType;
  name: string;
  amount: number;
  category: string;
  note: string | null;
  day_of_month: number;
  active: number | boolean;
  start_period: string;
  last_generated_period: string | null;
}

export const parseJson = <T,>(value: JsonColumn<T> | undefined, fallback: T): T => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return (JSON.parse(value) as T) ?? fallback;
  } catch {
    return fallback;
  }
};
