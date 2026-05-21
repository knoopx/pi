import { readFile } from "node:fs/promises";
import type { Parser } from "../types";
import { spawnChild } from "../lib/child-spawn";

function parsePdfUrl(url: string): { fileName: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const filePart = pathParts[pathParts.length - 1];
    if (!filePart) return null;
    return { fileName: decodeURIComponent(filePart) };
  } catch {
    return null;
  }
}

async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  validatePdfContentType(res);
  return buffer;
}

function validatePdfContentType(res: Response): void {
  const contentType = res.headers.get("content-type") || "";
  if (isPdfContentType(contentType)) return;
  throw new Error(`Expected PDF but got ${contentType.split(";")[0]}`);
}

function isPdfContentType(contentType: string): boolean {
  return contentType.includes("pdf") || contentType.includes("octet-stream");
}

interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  totalPages: number;
  pageSize?: string;
  encrypted?: boolean;
}

function extractPdfField(
  parsed: Record<string, unknown>,
  key: string,
): string | undefined {
  const val = parsed[key];
  if (typeof val === "string") return val;
  return undefined;
}

async function getMetadataFromPdf(data: Buffer): Promise<PdfMetadata> {
  const raw = await spawnChild("pdfinfo", ["-", "-json"], { data });
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return buildPdfMetadata(parsed);
}

function buildPdfMetadata(parsed: Record<string, unknown>): PdfMetadata {
  const meta: PdfMetadata = {
    totalPages: typeof parsed.Pages === "number" ? parsed.Pages : 0,
    title: extractPdfField(parsed, "Title"),
    author: extractPdfField(parsed, "Author"),
    subject: extractPdfField(parsed, "Subject"),
    creator: extractPdfField(parsed, "Creator"),
    producer: extractPdfField(parsed, "Producer"),
    encrypted: parsed.Encrypted === "yes",
  };
  meta.pageSize = formatPageSize(meta.totalPages);
  return meta;
}

function formatPageSize(totalPages: number): string | undefined {
  if (totalPages <= 0) return undefined;
  return `${totalPages} page${totalPages !== 1 ? "s" : ""}`;
}

async function extractTextFromPdf(
  data: Buffer,
  totalPages: number,
  signal?: AbortSignal,
): Promise<string> {
  const args = ["-layout", "-nopgbrk", "-", "-"];

  return spawnChild("pdftotext", args, { data, signal });
}

async function downloadAndProcess(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const pdfData = await downloadPdf(url);
  const nameInfo = parsePdfUrl(url) || { fileName: "document" };

  return processPdfData(pdfData, nameInfo.fileName, signal);
}

async function processPdfFile(
  pdfPath: string,
  source: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await readFile(pdfPath);
  const fileName = source.split("/").pop()?.split(".")[0] || "document";
  return processPdfData(data, fileName, signal);
}

function collectPdfFields(meta: PdfMetadata): string[] {
  const fields: string[] = [];
  if (meta.author) fields.push(`**Author:** ${meta.author}`);
  if (meta.subject) fields.push(`**Subject:** ${meta.subject}`);
  appendPdfField(fields, "Creator", meta.creator);
  appendPdfField(fields, "Producer", meta.producer);
  appendPdfField(fields, "Pages", String(meta.pageSize ?? ""));
  return fields;
}

function appendPdfField(
  fields: string[],
  label: string,
  value: string | number | undefined,
): void {
  if (value) fields.push(`**${label}:** ${value}`);
}

function formatPdfHeader(meta: PdfMetadata, fileName: string): string[] {
  const title = meta.title || fileName.replace(/[-_]/g, " ");
  const lines: string[] = [`# ${title}`, ""];
  const fields = collectPdfFields(meta);
  if (fields.length > 0) lines.push(fields.join(" • "));
  return lines;
}

function wrapPdfError(action: string, err: unknown): never {
  throw new Error(
    `${action} failed: ${err instanceof Error ? err.message : String(err)}`,
  );
}

async function processPdfData(
  data: Buffer,
  fileName: string,
  signal?: AbortSignal,
): Promise<string> {
  let meta: PdfMetadata;
  try {
    meta = await getMetadataFromPdf(data);
  } catch (err) {
    wrapPdfError("pdfinfo", err);
  }

  if (meta.encrypted) {
    throw new Error("PDF is encrypted and requires a password");
  }

  let text: string;
  try {
    text = await extractTextFromPdf(data, meta.totalPages, signal);
  } catch (err) {
    wrapPdfError("pdftotext", err);
  }

  const lines: string[] = [...formatPdfHeader(meta, fileName)];
  lines.push("", "---", "", text.trim());

  return lines.join("\n");
}

export const pdfParser: Parser = {
  matches(url: string): boolean {
    try {
      new URL(url);
      return url.toLowerCase().endsWith(".pdf");
    } catch {
      return (
        url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf")
      );
    }
  },

  async convert(source: string, signal?: AbortSignal): Promise<string> {
    try {
      new URL(source);
      return await downloadAndProcess(source, signal);
    } catch {
      const exists = await readFile(source)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        throw new Error(`File not found: ${source}`);
      }
      return processPdfFile(source, source, signal);
    }
  },
};
