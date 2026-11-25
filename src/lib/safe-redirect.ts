/** Allows only same-site relative paths. Blocks protocol-relative URLs, backslashes, control characters and absurd lengths. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
