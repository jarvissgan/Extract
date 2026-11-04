// Validation shared by the API (Node) and the frontend (Vite), so both apply the same rules.
import { z } from "zod";

export const BUILTIN_CATEGORIES = [
  { value: "food", label: "Food", color: "orange.6" },
  { value: "housing", label: "Housing", color: "blue.6" },
  { value: "transport", label: "Transport", color: "teal.6" },
  { value: "other", label: "Other", color: "gray.6" },
  { value: "income", label: "Income", color: "green.6" },
];

export const TRANSACTION_TYPES = ["expense", "income"];
const transactionType = z.enum(TRANSACTION_TYPES).default("expense");

export const MAX_RULES = 200;
export const MAX_BULK = 1000;

export const CATEGORY_COLORS = ["grape.6", "pink.6", "cyan.6", "lime.6", "yellow.6", "indigo.6", "red.6", "violet.6"];

export const CURRENCIES = ["USD", "SGD", "EUR", "GBP", "AUD", "CAD", "MYR", "JPY", "CNY", "INR", "HKD", "NZD"];

export const MAX_IMPORT_ROWS = 1000;

// Turns "" / null into "missing" and numeric strings into numbers before checking.
const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
};

export const amountSchema = z.preprocess(
  toNumber,
  z
    .number({ error: "Amount must be a number" })
    .min(0, "Amount can't be negative")
    .max(1_000_000_000, "Amount is too large")
);

export const isoDateTime = z.iso.datetime({ offset: true, error: "Must be an ISO date-time" });

const categoryKey = z.string().trim().min(1, "Category is required").max(40);

export const transactionDetailsSchema = z.object({
  category: categoryKey.default("other"),
  transaction_note: z.string().max(2000, "Note is too long").default(""),
});

export const transactionSchema = z.object({
  transaction_type: transactionType,
  transaction_name: z.string().trim().min(1, "Name is required").max(255, "Name is too long"),
  transaction_amount: amountSchema,
  transaction_details: transactionDetailsSchema.default({ category: "other", transaction_note: "" }),
  // when the transaction happened; defaults to now
  transaction_date: isoDateTime.optional(),
});

export const importSchema = z.object({
  transactions: z
    .array(transactionSchema.extend({ transaction_date: isoDateTime }))
    .min(1, "Nothing to import")
    .max(MAX_IMPORT_ROWS, `You can import at most ${MAX_IMPORT_ROWS} rows at a time`),
});

export const dateRangeSchema = z
  .object({ startDate: isoDateTime, endDate: isoDateTime })
  .refine((r) => new Date(r.startDate) <= new Date(r.endDate), {
    message: "startDate must be on or before endDate",
  });

export const customCategorySchema = z.object({
  value: z.string().regex(/^[a-z0-9-]{1,40}$/, "Use lowercase letters, numbers and dashes"),
  label: z.string().trim().min(1, "Name is required").max(40),
  color: z.string().max(20),
});

// "if the name contains <pattern>, use <category>"; checked in order, first match wins
export const ruleSchema = z.object({
  pattern: z.string().trim().min(2, "Use at least 2 characters").max(60),
  category: categoryKey,
});

const budgetAmount = z.number().min(0).max(1_000_000_000);

export const preferencesSchema = z.object({
  budgets: z
    .object({
      monthly: z.union([z.literal(""), budgetAmount]).optional(),
      // per-category monthly budgets, by category key
      categories: z.record(z.string(), budgetAmount).default({}),
    })
    .default({ categories: {} }),
  rules: z.array(ruleSchema).max(MAX_RULES, `At most ${MAX_RULES} rules`).default([]),
  notifications: z.object({ email: z.boolean().default(false) }).default({ email: false }),
  currency: z.enum(CURRENCIES).default("USD"),
  categories: z
    .array(customCategorySchema)
    .max(30, "At most 30 custom categories")
    .default([])
    .refine((list) => new Set(list.map((c) => c.value)).size === list.length, "Category names must be unique")
    .refine(
      (list) => list.every((c) => !BUILTIN_CATEGORIES.some((b) => b.value === c.value)),
      "Custom categories can't reuse a built-in name"
    ),
});

export const userSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(255),
  user_details: z.record(z.string(), z.unknown()).default({}),
  preference_json: preferencesSchema,
  account_status: z.object({ status: z.string().min(1) }).default({ status: "active" }),
});

export const recurringSchema = z.object({
  transaction_type: transactionType,
  name: z.string().trim().min(1, "Name is required").max(255),
  amount: amountSchema,
  category: categoryKey.default("other"),
  note: z.string().max(2000).default(""),
  day_of_month: z.coerce.number().int().min(1, "Day must be 1-31").max(31, "Day must be 1-31"),
  active: z.boolean().default(true),
  // first month to create a transaction for (YYYY-MM); defaults to the current month
  start_period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be YYYY-MM").optional(),
});

export const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), uuids: z.array(z.string().max(36)).min(1).max(MAX_BULK) }),
  z.object({
    action: z.literal("categorize"),
    uuids: z.array(z.string().max(36)).min(1).max(MAX_BULK),
    category: categoryKey,
  }),
]);

export const GOAL_COLORS = ["pink", "grape", "violet", "blue", "teal", "lime", "yellow", "orange"];

const positiveAmount = z.preprocess(
  toNumber,
  z
    .number({ error: "Amount must be a number" })
    .positive("Amount must be more than 0")
    .max(1_000_000_000, "Amount is too large")
);

export const savingsGoalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  target_amount: positiveAmount,
  // optional deadline, YYYY-MM-DD
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable()
    .optional()
    .transform((v) => v || null),
  emoji: z.string().max(16).nullable().optional().transform((v) => v || null),
  color: z.enum(GOAL_COLORS).default("pink"),
});

export const savingsEntrySchema = z.object({
  kind: z.enum(["deposit", "withdraw"]).default("deposit"),
  amount: positiveAmount,
  note: z.string().trim().max(255).default(""),
  entry_date: isoDateTime.optional(),
});

// Category for a transaction name from the user's rules, or null.
export const categoryFromRules = (name, rules) => {
  const lower = String(name || "").toLowerCase();
  const rule = (rules || []).find((r) => lower.includes(r.pattern.toLowerCase()));
  return rule ? rule.category : null;
};

// "transaction_amount: Amount must be a number"
export const describeError = (error) => {
  const issue = error.issues[0];
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
};

// { "transaction_amount": "Amount must be a number", ... } for showing next to form fields
export const fieldErrors = (error) =>
  Object.fromEntries(error.issues.map((i) => [i.path.join("."), i.message]).reverse());

export const userCategories = (preferences) => [
  ...BUILTIN_CATEGORIES,
  ...((preferences && preferences.categories) || []),
];
