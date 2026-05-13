import { readFile } from "node:fs/promises";
import type { Parser } from "../types";
import { spawnChild } from "../lib/spawn-utils";

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
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    throw new Error(`Expected PDF but got ${contentType.split(";")[0]}`);
  }
  return buffer;
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

  const meta: PdfMetadata = { totalPages: 0 };

  meta.title = extractPdfField(parsed, "Title");
  meta.author = extractPdfField(parsed, "Author");
  meta.subject = extractPdfField(parsed, "Subject");
  meta.creator = extractPdfField(parsed, "Creator");
  meta.producer = extractPdfField(parsed, "Producer");

  if (typeof parsed.Pages === "number") {
    meta.totalPages = parsed.Pages;
  }

  if (parsed.Encrypted === "yes") {
    meta.encrypted = true;
  }

  if (meta.totalPages > 0) {
    meta.pageSize = `${meta.totalPages} page${meta.totalPages !== 1 ? "s" : ""}`;
  }

  return meta;
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

function formatPdfHeader(meta: PdfMetadata, fileName: string): string[] {
  const title = meta.title || fileName.replace(/[-_]/g, " ");
  const lines: string[] = [`# ${title}`, ""];

  const fields: string[] = [];
  if (meta.author) fields.push(`**Author:** ${meta.author}`);
  if (meta.subject) fields.push(`**Subject:** ${meta.subject}`);
  if (meta.creator) fields.push(`**Creator:** ${meta.creator}`);
  if (meta.producer) fields.push(`**Producer:** ${meta.producer}`);
  if (meta.pageSize) fields.push(`**Pages:** ${meta.pageSize}`);

  if (fields.length > 0) {
    lines.push(fields.join(" • "));
  }

  return lines;
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
    throw new Error(
      `pdfinfo failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (meta.encrypted) {
    throw new Error("PDF is encrypted and requires a password");
  }

  let text: string;
  try {
    text = await extractTextFromPdf(data, meta.totalPages, signal);
  } catch (err) {
    throw new Error(
      `pdftotext failed: ${err instanceof Error ? err.message : String(err)}`,
    );
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
