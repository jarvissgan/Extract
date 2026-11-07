// Generates fake DBS-style statement PDFs for tests (layout copied from real statements,
// all names and numbers made up). Rerun after changing: node tests/fixtures/make-statement-fixtures.mjs
import { chromium } from "@playwright/test";

const css = `body{font-family:Arial,sans-serif;font-size:10px;margin:28px}
table{width:100%;border-collapse:collapse} td,th{padding:2px 6px;vertical-align:top;white-space:nowrap}
.r{text-align:right} .page{page-break-after:always}`;
const row = (cells, cls = "") => `<tr>${cells.map((c, i) => `<td class="${i === cells.length - 1 || cls.includes(`c${i}`) ? "r" : ""}">${c}</td>`).join("")}</tr>`;

// ---------- credit card ----------
const cardTxn = (d, desc, amt) => `<tr><td>${d}</td><td>${desc}</td><td class="r">${amt}</td></tr>`;
const card = `<html><head><style>${css}</style></head><body>
<div class="page">
<div>Credit Cards</div><div>Statement of Account</div><div>1 of 4</div>
<div>MR JOHN DOE</div><div>BLK 12 NEW UPPER CHANGI ROAD</div><div>#01-1234</div><div>SINGAPORE 460012</div>
<div>DBS Cards P.O. Box 360 S(912312)</div>
<table><tr><th align=left>STATEMENT DATE</th><th align=left>CREDIT LIMIT</th><th align=left>MINIMUM PAYMENT</th><th align=left>PAYMENT DUE DATE</th></tr>
<tr><td>15 Oct 2026</td><td>$12,000.00</td><td>$50.00</td><td>09 Nov 2026</td></tr></table>
<table style="margin-top:8px"><tr><th align=left>DATE</th><th align=left>DESCRIPTION</th><th class="r">AMOUNT (S$)</th></tr>
<tr><td></td><td>DBS LIVE FRESH DBS VISA PAYWAVE PLATINUM CARD NO.: 4119 1100 2233 4455</td><td></td></tr>
<tr><td></td><td>PREVIOUS BALANCE</td><td class="r">1,523.40</td></tr>
${cardTxn("02 OCT", "BILL PAYMENT - DBS INTERNET/WIRELESS", "500.00 CR")}
<tr><td></td><td>REF NO: 12345678901234567890</td><td></td></tr>
${cardTxn("08 OCT", "BILL PAYMENT - DBS INTERNET/WIRELESS", "1,023.40 CR")}
<tr><td></td><td>REF NO: 12345678901234567891</td><td></td></tr>
<tr><td></td><td>NEW TRANSACTIONS JOHN DOE</td><td></td></tr>
${cardTxn("16 SEP", "GRAB* A-8XYZ123 SINGAPORE SG", "18.60")}
${cardTxn("18 SEP", "NTUC FAIRPRICE TAMPINES SINGAPORE SG", "86.35")}
${cardTxn("20 SEP", "NETFLIX.COM LOS GATOS US", "24.71")}
<tr><td></td><td>U.S. DOLLAR 17.99</td><td></td></tr>
${cardTxn("25 SEP", "SHOPEE SINGAPORE MP SINGAPORE SG", "42.10 CR")}
${cardTxn("25 SEP", "CCY CONVERSION FEE", "0.80")}
${cardTxn("01 OCT", "IPP INSTALMENT 3/12 COURTS", "133.25")}
</table>
<div>DBS_CARDS_STM_ABCDE_01x123456789012x_00001</div>
</div>
<div class="page">
<div>Credit Cards</div><div>Statement of Account</div><div>2 of 4</div>
<table>
${cardTxn("03 OCT", "STARBUCKS (SGP) SG", "7.20")}
${cardTxn("10 OCT", "BUS/MRT 123456789", "2.17")}
${cardTxn("12 OCT", "SP DIGITAL PTE. LTD.", "98.40")}
<tr><td></td><td>SUB-TOTAL:</td><td class="r">370.68</td></tr>
${cardTxn("28 SEP", "DBS CASHBACK - VISA LIVE", "5.00 CR")}
<tr><td></td><td>TOTAL:</td><td class="r">365.68</td></tr>
<tr><td></td><td>GRAND TOTAL FOR ALL CARD ACCOUNTS:</td><td class="r">365.68</td></tr>
</table>
<table><tr><td>DBS LIVE FRESH DBS VISA</td><td>$ 365.68</td><td>$ 50.00</td><td>4119 1100 2233 4455</td></tr></table>
</div></body></html>`;

// ---------- deposit account ----------
const head = `<tr><th align=left>Date</th><th align=left>Description</th><th class="r">Withdrawal (-)</th><th class="r">Deposit (+)</th><th class="r">Balance</th></tr>`;
const tx = (d, desc, w, dep, bal) => `<tr><td>${d}</td><td>${desc}</td><td class="r">${w}</td><td class="r">${dep}</td><td class="r">${bal}</td></tr>`;
const det = (...lines) => lines.map((l) => `<tr><td></td><td>${l}</td><td></td><td></td><td></td></tr>`).join("");
const footer = (n) => `<div>SG12345678901 (10/2026) DBS Co. Reg. No. 196800306E GST Reg No: MR-8500180-3</div>
<div>Transaction Details as of 31 Oct 2026 &nbsp;&nbsp;&nbsp; Page ${n} of 4</div><div>DBS_CNSLD_STM_ABCD_01x1234567890123_00001</div>`;
const acct = `<html><head><style>${css}</style></head><body>
<div class="page">
<div>A/C: XX12345678901234</div><div>Consolidated Statement</div>
<div>MR JOHN DOE</div><div>BLK 12 NEW UPPER CHANGI ROAD</div><div>#01-1234</div><div>SINGAPORE 460012</div>
<div>Account Summary as at 31 Oct 2026</div><div>Deposits</div>
<table><tr><th align=left>Account</th><th align=left>Account No.</th><th class="r">Balance</th><th class="r">Balance</th></tr>
<tr><td>DBS Multiplier Account</td><td>027-123456-7</td><td class="r">SGD 4,865.61</td><td class="r">4,865.61</td></tr>
<tr><td>My Account (Savings eSaver)</td><td>120-654321-0</td><td class="r">SGD 9.99</td><td class="r">9.99</td></tr></table>
${footer(1)}
</div>
<div class="page">
<div>Transaction Details as at 31 Oct 2026</div><div>Deposits</div>
<table><tr><td>DBS Multiplier Account</td><td class="r">Account No. 027-123456-7</td></tr></table>
<table>${head}
<tr><td></td><td>CURRENCY: SINGAPORE DOLLAR</td><td></td><td></td><td></td></tr>
<tr><td></td><td>Balance Brought Forward</td><td></td><td></td><td class="r">SGD 500.00</td></tr>
${tx("01/10/2026", "Advice FAST Payment / Receipt", "", "50.00", "550.00")}
${det("INCOMING PAYNOW REF 1234567", "FROM: JOHN TAN (JOHN TAN)", "PAYNOW TRANSFER", "OTHR")}
${tx("02/10/2026", "ATM Transaction", "100.00", "", "450.00")}
${det("S1AB2345,TAMPINES MRT")}
${tx("03/10/2026", "Debit Card Transaction", "", "2.50", "452.50")}
${det("DBS VISA DEBIT CASHBACK JULY 03OCT", "4628-4500-1234-5678")}
${tx("04/10/2026", "Advice Funds Transfer", "20.00", "", "432.50")}
${det("TOP-UP TO PAYLAH! :", "91234567")}
${tx("05/10/2026", "Debit Card Transaction", "12.30", "", "420.20")}
${det("BUS/MRT 123456789   SI SGP 05OCT", "4628-4500-1234-5678")}
${tx("06/10/2026", "Advice Bill Payment", "300.00", "", "120.20")}
${det("DBSC-4119110022334455 : I-BANK", "REF: 12345678901234567890")}
<tr><td></td><td>Balance Carried Forward</td><td></td><td></td><td class="r">SGD 120.20</td></tr>
</table>
${footer(2)}
</div>
<div class="page">
<table><tr><td>DBS Multiplier Account</td><td class="r">Account No. 027-123456-7</td></tr></table>
<table>${head}
<tr><td></td><td>Balance Brought Forward</td><td></td><td></td><td class="r">SGD 120.20</td></tr>
${tx("25/10/2026", "GIRO Salary", "", "4,850.00", "4,970.20")}
${det("ACME PTE LTD", "12345678", "SAL2610ABC")}
${tx("26/10/2026", "Advice FAST Payment / Receipt", "45.00", "", "4,925.20")}
${det("PAYNOW TRANSFER 7654321", "TO: MARY LIM", "PAYNOW TRANSFER", "OTHR")}
${tx("27/10/2026", "Advice Bill Payment", "60.00", "", "4,865.20")}
${det("SP-87654321 : I-BANK", "REF: 98765432109876543210")}
${tx("31/10/2026", "Interest Earned", "", "0.41", "4,865.61")}
${det("INTERESTRATE BASED ON TOTAL", "QUALIFYING TRANSACTIONS")}
<tr><td></td><td>Balance Carried Forward</td><td></td><td></td><td class="r">SGD 4,865.61</td></tr>
<tr><td>Total Balance Carried Forward in SGD:</td><td></td><td class="r">537.30</td><td class="r">4,902.91</td><td class="r">4,865.61</td></tr>
</table>
<table><tr><td>My Account (Savings eSaver)</td><td class="r">Account No. 120-654321-0</td></tr></table>
<table>${head}
<tr><td></td><td>CURRENCY: SINGAPORE DOLLAR</td><td></td><td></td><td></td></tr>
<tr><td></td><td>Balance Brought Forward</td><td></td><td></td><td class="r">SGD 9.99</td></tr>
${tx("31/10/2026", "", "", "", "9.99")}
<tr><td>Total Balance Carried Forward in SGD:</td><td></td><td class="r">0.00</td><td class="r">0.00</td><td class="r">9.99</td></tr>
</table>
${footer(3)}
</div></body></html>`;

// ---------- transaction history (digibank page saved as PDF) ----------
const hrow = (date, desc, debit, credit) =>
  `<tr><td>${date}</td><td>${desc}</td><td>Settled</td><td>SGD</td><td class="r">${debit}</td><td class="r">${credit}</td></tr>`;
const history = `<html><head><style>${css}</style></head><body>
<div>Account Details For: DBS Multiplier Account 120-456789-0</div>
<div>Statement as at: 07 Nov 2026</div>
<table style="margin-top:8px"><tr><th align=left>Transaction Date</th><th align=left>Description</th><th align=left>Status</th><th align=left>Currency</th><th class="r">Debit Amount</th><th class="r">Credit Amount</th></tr>
${hrow("06 Nov 2026", "UMC TOAST BOX SI SGP 05NOV<br>Point-of-Sale Transaction", "6.80", "")}
${hrow("05 Nov 2026", "TOP-UP TO PAYLAH! : 91234567", "20.00", "")}
${hrow("05 Nov 2026", "ICT PayNow Transfer 1234567<br>To: MARY LIM", "45.00", "")}
${hrow("04 Nov 2026", "ICT Incoming PayNow Ref 7654321<br>From: JOHN TAN", "", "50.00")}
${hrow("03 Nov 2026", "BILL DBSC-4119110022334455 : I-BANK", "1,023.40", "")}
${hrow("01 Nov 2026", "Interest Earned", "", "0.41")}
</table>
<div style="margin-top:20px">Page 1 of 1</div>
</body></html>`;

const all = [["dbs-card", card], ["dbs-account", acct], ["dbs-history", history]];
// node make-statement-fixtures.mjs dbs-history  -> only that one
const only = process.argv.slice(2);
const launch = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);
for (const [name, html] of all.filter(([n]) => !only.length || only.includes(n))) {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.pdf({ path: new URL(`./${name}.pdf`, import.meta.url).pathname, format: "A4" });
  await page.close();
}
await browser.close();
console.log("wrote the statement fixtures in tests/fixtures");
