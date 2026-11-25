import { describe, expect, it } from "vitest";
import { DOCUMENT_MAX_BYTES, IMAGE_MAX_BYTES, safeFileName, validateUpload } from "./files";
import { nairaToKobo } from "./naira";
import { safeNext } from "./safe-redirect";
import { slugify, withSuffix } from "./slug";

describe("safeNext (open-redirect protection)", () => {
  it("allows same-site paths", () => { expect(safeNext("/workspace/onboarding/services?x=1")).toBe("/workspace/onboarding/services?x=1"); });
  it("rejects external, protocol-relative, backslash and control-character targets", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "evil", "/ok\nSet-Cookie: x", "", undefined, null, 5, "/" + "a".repeat(300)]) expect(safeNext(bad, "/home")).toBe("/home");
  });
});
describe("slugify", () => {
  it("produces database-valid slugs", () => {
    const re = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const input of ["Ade Plumbing Services", "  Ọlá's  Électrics!! ", "---", "日本語", "A".repeat(200), "x_y z"]) expect(slugify(input)).toMatch(re);
    expect(slugify("Ade Plumbing Services")).toBe("ade-plumbing-services");
    expect(slugify("日本語")).toBe("professional");
    expect(withSuffix("ade", 0)).toMatch(re);
  });
});
describe("upload validation", () => {
  it("accepts documents up to 10 MB in allowed types and rejects the rest", () => {
    expect(validateUpload({ type: "application/pdf", size: 1000 }, "document")).toBeNull();
    expect(validateUpload({ type: "image/webp", size: 1000 }, "document")).not.toBeNull();
    expect(validateUpload({ type: "application/x-msdownload", size: 1000 }, "document")).not.toBeNull();
    expect(validateUpload({ type: "image/png", size: DOCUMENT_MAX_BYTES + 1 }, "document")).not.toBeNull();
    expect(validateUpload({ type: "image/png", size: 0 }, "document")).not.toBeNull();
  });
  it("accepts images up to 5 MB and never PDFs for public media", () => {
    expect(validateUpload({ type: "image/webp", size: IMAGE_MAX_BYTES }, "image")).toBeNull();
    expect(validateUpload({ type: "image/webp", size: IMAGE_MAX_BYTES + 1 }, "image")).not.toBeNull();
    expect(validateUpload({ type: "application/pdf", size: 10 }, "image")).not.toBeNull();
  });
  it("sanitises file names and forces the extension from the MIME type", () => {
    expect(safeFileName("../../etc/passwd.exe", "application/pdf")).toBe("etc-passwd.pdf");
    expect(safeFileName("../../etc/passwd.exe", "application/pdf")).not.toMatch(/[\\/]|\.\./);
    expect(safeFileName("My ID (front).JPG", "image/jpeg")).toBe("my-id-front.jpg");
    expect(safeFileName("....", "image/png")).toBe("file.png");
    expect(safeFileName("a/b\\c.png", "image/png")).not.toMatch(/[\\/]/);
    expect(safeFileName("x".repeat(300) + ".png", "image/png").length).toBeLessThan(70);
  });
});
describe("naira input", () => {
  it("converts to kobo and rejects invalid amounts", () => {
    expect(nairaToKobo("8,500")).toBe(850_000); expect(nairaToKobo("₦8500.50")).toBe(850_050);
    for (const bad of ["", "0", "-5", "abc", "1e5", "10.999", "99999999999", null, undefined]) expect(nairaToKobo(bad as string)).toBeNull();
  });
});
