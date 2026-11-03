export type Category = "other" | "food" | "housing" | "transport";

export interface TransactionDetails {
  category?: Category;
  transaction_note?: string;
}

// Row as returned by the API (JSON columns arrive as strings).
export interface TransactionRow {
  transaction_uuid: string;
  user_id: number;
  transaction_name: string;
  transaction_amount: number | string;
  transaction_details: string | TransactionDetails | null;
  created_timestamp: string;
  updated_timestamp: string | null;
}

export interface Transaction {
  uuid: string;
  name: string;
  amount: number;
  category: Category;
  note: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface UserRow {
  user_id: number;
  user_sqid: string;
  username: string;
  email: string;
  preference_json: string | null;
}

export interface UserPreferences {
  budgets?: { monthly?: number | string };
  notifications?: { email?: boolean };
}
