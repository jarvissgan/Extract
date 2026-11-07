// Reads a statement PDF in the browser. The file never leaves the device: pdf.js runs here,
// and only the transactions the user chooses are sent to the API.
import { itemsToLines } from "../../shared/pdfLines.js";
import { parseStatement } from "../../shared/statementParser.js";

export type StatementRowKind = "spend" | "fee" | "income" | "refund" | "transfer" | "cash";

export interface StatementRow {
  date: string; // YYYY-MM-DD
  name: string;
  amount: number;
  type: "expense" | "income";
  kind: StatementRowKind;
  include: boolean;
  note: string;
  source: string;
  category: string;
  // exact time (ISO) when the file has one; otherwise only the day is known
  at?: string;
  // false when the file set the category itself, so rules don't override it
  categoryGuessed?: boolean;
}

export interface StatementResult {
  kind: "card" | "account" | "history" | null;
  label: string;
  rows: StatementRow[];
  warnings: string[];
}

export class PdfPasswordError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? "That password is wrong." : "This PDF needs a password.");
  }
}

export async function readStatementPdf(file: File, password?: string): Promise<StatementResult> {
  // loaded on demand: pdf.js is large and only needed here
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try {
    // no eval and no font loading: only the text is needed, and the site's security policy forbids eval
    // cMaps and standard fonts: without them, text in some fonts (common in bank-generated
    // PDFs) comes out empty. Served from /pdfjs/ by the pdfjsAssets plugin in vite.config.ts.
    const base = `${import.meta.env.BASE_URL}pdfjs/`;
    doc = await pdfjs.getDocument({
      data,
      password,
      isEvalSupported: false,
      disableFontFace: true,
      cMapUrl: `${base}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${base}standard_fonts/`,
    }).promise;
  } catch (err) {
    if ((err as { name?: string }).name === "PasswordException") {
      throw new PdfPasswordError((err as { code?: number }).code === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
    }
    throw err;
  }

  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(itemsToLines(items.filter((i) => "str" in i)));
  }
  await doc.destroy();

  // e.g. only "Page 1 of 40" on each page: the transactions are images or drawn shapes
  const lineCount = pages.reduce((n, p) => n + p.length, 0);
  if (lineCount <= pages.length * 3) {
    return {
      kind: null,
      label: file.name,
      rows: [],
      warnings: [
        "This PDF has almost no readable text: its transactions are pictures, not text. Download your transaction history as CSV and use Import → CSV file, or use the monthly e-statement PDF.",
      ],
    };
  }
  return parseStatement(pages) as StatementResult;
}
