// Reads DBS/POSB PDF statements (credit card, and consolidated deposit account statements)
// from lines produced by itemsToLines() in shared/pdfLines.js. Pure functions, so they run
// in the browser (where the PDF is read; it's never uploaded) and in Node tests.
//
// parseStatement(pages) -> {
//   kind: "card" | "account" | null,
//   label: "DBS card statement, Oct 2026",
//   rows: [{ date: "YYYY-MM-DD", name, amount, type: "expense" | "income",
//            kind: "spend" | "fee" | "income" | "refund" | "transfer" | "cash",
//            include, note, source, category }],
//   warnings: [string],
// }
// `include` is the suggested default. PayLah! top-ups, funds transfers and card bill payments
// from the bank account are ticked (money leaving the account); only the card statement's
// "payment received" credit is unticked, since it isn't income.
import { categoryFromMerchant } from "./merchantCategories.js";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const AMOUNT = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;
const toAmount = (s) => Number(String(s).replace(/,/g, ""));
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const clean = (s) => s.replace(/\s+/g, " ").trim();

const monthLabel = (y, m) => `${MONTHS[m][0]}${MONTHS[m].slice(1).toLowerCase()} ${y}`;

export function detectStatement(lines) {
  const text = lines.map((l) => l.text).join("\n");
  if (/CARD NO\.?\s*:/i.test(text) && /AMOUNT\s*\(S\$\)/i.test(text)) return "card";
  if (/Withdrawal\s*\(-\)/i.test(text) && /Deposit\s*\(\+\)/i.test(text)) return "account";
  return null;
}

export function parseStatement(pages) {
  const lines = pages.flat();
  const kind = detectStatement(lines);
  if (kind === "card") return parseCard(lines);
  if (kind === "account") return parseAccount(lines);
  const history = parseHistoryPdf(lines);
  if (history) return history;
  return {
    kind: null,
    label: "",
    rows: [],
    warnings: ["This doesn't look like a DBS/POSB card or account statement, so nothing was read from it."],
  };
}

const finish = (row) => {
  const category =
    row.type === "income"
      ? "income"
      : /^Credit card bill payment$/.test(row.name)
        ? "bills"
        : row.kind === "transfer"
          ? "transfers"
          : (categoryFromMerchant(row.name) ?? "other");
  return { ...row, category };
};

// ---------------------------------------------------------------- credit cards

const CARD_TXN = new RegExp(
  `^(\\d{1,2})\\s+(${MONTHS.join("|")})\\s+(.+?)\\s+(\\d{1,3}(?:,\\d{3})*\\.\\d{2})(\\s*CR)?\\s*$`,
  "i",
);
const CARD_SKIP = /^(PREVIOUS BALANCE|SUB-?TOTAL|TOTAL\b|NEW TRANSACTIONS|REF NO)/i;
const FOREIGN_LINE = /^([A-Z][A-Z. ]{2,}?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})$/;

// trailing "SINGAPORE SG", "SG", "SGP", "(SGP) SG" location noise on card lines
const cardMerchant = (desc) => clean(desc.replace(/\s+\(?SGP\)?(\s+SG)?$/i, "").replace(/\s+(SINGAPORE\s+)?SG$/i, ""));

function describeCardTxn(desc, credit) {
  if (credit && /PAYMENT|PYMT/i.test(desc))
    return { name: "Card bill payment", type: "income", kind: "transfer", include: false };
  if (credit) {
    const cashback = /CASHBACK|REBATE/i.test(desc);
    return {
      name: cashback ? `Cashback (${cardMerchant(desc)})` : `Refund: ${cardMerchant(desc)}`,
      type: "income",
      kind: "refund",
      include: true,
    };
  }
  if (/\bFEE\b|CHARGE|INTEREST|FINANCE/i.test(desc))
    return { name: cardMerchant(desc), type: "expense", kind: "fee", include: true };
  return { name: cardMerchant(desc), type: "expense", kind: "spend", include: true };
}

function parseCard(lines) {
  const warnings = [];
  const rows = [];

  // statement date: the first "DD Mon YYYY" after the STATEMENT DATE heading
  let statement = null;
  const headIdx = lines.findIndex((l) => /STATEMENT DATE/i.test(l.text));
  for (const l of lines.slice(Math.max(headIdx, 0), Math.max(headIdx, 0) + 4)) {
    const m = new RegExp(`(\\d{1,2})\\s+(${MONTHS.join("|")})[a-z]*\\s+(\\d{4})`, "i").exec(l.text);
    if (m) {
      statement = { d: Number(m[1]), m: MONTHS.indexOf(m[2].toUpperCase()), y: Number(m[3]) };
      break;
    }
  }
  if (!statement) {
    warnings.push("Couldn't find the statement date; using this year for transaction dates.");
    const now = new Date();
    statement = { d: now.getDate(), m: now.getMonth(), y: now.getFullYear() };
  }

  let inTable = false;
  let card = "";
  let last = null;

  for (const { text } of lines) {
    const t = text.trim();
    if (/^DATE\s+DESCRIPTION\s+AMOUNT/i.test(t)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (/TOTAL FOR ALL CARD|GRAND TOTAL/i.test(t)) break; // end of transactions

    const cardLine = /^(.*?)\s*CARD NO\.?\s*:\s*([\d\s]+)$/i.exec(t);
    if (cardLine) {
      const digits = cardLine[2].replace(/\D/g, "");
      card = `${clean(cardLine[1]) || "Card"} ••${digits.slice(-4)}`;
      last = null;
      continue;
    }

    const m = CARD_TXN.exec(t);
    if (m) {
      const day = Number(m[1]);
      const month = MONTHS.indexOf(m[2].toUpperCase());
      // a December purchase on a January statement belongs to the previous year
      const year = month > statement.m ? statement.y - 1 : statement.y;
      const desc = clean(m[3]);
      const amount = toAmount(m[4]);
      const credit = !!m[5];

      const row = describeCardTxn(desc, credit);
      last = finish({
        ...row,
        date: isoDate(year, month, day),
        amount,
        note: "",
        source: card || "DBS card",
      });
      rows.push(last);
      continue;
    }

    if (CARD_SKIP.test(t)) {
      if (!/^REF NO/i.test(t)) last = null;
      continue;
    }

    // "U.S. DOLLAR 17.99" under a purchase: keep the original currency amount as a note
    const fx = FOREIGN_LINE.exec(t);
    if (last && fx && !/TOTAL/i.test(fx[1])) {
      last.note = clean(`${last.note} Foreign currency: ${clean(fx[1])} ${fx[2]}`);
    }
  }

  if (!rows.length) warnings.push("No transactions found in this card statement.");
  return { kind: "card", label: `DBS card statement, ${monthLabel(statement.y, statement.m)}`, rows, warnings };
}

// ------------------------------------------------------------ deposit accounts

const ACCOUNT_TXN = /^(\d{2})\/(\d{2})\/(\d{4})\b/;
const ACCOUNT_STOP =
  /^(Balance Brought Forward|Balance Carried Forward|Total Balance Carried Forward|Transaction Details|Account Summary|CURRENCY:)|Page \d+ of \d+|^SG\d{6,}|[A-Z]{2,}_[A-Z0-9]+_/i;

// "XXX/XXX 123456789   SI SGP 05OCT" -> "XXX/XXX 123456789"
const debitMerchant = (s) =>
  clean(
    s
      .replace(/\s+\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i, "")
      .replace(/(\s+[A-Z]{2})?\s+SGP?$/i, "")
      .replace(/\s+SINGAPORE$/i, ""),
  );

function describeAccountTxn(desc, details, type) {
  const d = desc.replace(/^Advice\s+/i, "");
  const joined = details.join(" ");
  const first = details[0] || "";

  if (/Debit Card Transaction/i.test(d)) {
    const merchant = debitMerchant(first) || "Debit card purchase";
    if (/CASHBACK|REBATE/i.test(first)) return { name: `Cashback (${merchant})`, kind: "refund", include: true };
    if (type === "income") return { name: `Refund: ${merchant}`, kind: "refund", include: true };
    return { name: merchant, kind: "spend", include: true };
  }
  if (/PAYLAH/i.test(joined)) return { name: "PayLah! top-up", kind: "transfer", include: true };
  if (/Bill Payment/i.test(d)) {
    if (/DBSC|CARD|\b\d{16}\b|-\d{16}/i.test(first))
      return { name: "Credit card bill payment", kind: "transfer", include: true };
    const payee = clean(first.split(":")[0]) || "Bill";
    return { name: `Bill payment ${payee}`, kind: "spend", include: true };
  }
  if (/FAST Payment|PayNow/i.test(d) || /PAYNOW/i.test(joined)) {
    const to = /\bTO:\s*(.+)/i.exec(joined);
    const from = /\bFROM:\s*(.+)/i.exec(joined);
    const who = (m) => clean(m[1].replace(/\s+(PAYNOW TRANSFER|OTHR|OTHER|SG\d+).*$/i, ""));
    if (type === "income")
      return { name: from ? `PayNow from ${who(from)}` : "Incoming PayNow", kind: "income", include: true };
    return { name: to ? `PayNow to ${who(to)}` : "PayNow transfer", kind: "spend", include: true };
  }
  if (/Salary/i.test(d)) return { name: "Salary", kind: "income", include: true };
  if (/Interest/i.test(d)) return { name: "Interest earned", kind: "income", include: true };
  if (/ATM/i.test(d)) return { name: "ATM cash withdrawal", kind: "cash", include: true };
  if (/Funds Transfer|Remittance|Transfer of Funds/i.test(d)) {
    return type === "income"
      ? { name: "Incoming transfer", kind: "income", include: true }
      : { name: "Funds transfer", kind: "transfer", include: true };
  }
  if (/GIRO/i.test(d))
    return { name: clean(`GIRO ${first.split(":")[0]}`), kind: type === "income" ? "income" : "spend", include: true };
  return { name: clean(d) || "Bank transaction", kind: type === "income" ? "income" : "spend", include: true };
}

function parseAccount(lines) {
  const warnings = [];
  const rows = [];
  let columns = null; // right edges of the Withdrawal / Deposit / Balance headings
  let account = "";
  let balance = null;
  let pending = null; // transaction collecting its detail lines
  let statementMonth = null;

  const flush = () => {
    if (!pending) return;
    const info = describeAccountTxn(pending.desc, pending.details, pending.type);
    rows.push(
      finish({
        ...info,
        type: info.kind === "refund" || info.kind === "income" ? "income" : pending.type,
        date: pending.date,
        amount: pending.amount,
        note: "",
        source: account || "DBS account",
      }),
    );
    pending = null;
  };

  for (const line of lines) {
    const t = line.text.trim();

    const asAt = /Transaction Details as (?:at|of) (\d{1,2}) (\w{3})\w* (\d{4})/i.exec(t);
    if (asAt && !statementMonth) statementMonth = { m: MONTHS.indexOf(asAt[2].toUpperCase()), y: Number(asAt[3]) };

    const section = /^(.*?)\s+Account No\.?\s*([\d-]+)\s*$/i.exec(t);
    if (section) {
      flush();
      account = `${clean(section[1])} ••${section[2].replace(/\D/g, "").slice(-4)}`;
      continue;
    }

    if (/Withdrawal/i.test(t) && /Deposit/i.test(t)) {
      flush();
      const find = (re) => line.items.find((i) => re.test(i.str));
      const w = find(/Withdrawal/i);
      const d = find(/Deposit/i);
      const b = [...line.items].reverse().find((i) => /Balance/i.test(i.str));
      columns = { withdrawal: w?.right, deposit: d?.right, balance: b?.right };
      continue;
    }
    if (!columns) continue; // still on the summary page

    const brought = /Balance Brought Forward\s+(?:SGD\s+)?([\d,]+\.\d{2})/i.exec(t);
    if (brought) {
      flush();
      balance = toAmount(brought[1]);
      continue;
    }

    const m = ACCOUNT_TXN.exec(t);
    if (m) {
      flush();
      const numbers = line.items
        .map((i) => ({ value: i.str.trim(), right: i.right }))
        .filter((i) => AMOUNT.test(i.value))
        .map((i) => ({ amount: toAmount(i.value), right: i.right }));
      const nearest = (right) =>
        Object.entries(columns)
          .filter(([, x]) => x != null)
          .sort((a, b) => Math.abs(a[1] - right) - Math.abs(b[1] - right))[0]?.[0];

      let amount = null;
      let type = null;
      let newBalance = null;
      for (const n of numbers) {
        const col = nearest(n.right);
        if (col === "balance") newBalance = n.amount;
        else if (amount === null) {
          amount = n.amount;
          type = col === "deposit" ? "income" : "expense";
        }
      }
      // the running balance settles any doubt about which column an amount was in
      if (amount !== null && balance !== null && newBalance !== null) {
        if (Math.abs(balance - amount - newBalance) < 0.005) type = "expense";
        else if (Math.abs(balance + amount - newBalance) < 0.005) type = "income";
        else warnings.push(`Balance didn't add up on ${m[1]}/${m[2]}/${m[3]}; check that line.`);
      }
      if (newBalance !== null) balance = newBalance;
      if (amount === null) continue; // a line with only a balance

      const desc = clean(
        line.items
          .filter((i) => !AMOUNT.test(i.str.trim()))
          .map((i) => i.str)
          .join(" ")
          .replace(ACCOUNT_TXN, ""),
      );
      pending = { date: `${m[3]}-${m[2]}-${m[1]}`, amount, type, desc, details: [] };
      continue;
    }

    if (ACCOUNT_STOP.test(t)) {
      flush();
      continue;
    }
    if (pending && !/^VALUE DATE/i.test(t) && !/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(t)) pending.details.push(t);
  }
  flush();

  if (!rows.length) warnings.push("No transactions found in this account statement.");
  const label = statementMonth
    ? `DBS/POSB account statement, ${monthLabel(statementMonth.y, statementMonth.m)}`
    : "DBS/POSB account statement";
  return { kind: "account", label, rows, warnings };
}

// ------------------------------------------- digibank transaction history (CSV)

// The CSV digibank downloads from an account's transaction history: a few summary lines
// ("Account Details For:", balances), then a header row with "Transaction Date",
// "Statement Code", "Description", "Supplementary Code", "Client Reference",
// "Debit Amount", "Credit Amount" and others. `table` is the parsed CSV (rows of cells).
// Returns null when it isn't that format.
export function parseDbsHistoryCsv(table) {
  const headerAt = table.slice(0, 30).findIndex((r) => {
    const h = r.map((c) => c.trim().toLowerCase());
    return h.includes("transaction date") && h.includes("debit amount") && h.includes("credit amount");
  });
  if (headerAt === -1) return null;

  const header = table[headerAt].map((c) => c.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const first = (...names) => names.map(col).find((i) => i !== -1) ?? -1;
  const at = {
    date: col("transaction date"),
    code: col("statement code"),
    desc: first("description", "transaction description", "transaction details", "details", "particulars", "merchant"),
    supp: col("supplementary code"),
    suppDesc: col("supplementary code description"),
    client: col("client reference"),
    status: first("status", "transaction status"),
    debit: col("debit amount"),
    credit: col("credit amount"),
  };

  // a credit card's history has a description but none of the bank account's code columns
  const isCard = at.code === -1 && at.supp === -1;

  const summary = Object.fromEntries(
    table
      .slice(0, headerAt)
      .filter((r) => r[0])
      .map((r) => [r[0].trim().replace(/:$/, "").toLowerCase(), (r[1] ?? "").trim()]),
  );
  // "Account Details For: DBS Multiplier Account 120-456789-0", or a card's name and number
  const accountName =
    summary["account details for"] || Object.entries(summary).find(([k]) => /card/.test(k))?.[1] || "";
  const accountNo = /([\d -]{6,})\s*$/.exec(accountName);
  const source = accountNo
    ? `${clean(accountName.replace(accountNo[0], "")) || (isCard ? "Card" : "Account")} ••${accountNo[1].replace(/\D/g, "").slice(-4)}`
    : accountName || (isCard ? "DBS/POSB card" : "DBS/POSB account");

  const rows = [];
  const warnings = [];
  table.slice(headerAt + 1).forEach((r, i) => {
    const get = (k) => (at[k] === -1 ? "" : clean(r[at[k]] ?? ""));
    if (!get("date") && !get("debit") && !get("credit")) return; // blank or footer line
    const line = headerAt + i + 2;

    const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(get("date"));
    const month = m ? MONTHS.indexOf(m[2].toUpperCase()) : -1;
    if (!m || month === -1) return warnings.push(`Line ${line}: can't read the date "${get("date")}".`);
    if (/pending|fail|reject|cancel/i.test(get("status"))) return; // not final yet

    const debit = get("debit") ? toAmount(get("debit")) : 0;
    const credit = get("credit") ? toAmount(get("credit")) : 0;
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || (!debit && !credit)) {
      return warnings.push(`Line ${line}: can't read the amount.`);
    }
    const type = credit ? "income" : "expense";

    rows.push(
      finish({
        ...(isCard
          ? describeCardTxn(get("desc"), type === "income")
          : describeHistoryTxn(get("code"), get("suppDesc"), get("supp"), get("desc"), get("client"), type)),
        date: isoDate(Number(m[3]), month, Number(m[1])),
        amount: credit || debit,
        type,
        note: "",
        source,
      }),
    );
  });

  if (!rows.length) warnings.push("No transactions found in this file.");
  else if (rows.filter((r) => r.name === "Bank transaction").length > rows.length / 2) {
    warnings.push(
      "Couldn't find the transaction names in this file's columns. Run npm run statement:redact on it and share the result so this format can be supported.",
    );
  }
  const dates = rows.map((r) => r.date).sort();
  const span = dates.length
    ? [dates[0], dates[dates.length - 1]].map((d) => monthLabel(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1))
    : [];
  const label = `DBS/POSB ${isCard ? "card " : ""}transaction history${span.length ? `, ${span[0] === span[1] ? span[0] : `${span[0]} – ${span[1]}`}` : ""}`;
  return { kind: "history", label, rows, warnings };
}

// code: "POS", "INT", "ATM", "ICT", ...; supp: the short description, e.g.
// "UMC GRAB*GRABFOOD  SI SGP 05NOV", "ICT PayNow Transfer 1234567", "TOP-UP TO PAYLAH! :"
function describeHistoryTxn(code, suppDesc, supp, desc, client, type) {
  const all = `${supp} ${desc} ${client}`;
  const income = type === "income";

  if (code === "POS" || /point-of-sale/i.test(suppDesc)) {
    const merchant =
      debitMerchant(
        supp
          .replace(/^[A-Z]{3}\s+(?=\S)/, "") // card network code, e.g. UMC / MST
          .replace(/^NETS\s+\d+,\s*/i, "")
          .split(/\s{2,}/)[0],
      ).replace(/\s+\d{6,}\s+[A-Z]{3}$/, "") || "Debit card purchase"; // foreign: "... 8665712775 IRL"
    if (/CASHBACK|REBATE/i.test(supp)) return { name: `Cashback (${merchant})`, kind: "refund", include: true };
    if (income) return { name: `Refund: ${merchant}`, kind: "refund", include: true };
    return { name: merchant, kind: "spend", include: true };
  }
  if (code === "INT" || /interest/i.test(suppDesc)) return { name: "Interest earned", kind: "income", include: true };
  if (code === "ATM" || /^ATM$/i.test(suppDesc)) {
    return income
      ? { name: "ATM deposit", kind: "income", include: true }
      : { name: "ATM cash withdrawal", kind: "cash", include: true };
  }
  if (/PAYLAH/i.test(all)) {
    // money moved back from PayLah! isn't income
    return income
      ? { name: "From PayLah!", kind: "transfer", include: false }
      : { name: "PayLah! top-up", kind: "transfer", include: true };
  }
  if (/PAYNOW|FAST/i.test(all)) {
    const party = /\b(?:TO|FROM):\s*(.+)/i.exec(client) || /\b(?:TO|FROM):\s*(.+)/i.exec(desc);
    const who = party
      ? clean(party[1].replace(/\s+(PAYNOW TRANSFER|OTHR|OTHER|SG\d+)\b.*$/i, "").replace(/\s+-$/, ""))
      : "";
    if (income) return { name: who ? `PayNow from ${who}` : "Incoming PayNow", kind: "income", include: true };
    return { name: who ? `PayNow to ${who}` : "PayNow transfer", kind: "spend", include: true };
  }
  if (/^BILL\b/i.test(supp)) {
    if (/DBSC|CARD|\d{16}/i.test(supp)) return { name: "Credit card bill payment", kind: "transfer", include: true };
    const payee = clean(supp.replace(/^BILL\s+/i, "").split(/[-:]/)[0]) || "Bill";
    return { name: `Bill payment ${payee}`, kind: "spend", include: true };
  }
  if (/GIRO/i.test(suppDesc) || /^(PAY|IBG|GIRO)\b/i.test(supp)) {
    const who = clean(supp.replace(/^(PAY|IBG|GIRO)\s+/i, "")) || "GIRO";
    if (income && /\bSAL(ARY)?\b/i.test(all)) return { name: "Salary", kind: "income", include: true };
    return { name: income ? `GIRO from ${who}` : `GIRO ${who}`, kind: income ? "income" : "spend", include: true };
  }
  if (/\b\d{3}-\d{5,6}-\d\b/.test(all) || /FUNDS TRANSFER|\bTRF\b|REMITTANCE/i.test(all)) {
    return income
      ? { name: "Incoming transfer", kind: "income", include: true }
      : { name: "Funds transfer", kind: "transfer", include: true };
  }
  const name = clean(supp.replace(/\s+[A-Z0-9]*\d{6,}[A-Z0-9]*.*$/, "")) || clean(desc) || "Bank transaction";
  return { name, kind: income ? "income" : "spend", include: true };
}

// ------------------------------------------ transaction history saved as PDF

const HISTORY_DATE = /^(\d{1,2})[ -]([A-Za-z]{3})[ -](\d{4})\b/;

// The transaction history page saved as a PDF: a header row with a date column and
// Debit/Credit (or Withdrawal/Deposit) columns, then one line per transaction starting
// with a date like "05 Nov 2026", sometimes followed by more description lines.
function parseHistoryPdf(lines) {
  const headerAt = lines.findIndex(
    (l) => /\bDate\b/i.test(l.text) && /Debit|Withdrawal/i.test(l.text) && /Credit|Deposit/i.test(l.text),
  );
  if (headerAt === -1) return null;
  const header = lines[headerAt];
  const edge = (re) => header.items.find((i) => re.test(i.str))?.right;
  const columns = { debit: edge(/Debit|Withdrawal/i), credit: edge(/Credit|Deposit/i) };
  if (columns.debit === undefined || columns.credit === undefined) return null;

  const accountLine = lines
    .slice(0, headerAt)
    .find((l) => /Account/i.test(l.text) && /\d{3}-?\d{5,6}-?\d/.test(l.text));
  const accountNo = accountLine && /(\d{3}-?\d{5,6}-?\d)/.exec(accountLine.text);
  const accountName =
    accountLine && clean(accountLine.text.replace(/Account Details For:?/i, "").replace(accountNo[1], ""));
  const source = accountNo
    ? `${accountName || "Account"} ••${accountNo[1].replace(/\D/g, "").slice(-4)}`
    : "DBS/POSB account";

  const rows = [];
  const warnings = [];
  let pending = null;
  const flush = () => {
    if (!pending) return;
    const [first, ...rest] = pending.parts;
    const all = clean(pending.parts.join(" "));
    if (!/pending/i.test(all)) {
      rows.push(
        finish({
          ...describeHistoryTxn("", all, first, all, rest.join(" "), pending.type),
          date: pending.date,
          amount: pending.amount,
          type: pending.type,
          note: "",
          source,
        }),
      );
    }
    pending = null;
  };

  for (const line of lines.slice(headerAt + 1)) {
    const t = line.text.trim();
    if (/Page \d+ of \d+/i.test(t) || line === header || (/\bDate\b/i.test(t) && /Debit|Withdrawal/i.test(t))) continue;
    const m = HISTORY_DATE.exec(t);
    if (!m) {
      if (pending && t) pending.parts.push(t);
      continue;
    }
    flush();
    const month = MONTHS.indexOf(m[2].toUpperCase());
    // amounts: the items whose right edge sits under the Debit or Credit heading
    const near = (x) => line.items.find((i) => AMOUNT.test(i.str.trim()) && Math.abs(i.right - x) < 25);
    const debit = near(columns.debit);
    const credit = near(columns.credit);
    if (month === -1 || (!debit && !credit)) {
      warnings.push(`Couldn't read the line "${t.slice(0, 40)}…".`);
      continue;
    }
    const amountItem = credit ?? debit;
    const text = line.items
      .filter((i) => i !== debit && i !== credit)
      .map((i) => i.str)
      .join(" ")
      .trim()
      .replace(HISTORY_DATE, "");
    pending = {
      date: isoDate(Number(m[3]), month, Number(m[1])),
      type: credit ? "income" : "expense",
      amount: toAmount(amountItem.str.trim()),
      // drop a second date (value date) and status/currency words at the start
      parts: [clean(text.replace(/^\s*\d{1,2}[ -][A-Za-z]{3}[ -]\d{4}\s*/, "").replace(/\b(Settled|SGD)\b/g, ""))],
    };
  }
  flush();

  if (!rows.length) return null;
  const dates = rows.map((r) => r.date).sort();
  const span = [dates[0], dates[dates.length - 1]].map((d) =>
    monthLabel(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1),
  );
  return {
    kind: "history",
    label: `DBS/POSB transaction history, ${span[0] === span[1] ? span[0] : `${span[0]} – ${span[1]}`}`,
    rows,
    warnings,
  };
}
