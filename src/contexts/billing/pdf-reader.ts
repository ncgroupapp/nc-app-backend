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

/** Rebuilds the lines of a page: items on the same baseline, left to right, lines top to bottom */
function pageToText(items: TextItem[]): string {
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
      const sorted = line.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let text = "";
      let lastEnd: number | null = null;
      for (const item of sorted) {
        const x = item.transform[4];
        // Separate cells that are apart; glue pieces of the same word
        if (lastEnd !== null) text += x - lastEnd > 1 ? " " : "";
        text += item.str;
        lastEnd = x + item.width;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .join("\n");
}

export async function readPdfText(data: Buffer): Promise<string> {
  try {
    const document = await loadPdfJs().getDocument({
      data: new Uint8Array(data),
      verbosity: 0,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
    }).promise;
    const pages: string[] = [];
    for (let n = 1; n <= document.numPages; n++) {
      const content = await (await document.getPage(n)).getTextContent();
      pages.push(pageToText(content.items.filter(isTextItem)));
    }
    await document.destroy();
    const text = pages.join("\n").trim();
    if (text) return text;
  } catch {
    // fall back to the old reader below
  }
  return legacyPdfToText(data);
}
