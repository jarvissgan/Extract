import { randomUUID } from "node:crypto";

// Months are handled as "YYYY-MM" strings in UTC.
export const periodOf = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const nextPeriod = (period) => {
  const [y, m] = period.split("-").map(Number);
  return periodOf(new Date(Date.UTC(y, m, 1)));
};

// The rule's date in a given month; days past the end of a month use the last day (31 -> 30 Apr).
const occurrenceDate = (period, dayOfMonth) => {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, Math.min(dayOfMonth, lastDay), 12, 0, 0));
};

// Creates any transactions that active recurring rules are due for, up to `now`.
// Safe to call often and concurrently: each (rule, month) can only be inserted once.
export async function generateDueRecurring(query, userId, now = new Date()) {
  const rules = await query(
    "SELECT * FROM recurring_transaction WHERE user_id = ? AND active = TRUE",
    [userId]
  );
  const currentPeriod = periodOf(now);

  for (const rule of rules) {
    let period = rule.last_generated_period ? nextPeriod(rule.last_generated_period) : rule.start_period;
    const rows = [];
    let lastDone = rule.last_generated_period;

    while (period <= currentPeriod) {
      const when = occurrenceDate(period, rule.day_of_month);
      if (when > now) break;
      rows.push([
        randomUUID(),
        userId,
        rule.name,
        rule.amount,
        JSON.stringify({ category: rule.category, transaction_note: rule.note || "" }),
        when,
        rule.recurring_uuid,
        period,
      ]);
      lastDone = period;
      period = nextPeriod(period);
    }

    if (rows.length) {
      await query(
        "INSERT IGNORE INTO `transaction` (transaction_uuid, user_id, transaction_name, transaction_amount, transaction_details, created_timestamp, recurring_uuid, recurring_period) VALUES ?",
        [rows]
      );
      await query(
        "UPDATE recurring_transaction SET last_generated_period = ? WHERE recurring_uuid = ?",
        [lastDone, rule.recurring_uuid]
      );
    }
  }
}
