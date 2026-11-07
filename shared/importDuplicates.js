// Finds import rows that are already in the app, or that appear in two of the files being
// imported (e.g. the same month's statement PDF and history CSV). A row is a repeat only
// when the date, amount, type AND name match, and each match is used once: two $1.79 MRT
// rides on the same day are two rides, unless the app already has two.

// "BUS/MRT 123456789" -> "busmrt"; "Refund: SHOPEE SG" -> "shopeesg"
const letters = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/^(refund|cashback)\s*[:(]\s*/, "")
    .replace(/[^a-z]/g, "");

// loose: names get cut short or tidied differently depending on the file they came from
export const sameName = (a, b) => {
  const x = letters(a);
  const y = letters(b);
  if (!x || !y) return x === y;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.startsWith(short);
};

const key = (t) => `${t.date}|${Number(t.amount).toFixed(2)}|${t.type}`;

// rows: [{ date: "YYYY-MM-DD", amount, type, name, file }] in file order
// existing: [{ date, amount, type, name }] already in the app
// returns, for each row: "app" (already in the app), "file" (also in an earlier file) or null
export function findDuplicates(rows, existing) {
  const pool = new Map(); // key -> [{ name, file, used }]
  const add = (t, file) => {
    const list = pool.get(key(t)) ?? [];
    list.push({ name: t.name, file, used: false });
    pool.set(key(t), list);
  };
  existing.forEach((t) => add(t, null));

  return rows.map((r) => {
    const match = (pool.get(key(r)) ?? []).find((c) => !c.used && c.file !== r.file && sameName(c.name, r.name));
    if (match) {
      match.used = true;
      return match.file === null ? "app" : "file";
    }
    add(r, r.file);
    return null;
  });
}
