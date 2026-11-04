// Parses one-line quick entries like:
//   "coffee 4.50"            -> expense "coffee", 4.50, today
//   "4.50 coffee"            -> same, amount can come first
//   "+3200 salary"           -> income
//   "lunch 12 yesterday"     -> dated yesterday
//   "dinner 30 fri"          -> dated last Friday (or today if it's Friday)
//   "grab 15 #transport"     -> category by key or name
//   "$12.50", "S$12", "12,50" -> currency symbols and comma decimals are fine
// Shared so the parser can be unit tested in Node.

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const AMOUNT = /^(\+)?[^\d\s+#-]{0,3}(\d{1,9}(?:[.,]\d{1,2})?)$/;

// Returns { name, amount, type, categoryHint, daysAgo }.
// `amount` is null when none was typed; `name` may be "".
export function parseQuickAdd(input, now = new Date()) {
  const tokens = String(input || "").trim().split(/\s+/).filter(Boolean);
  let amount = null;
  let type = "expense";
  let categoryHint = null;
  let daysAgo = 0;
  const nameParts = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const money = amount === null ? AMOUNT.exec(token) : null;

    if (money) {
      amount = Number(money[2].replace(",", "."));
      if (money[1]) type = "income";
    } else if (lower === "+") {
      type = "income";
    } else if (lower.startsWith("#") && lower.length > 1) {
      categoryHint = lower.slice(1);
    } else if (lower === "today") {
      daysAgo = 0;
    } else if (lower === "yesterday" || lower === "yday") {
      daysAgo = 1;
    } else if (WEEKDAYS.includes(lower.slice(0, 3)) && /^[a-z]+$/.test(lower) && isWeekdayWord(lower)) {
      daysAgo = (now.getDay() - WEEKDAYS.indexOf(lower.slice(0, 3)) + 7) % 7;
    } else {
      nameParts.push(token);
    }
  }

  return { name: nameParts.join(" "), amount, type, categoryHint, daysAgo };
}

// "fri", "friday", "tues", "thurs"... but not words like "sunset" or "monitor".
const isWeekdayWord = (word) =>
  /^(sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?)$/.test(word);

// Finds a category for a hint like "food" or "Food" or "trans" (prefix of a key or label).
export function matchCategory(hint, categories) {
  if (!hint) return null;
  const h = hint.toLowerCase();
  const exact = categories.find((c) => c.value === h || c.label.toLowerCase() === h);
  if (exact) return exact.value;
  const prefix = categories.find((c) => c.value.startsWith(h) || c.label.toLowerCase().startsWith(h));
  return prefix ? prefix.value : null;
}
