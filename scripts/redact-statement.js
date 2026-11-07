// Makes a privacy-safe text copy of a bank or card statement, or a transaction history
// export, so its LAYOUT can be shared (e.g. to build an importer) without personal details.
// Reads PDFs (monthly statements, or transaction history saved as PDF) and text exports
// (.csv, .tsv, .txt, e.g. digibank's transaction history download).
//
//   npm run statement:redact -- "C:\path\to\statement.pdf"
//   npm run statement:redact -- statement.pdf --password      (asks for the PDF password)
//   npm run statement:redact -- "C:\path\to\history.csv"
//
// Runs entirely on your computer; nothing is uploaded. Writes <name>.redacted.txt next to
// the file. Read it before sharing it.
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
  HISTORY LEDGER AS OF STATUS PENDING SETTLED POSTED AUTHORISED AUTHORIZED TYPE CODE CLIENT
  TIME MERCHANT CATEGORY ENTRY TOPUP QR SGQR NETSQR APPLE GOOGLE SAMSUNG PAY WALLET DIGIBANK
  IBANKING BAL REF1 REF2 REF3 MST UMC ICT ITR SAL INT AWL BILL OTHR SALA DIRECT DEBITS
  WITHDRAWN DEPOSITED RECEIVED SENT INFORMATION PURPOSE YES NO NIL NA FROM TO
  `
    .split(/\s+/)
    .filter(Boolean),
);

const maskWord = (word) => (KEEP.has(word.toUpperCase()) ? word : word.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x"));

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
    // column names like "Transaction Ref1" keep their single digit
    .replace(/\d/g, (d, at, line) =>
      /ref$/i.test(line.slice(Math.max(0, at - 3), at)) && !/\d/.test(line[at + 1] ?? "") ? d : "9",
    );

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error('Usage: npm run statement:redact -- "path\\to\\statement.pdf" [--password]  (or a .csv/.txt export)');
    process.exit(1);
  }

  const target = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.redacted.txt`);

  // text exports (CSV and similar): redact line by line, keeping commas, quotes and tabs
  if (/\.(csv|tsv|txt)$/i.test(file)) {
    const text = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/);
    if (!lines.some((l) => l.trim())) {
      console.error("That file is empty.");
      process.exit(1);
    }
    await writeFile(target, lines.map(redactLine).join("\n"), "utf8");
    console.log(`Redacted ${lines.length} lines.`);
    console.log(`Saved: ${target}`);
    console.log("Open it and check nothing personal is readable before sharing it.");
    return;
  }
  if (!/\.pdf$/i.test(file)) {
    console.error("Give a .pdf, .csv, .tsv or .txt file. For an Excel file (.xls/.xlsx), save it as CSV first.");
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
          : "This PDF has a password. Run again with --password at the end.",
      );
      process.exit(1);
    }
    throw err;
  }

  const { OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const IMAGE_OPS = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
  const out = [];
  const stats = [];
  let textLines = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const lines = itemsToLines(items).map((l) => l.text);
    textLines += lines.length;
    out.push(`===== page ${n} =====`, ...lines.map(redactLine), "");

    // what the page is made of, to explain PDFs with little readable text
    const { fnArray } = await page.getOperatorList();
    stats.push({
      lines: lines.length,
      unreadable: items.filter((i) => i.str === "" && i.width > 0).length,
      images: fnArray.filter((op) => IMAGE_OPS.has(op)).length,
      shapes: fnArray.filter((op) => op === OPS.constructPath).length,
      glyphs: fnArray.filter((op) => op === OPS.showText || op === OPS.showSpacedText).length,
    });
  }

  const sum = (k) => stats.reduce((t, p) => t + p[k], 0);
  const report = [
    "===== what the pages contain (counts only, nothing personal) =====",
    ...stats.map(
      (p, i) =>
        `page ${i + 1}: ${p.lines} text lines, ${p.glyphs} text drawing commands, ${p.unreadable} unreadable text pieces, ${p.images} images, ${p.shapes} drawn shapes`
    ),
    "",
  ];
  const fewLines = textLines <= doc.numPages * 3;
  let verdict = null;
  if (fewLines && sum("images") >= doc.numPages) {
    verdict =
      "The transactions are pictures (images) inside the PDF, not text, so they can't be read. This happens when a page is screenshotted or printed as images. Download the transaction history as CSV instead, or use the monthly e-statement PDF.";
  } else if (fewLines && sum("unreadable") > 0) {
    verdict =
      "The text uses fonts with no readable characters (the PDF only knows the shapes of the letters), so it can't be read. Download the transaction history as CSV instead, or use the monthly e-statement PDF.";
  } else if (fewLines && sum("shapes") > doc.numPages * 50) {
    verdict =
      "The text is drawn as outlines (shapes), not letters, so it can't be read. Download the transaction history as CSV instead, or use the monthly e-statement PDF.";
  } else if (textLines === 0) {
    verdict = "No text found: this PDF is probably a scanned image, which can't be read this way.";
  }
  if (verdict) report.push(`Verdict: ${verdict}`, "");
  out.unshift(...report);

  await writeFile(target, out.join("\n"), "utf8");
  if (verdict) console.log(`\n${verdict}\n`);
  console.log(`Redacted ${doc.numPages} page(s), ${textLines} lines.`);
  console.log(`Saved: ${target}`);
  console.log("Open it and check nothing personal is readable before sharing it.");
}

// run only when called directly (the module is also imported by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error("Couldn't read that file:", err.message);
    process.exit(1);
  });
}
