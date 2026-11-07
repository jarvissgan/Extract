// Makes a privacy-safe text copy of a bank or card statement PDF, so its LAYOUT can be
// shared (e.g. to build an importer) without sharing personal details.
//
//   npm run statement:redact -- "C:\path\to\statement.pdf"
//   npm run statement:redact -- statement.pdf --password      (asks for the PDF password)
//
// Runs entirely on your computer; nothing is uploaded. Writes <name>.redacted.txt next to
// the PDF. Read it before sharing it.
//
// What's masked: every digit becomes 9 (amounts, dates, card/account numbers, balances), and
// every word becomes X's of the same length unless it's common statement vocabulary
// (months, column headings, "PAYMENT", "REFUND", "SGD", ...). Names, addresses, merchants
// and reference numbers are therefore unreadable, while columns, date formats and markers
// like CR/DR stay visible.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { itemsToLines } from "../shared/pdfLines.js";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Words kept as-is. Deliberately generic: statement structure, never personal or merchant names.
const KEEP = new Set(
  `
  JAN FEB MAR APR MAY JUN JUL AUG SEP SEPT OCT NOV DEC
  JANUARY FEBRUARY MARCH APRIL JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER
  MON TUE WED THU FRI SAT SUN
  CR DR DB CRDT DEBT
  SGD USD EUR GBP JPY MYR AUD HKD CNY THB IDR KRW TWD NZD CAD CHF INR PHP VND
  DATE DATES DESCRIPTION DETAILS DETAIL PARTICULARS TRANSACTION TRANSACTIONS AMOUNT AMOUNTS
  WITHDRAWAL WITHDRAWALS DEPOSIT DEPOSITS DEBIT DEBITS CREDIT CREDITS BALANCE BALANCES
  TOTAL TOTALS SUB SUBTOTAL PREVIOUS NEW OPENING CLOSING BROUGHT CARRIED FORWARD BF CF
  PAYMENT PAYMENTS REFUND REFUNDS INTEREST CHARGE CHARGES FEE FEES ANNUAL LATE FINANCE
  MINIMUM DUE PAYABLE LIMIT AVAILABLE CREDITLIMIT STATEMENT STATEMENTS PAGE OF
  CARD CARDS CARDHOLDER ACCOUNT ACCOUNTS NO NUMBER SUMMARY POINTS REWARDS MILES
  DBS POSB PAYLAH PAYNOW FAST GIRO IBG NETS ATM POS EPS MEPS TT
  TRANSFER TRANSFERS FUND FUNDS SALARY BONUS BILL BILLS INSTALMENT INSTALLMENT INSTALMENTS PLAN
  CASHBACK REBATE REVERSAL ADJUSTMENT FOREIGN CURRENCY EXCHANGE RATE CONVERSION CROSS BORDER
  ONLINE CONTACTLESS VISA MASTERCARD AMEX REF REFERENCE VALUE POSTING POSTED TRANSACTED
  INCOMING OUTGOING ADVICE REMITTANCE TELEGRAPHIC PURCHASE PURCHASES RETAIL CASH ADVANCE
  SAVINGS CURRENT MULTIPLIER AUTOSAVE CONSOLIDATED SUPPLEMENTARY PRINCIPAL CASHLINE
  SINGAPORE SG SGP SIN TO FROM FOR AND THE IN ON AT BY WITH YOUR YOU THIS PERIOD
  CCY IPP POINT SALE RECEIPT RECEIPTS EARNED INTERNET WIRELESS MOBILE BANKING TOP UP
  PTE LTD SERVICE SERVICES CHARGED BILLED UNBILLED OUTSTANDING OVERDUE REPAYMENT
  `
    .split(/\s+/)
    .filter(Boolean)
);

const maskWord = (word) =>
  KEEP.has(word.toUpperCase()) ? word : word.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x");

// Letters in other scripts (accents, CJK...) are masked too.
// Currency labels like S$, US$ and A$ stay readable.
const CURRENCY_LABEL = /^(S|US|A|NZ|HK|C|NT)$/;

export const redactLine = (line) =>
  line
    .replace(/\p{L}+(\$)?/gu, (w, dollar) => {
      const word = dollar ? w.slice(0, -1) : w;
      if (dollar && CURRENCY_LABEL.test(word)) return w;
      const masked = /^[A-Za-z]+$/.test(word) ? maskWord(word) : "X".repeat(word.length);
      return dollar ? `${masked}$` : masked;
    })
    .replace(/\d/g, "9");

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error('Usage: npm run statement:redact -- "path\\to\\statement.pdf" [--password]');
    process.exit(1);
  }

  const { getDocument, PasswordResponses } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(file));

  let password;
  if (args.includes("--password")) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    password = await rl.question("PDF password (only used on this computer): ");
    rl.close();
  }

  let doc;
  try {
    doc = await getDocument({ data, password, disableFontFace: true, verbosity: 0 }).promise;
  } catch (err) {
    if (err?.name === "PasswordException") {
      console.error(
        err.code === PasswordResponses.INCORRECT_PASSWORD
          ? "That password is wrong."
          : "This PDF has a password. Run again with --password at the end."
      );
      process.exit(1);
    }
    throw err;
  }

  const out = [];
  let textLines = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const lines = itemsToLines(items).map((l) => l.text);
    textLines += lines.length;
    out.push(`===== page ${n} =====`, ...lines.map(redactLine), "");
  }

  if (textLines === 0) {
    console.error("No text found: this PDF is probably a scanned image, which can't be read this way.");
    process.exit(1);
  }

  const target = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.redacted.txt`);
  await writeFile(target, out.join("\n"), "utf8");
  console.log(`Redacted ${doc.numPages} page(s), ${textLines} lines.`);
  console.log(`Saved: ${target}`);
  console.log("Open it and check nothing personal is readable before sharing it.");
}

// run only when called directly (the module is also imported by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error("Couldn't read that PDF:", err.message);
    process.exit(1);
  });
}
