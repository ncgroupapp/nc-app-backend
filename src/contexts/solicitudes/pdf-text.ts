// pdf-parse's index runs a self-test when required directly; the lib entry point does not
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (data: Buffer) => Promise<{ text: string }>;

/** Plain text of a PDF, or "" when it cannot be read (scanned image, encrypted, broken). */
export async function pdfToText(data: Buffer): Promise<string> {
  try {
    const result = await pdfParse(data);
    return result.text ?? "";
  } catch {
    return "";
  }
}
