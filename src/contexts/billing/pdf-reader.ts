/* eslint-disable @typescript-eslint/no-require-imports */
import { pdfToText as legacyPdfToText } from "../solicitudes/pdf-text";

/**
 * Text of a PDF using the current pdf.js. The pdf-parse 1.1.1 bundled pdf.js (2018) fails at random
 * with "bad XRef entry" on many PDFs, so billing documents came in without number, date or total.
 */

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

type PdfJs = {
  getDocument: (options: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<TextItem | object> }> }>;
      destroy: () => Promise<void>;
    }>;
  };
};

let pdfjs: PdfJs | null = null;

function loadPdfJs(): PdfJs {
  if (!pdfjs) {
    // Loading the worker up front makes pdf.js run it in this thread, and the static require
    // lets the Vercel bundler include it (pdf.js would otherwise require it by a computed path)
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = require("pdfjs-dist/legacy/build/pdf.worker.js");
    pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as PdfJs;
  }
  return pdfjs;
}

const isTextItem = (item: object): item is TextItem => "str" in item && "transform" in item;

/** A piece of text with its position: x grows to the right, y grows upwards (PDF units) */
export interface PdfCell {
  text: string;
  page: number;
  x: number;
  right: number;
  y: number;
}

export interface PdfContent {
  /** Lines top to bottom, cells of a line left to right */
  text: string;
  /** Cells of every page, used to read "label above / value below" layouts like the DGI invoice header */
  cells: PdfCell[];
}

/** Groups the items of a page into lines and joins the items that touch into cells */
function pageToCells(items: TextItem[], page: number): PdfCell[][] {
  const lines: { y: number; items: TextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const line = lines.find((l) => Math.abs(l.y - y) < 3);
    if (line) line.items.push(item);
    else lines.push({ y, items: [item] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const cells: PdfCell[] = [];
      for (const item of line.items.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = item.transform[4];
        const last = cells[cells.length - 1];
        // Pieces of the same word or phrase are a few units apart; table columns are further
        if (last && x - last.right < 4) {
          last.text += (x - last.right > 1 ? " " : "") + item.str;
          last.right = Math.max(last.right, x + item.width);
        } else {
          cells.push({ text: item.str, page, x, right: x + item.width, y: line.y });
        }
      }
      return cells
        .map((cell) => ({ ...cell, text: cell.text.replace(/\s+/g, " ").trim() }))
        .filter((cell) => cell.text);
    })
    .filter((cells) => cells.length > 0);
}

export async function readPdf(data: Buffer): Promise<PdfContent> {
  try {
    const document = await loadPdfJs().getDocument({
      data: new Uint8Array(data),
      verbosity: 0,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
    }).promise;
    const lines: PdfCell[][] = [];
    for (let n = 1; n <= document.numPages; n++) {
      const content = await (await document.getPage(n)).getTextContent();
      lines.push(...pageToCells(content.items.filter(isTextItem), n));
    }
    await document.destroy();
    const text = lines.map((cells) => cells.map((cell) => cell.text).join(" ")).join("\n").trim();
    if (text) return { text, cells: lines.flat() };
  } catch {
    // fall back to the old reader below
  }
  return { text: await legacyPdfToText(data), cells: [] };
}

export async function readPdfText(data: Buffer): Promise<string> {
  return (await readPdf(data)).text;
}
