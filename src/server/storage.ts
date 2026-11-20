import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private file storage adapter.
 *
 * Files are written outside the public web root and are only ever served through
 * /api/files/[id], which checks the signed-in user's access first.
 *
 * Adapters (PRIVATE_STORAGE_DRIVER):
 * - "database": bytes live in the StoredObject table. Default on Vercel and other
 *   serverless hosts, whose filesystem is read-only and not shared between instances.
 * - "local": a persistent disk directory (PRIVATE_UPLOAD_DIR). Default elsewhere,
 *   e.g. Docker with a mounted volume.
 * An S3-compatible adapter can implement the same interface later. No malware
 * scanning is performed yet: uploads are type- and signature-checked only.
 */
export interface PrivateStorageAdapter {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const MB = 1024 * 1024;

export const allowedUploadTypes: Record<string, { extensions: string[]; signature?: (head: Buffer) => boolean }> = {
  "application/pdf": { extensions: [".pdf"], signature: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  "image/png": { extensions: [".png"], signature: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { extensions: [".jpg", ".jpeg"], signature: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { extensions: [".webp"], signature: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  "image/gif": { extensions: [".gif"], signature: (b) => b.subarray(0, 4).toString("latin1") === "GIF8" },
  "video/mp4": { extensions: [".mp4", ".m4v"], signature: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
  "video/quicktime": { extensions: [".mov"], signature: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" || b.subarray(4, 8).toString("latin1") === "moov" },
  "text/plain": { extensions: [".txt", ".md"] },
  "text/csv": { extensions: [".csv"] },
  // Office Open XML documents are ZIP containers.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extensions: [".docx"], signature: isZip },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { extensions: [".xlsx"], signature: isZip },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extensions: [".pptx"], signature: isZip },
};

function isZip(b: Buffer) { return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; }

/** Vercel rejects function request bodies above 4.5 MB, so larger uploads can never arrive there. */
const serverless = Boolean(process.env.VERCEL);

export function maxUploadBytes() {
  const fallback = serverless ? 4 : 15;
  const configured = Number(process.env.UPLOAD_MAX_MB ?? fallback);
  const megabytes = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 100) : fallback;
  return (serverless ? Math.min(megabytes, 4) : megabytes) * MB;
}

export type UploadCheck = { ok: true; contentType: string; safeName: string } | { ok: false; error: string };

/** Validates declared type, extension, size, and leading file signature. Pure, so it is unit-tested. */
export function validateUpload(input: { name: string; type: string; size: number; head: Buffer }, limit = maxUploadBytes()): UploadCheck {
  if (!input.size) return { ok: false, error: "The selected file is empty." };
  if (input.size > limit) return { ok: false, error: `Files must be ${Math.round(limit / MB)} MB or smaller.` };
  const rule = allowedUploadTypes[input.type];
  if (!rule) return { ok: false, error: "This file type is not accepted. Use PDF, image, MP4/MOV video, text, CSV, or Office documents." };
  const extension = path.extname(input.name).toLowerCase();
  if (!rule.extensions.includes(extension)) return { ok: false, error: "The file extension does not match its type." };
  if (rule.signature && !rule.signature(input.head)) return { ok: false, error: "The file contents do not match its declared type." };
  if (!rule.signature && input.head.includes(0)) return { ok: false, error: "Text uploads must not contain binary data." };
  const base = path.basename(input.name, extension).normalize("NFKC").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 100) || "file";
  return { ok: true, contentType: input.type, safeName: `${base}${extension}` };
}

class LocalDiskStorage implements PrivateStorageAdapter {
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    if (!/^[a-z0-9/-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key.");
    return path.join(this.root, ...key.split("/"));
  }
  async put(key: string, bytes: Buffer) { const target = this.resolve(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: "wx" }); }
  async get(key: string) { return readFile(this.resolve(key)); }
  async remove(key: string) { await rm(this.resolve(key), { force: true }); }
}

class DatabaseStorage implements PrivateStorageAdapter {
  private async client() { return (await import("@/server/db")).db; }
  async put(key: string, bytes: Buffer) { await (await this.client()).storedObject.create({ data: { key, bytes: new Uint8Array(bytes), sizeBytes: bytes.length } }); }
  async get(key: string) {
    const row = await (await this.client()).storedObject.findUnique({ where: { key }, select: { bytes: true } });
    if (!row) throw new Error("Stored object not found.");
    return Buffer.from(row.bytes);
  }
  async remove(key: string) { await (await this.client()).storedObject.deleteMany({ where: { key } }); }
}

export function storageDriver(): "database" | "local" {
  const configured = process.env.PRIVATE_STORAGE_DRIVER?.trim().toLowerCase();
  if (configured === "database" || configured === "local") return configured;
  return serverless ? "database" : "local";
}

let adapter: PrivateStorageAdapter | null = null;
export function privateStorage(): PrivateStorageAdapter {
  if (!adapter) {
    adapter = storageDriver() === "database"
      ? new DatabaseStorage()
      : new LocalDiskStorage(path.resolve(process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), ".data", "private-uploads")));
  }
  return adapter;
}

export type StoredUpload = { storageKey: string; originalName: string; contentType: string; sizeBytes: number; sha256: string };

/** Validates and persists one uploaded browser File. Returns null when no file was chosen. */
export async function storeUpload(file: FormDataEntryValue | null, folder: string): Promise<StoredUpload | null | { error: string }> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateUpload({ name: file.name, type: file.type, size: bytes.length, head: bytes.subarray(0, 16) });
  if (!check.ok) return { error: check.error };
  const storageKey = `${folder.toLowerCase().replace(/[^a-z0-9-]/g, "-")}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
  await privateStorage().put(storageKey, bytes);
  return { storageKey, originalName: check.safeName, contentType: check.contentType, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export function isUploadError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}
