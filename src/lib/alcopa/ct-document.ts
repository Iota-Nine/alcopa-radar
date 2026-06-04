import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker, type Worker } from "tesseract.js";
import { FETCH_HEADERS } from "@/lib/alcopa/fetch-headers";

const CT_FETCH_TIMEOUT_MS = 28_000;
const OCR_MAX_PDF_PAGES = 3;
const BASE_URL = "https://www.alcopa-auction.fr";

export type CtDocumentKind = "pdf" | "png" | "jpeg" | "webp" | "unknown";

const require = createRequire(import.meta.url);

let pdfjsModule: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;
let ocrWorkerPromise: Promise<Worker> | null = null;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function detectDocumentKind(buffer: Buffer, contentType?: string | null): CtDocumentKind {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") return "pdf";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF") return "webp";

  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpeg";
  if (ct.includes("webp")) return "webp";
  return "unknown";
}

function normalizeCtText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hasCtKeywords(text: string): boolean {
  return /défaillance|contrôle\s*technique|défavorable|favorable|majeure|critique|mineure|contre[- ]?visite|pneumatique|frein/i.test(
    text
  );
}

function isTextSufficient(text: string): boolean {
  const normalized = normalizeCtText(text);
  return normalized.length >= 60 && hasCtKeywords(normalized);
}

async function fetchCtBuffer(
  ctUrl: string,
  referer?: string
): Promise<{ buffer: Buffer; contentType?: string | null } | undefined> {
  try {
    const res = await fetch(ctUrl, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/pdf,image/png,image/jpeg,image/webp,image/*,*/*;q=0.8",
        Referer: referer ?? `${BASE_URL}/recherche`,
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 32) return undefined;
    return { buffer, contentType: res.headers.get("content-type") };
  } catch {
    return undefined;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string | undefined> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = normalizeCtText(result.text ?? "");
    return text.length > 20 ? text : undefined;
  } catch {
    return undefined;
  }
}

async function getPdfJs() {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjsModule.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }
  return pdfjsModule;
}

async function getOcrWorker(): Promise<Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("fra");
  }
  return ocrWorkerPromise;
}

async function ocrImageBuffer(imageBuffer: Buffer): Promise<string | undefined> {
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(imageBuffer);
    const text = normalizeCtText(data.text ?? "");
    return text.length > 20 ? text : undefined;
  } catch {
    return undefined;
  }
}

async function ocrPdfBuffer(buffer: Buffer): Promise<string | undefined> {
  try {
    const pdfjs = await getPdfJs();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
      .promise;
    const worker = await getOcrWorker();
    const pageCount = Math.min(pdf.numPages, OCR_MAX_PDF_PAGES);
    const chunks: string[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;

      const { data } = await worker.recognize(canvas.toBuffer("image/png"));
      const text = normalizeCtText(data.text ?? "");
      if (text.length > 20) chunks.push(text);
    }

    const merged = normalizeCtText(chunks.join(" "));
    return merged.length > 20 ? merged : undefined;
  } catch {
    return undefined;
  }
}

async function extractTextFromBuffer(
  buffer: Buffer,
  kind: CtDocumentKind
): Promise<string | undefined> {
  if (kind === "png" || kind === "jpeg" || kind === "webp") {
    return ocrImageBuffer(buffer);
  }

  if (kind === "pdf" || kind === "unknown") {
    const pdfText = await extractPdfText(buffer);
    if (pdfText && isTextSufficient(pdfText)) return pdfText;

    const ocrText = await ocrPdfBuffer(buffer);
    if (ocrText && hasCtKeywords(ocrText)) return ocrText;
    return pdfText ?? ocrText;
  }

  return undefined;
}

/** Télécharge le document CT Alcopa (PDF ou image) et en extrait le texte. */
export async function fetchCtTextFromUrl(
  ctUrl: string,
  referer?: string
): Promise<string | undefined> {
  return withTimeout(fetchCtTextFromUrlInner(ctUrl, referer), CT_FETCH_TIMEOUT_MS);
}

async function fetchCtTextFromUrlInner(
  ctUrl: string,
  referer?: string
): Promise<string | undefined> {
  const fetched = await fetchCtBuffer(ctUrl, referer);
  if (!fetched) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ url: ctUrl });
      const result = await parser.getText();
      const text = normalizeCtText(result.text ?? "");
      if (isTextSufficient(text)) return text;
    } catch {
      /* fallback fetch ci-dessous */
    }
    return undefined;
  }

  const kind = detectDocumentKind(fetched.buffer, fetched.contentType);
  return extractTextFromBuffer(fetched.buffer, kind);
}

/** Résumé stocké dans ctNotes — lignes exploitables par l’analyse CT. */
export function buildCtNotesFromDocumentText(rawText: string): string {
  const pdfText = rawText.replace(/\s+/g, " ");
  const parts: string[] = [];
  const lower = pdfText.toLowerCase();

  if (
    /défavorable pour défaillances critiques|ne pouvant pas circuler|circulation interdite/.test(
      lower
    )
  ) {
    parts.push("Résultat CT : défavorable pour défaillances critiques");
  } else if (/défavorable pour défaillances majeures/.test(lower)) {
    parts.push("Résultat CT : défavorable pour défaillances majeures");
  } else if (/favorable\s*(?:avec|sans)|résultat du contrôle[\s\S]{0,40}favorable/i.test(pdfText)) {
    parts.push("Résultat CT : favorable");
  }

  const defectCode = /\d+(?:\.\d+)+|\d+-\d+(?:\.\d+)+(?:-[a-z]\.\d+)?/i;

  const majorBlock = pdfText.match(
    /défaillance\(s\)\s*majeure\(s\)([\s\S]*?)(?=défaillance\(s\)\s*mineure\(s\)|défaillance\(s\)\s*critique\(s\)|groupe\(s\)\s*de\s*points|nature du prochain|$)/i
  );
  if (majorBlock?.[1]) {
    for (const chunk of majorBlock[1].split(/(?=[\da-z]\)?\s*\d+(?:\.\d+|-\d+))/i)) {
      const line = chunk.trim().replace(/\s+/g, " ");
      if (line.length < 10 || !defectCode.test(line)) continue;
      parts.push(`Défaillance majeure : ${line.slice(0, 220)}`);
    }
  }

  const criticalBlock = pdfText.match(
    /défaillance\(s\)\s*critique\(s\)([\s\S]*?)(?=défaillance\(s\)\s*majeure\(s\)|défaillance\(s\)\s*mineure\(s\)|$)/i
  );
  if (criticalBlock?.[1]) {
    for (const chunk of criticalBlock[1].split(/(?=[\da-z]\)?\s*\d+(?:\.\d+|-\d+))/i)) {
      const line = chunk.trim().replace(/\s+/g, " ");
      if (line.length < 10 || !defectCode.test(line)) continue;
      parts.push(`Défaillance critique : ${line.slice(0, 220)}`);
    }
  }

  if (parts.length <= 1 && /défaillance\(s\)\s*majeure\(s\)/i.test(pdfText)) {
    const inlineMajor = pdfText.match(
      /défaillance\(s\)\s*majeure\(s\)\s*([\s\S]{20,400}?)(?=défaillance\(s\)\s*mineure|groupe\(s\)|nature du prochain|$)/i
    );
    if (inlineMajor?.[1]) {
      const line = inlineMajor[1].trim().replace(/\s+/g, " ");
      if (line.length > 12) parts.push(`Défaillance majeure : ${line.slice(0, 220)}`);
    }
  }

  if (parts.length === 0 && /défaillance|défavorable|contre[- ]?visite|pneumatique|frein|fuite|corrosion/i.test(lower)) {
    return pdfText.slice(0, 1400);
  }

  return parts.join(" | ");
}

export function mergeCtNotes(
  htmlNotes?: string,
  documentNotes?: string
): string | undefined {
  const chunks = [documentNotes, htmlNotes]
    .filter(Boolean)
    .flatMap((part) => part!.split(/\s*\|\s*/))
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length === 0) return undefined;
  return [...new Set(chunks)].join(" | ");
}

/** Alias historique */
export const buildCtNotesFromPdfText = buildCtNotesFromDocumentText;
