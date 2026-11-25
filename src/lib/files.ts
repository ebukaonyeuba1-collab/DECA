export const DOCUMENT_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;   // matches the verification-documents bucket limit
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;       // matches the public-media bucket limit
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export type UploadKind = "document" | "image";
/** Returns a user-facing error, or null when acceptable. The buckets enforce the same limits server-side. */
export function validateUpload(f: { type: string; size: number }, kind: UploadKind): string | null {
  const allowed: readonly string[] = kind === "document" ? DOCUMENT_MIME : IMAGE_MIME;
  if (!allowed.includes(f.type)) return kind === "document" ? "Upload a JPG, PNG or PDF file." : "Upload a JPG, PNG or WebP image.";
  if (f.size <= 0) return "That file is empty.";
  if (f.size > (kind === "document" ? DOCUMENT_MAX_BYTES : IMAGE_MAX_BYTES)) return kind === "document" ? "Files must be 10 MB or smaller." : "Images must be 5 MB or smaller.";
  return null;
}
/** Safe storage file name: ASCII only, no path separators, extension forced from the verified MIME type. */
export function safeFileName(name: string, mime: string): string {
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/\.+/g, ".").replace(/^[-.]+|[-.]+$/g, "").toLowerCase().slice(0, 60);
  return `${base || "file"}.${EXT[mime] ?? "bin"}`;
}
