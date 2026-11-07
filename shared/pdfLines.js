// Turns the positioned text items pdf.js extracts from a page into visual lines.
// Each line keeps its items with x positions, so callers can tell table columns apart
// (e.g. a statement's Withdrawal vs Deposit column). Shared by the browser importer
// and scripts/redact-statement.js.

// items: pdf.js TextItem[] ({ str, transform: [a, b, c, d, x, y], width })
// returns [{ y, text, items: [{ str, x, right }] }] from top to bottom
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const width = it.width || it.str.length * 5;
    const row = rows.find((r) => Math.abs(r.y - y) < 2.5);
    const item = { str: it.str, x, right: x + width };
    if (row) row.items.push(item);
    else rows.push({ y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);

  return rows.map(({ y, items: parts }) => {
    parts.sort((a, b) => a.x - b.x);
    let text = "";
    let end = parts[0].x;
    for (const p of parts) {
      const charWidth = p.str.length ? (p.right - p.x) / p.str.length : 5;
      const gap = Math.round((p.x - end) / Math.max(charWidth, 1));
      if (text) text += " ".repeat(Math.max(1, Math.min(gap, 40)));
      text += p.str;
      end = p.right;
    }
    // eslint-disable-next-line no-control-regex -- strip stray control characters from PDF text
    return { y, text: text.replace(/[\u0000-\u001f]/g, " ").trimEnd(), items: parts };
  });
}
