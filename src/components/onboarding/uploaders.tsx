"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { validateUpload, safeFileName, type UploadKind } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { confirmDocumentUpload, createDocumentRecord, getDocumentUrl, addPortfolioMedia, setAvatar } from "@/server/onboarding/actions";

/** Public images (avatar, portfolio): uploaded straight to the user's own folder in the public bucket. */
export function PublicImageUpload({ userId, folder, label, onDone }: { userId: string; folder: "avatar" | `portfolio/${string}`; label: string; onDone: "avatar" | { itemId: string; kind?: "work" | "before" | "after" } }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go(file: File) {
    const bad = validateUpload(file, "image"); if (bad) return setMsg({ ok: false, text: bad });
    setBusy(true); setMsg(null);
    const path = `${userId}/${folder === "avatar" ? "avatar" : folder}/${crypto.randomUUID()}-${safeFileName(file.name, file.type)}`;
    const up = await createClient().storage.from("public-media").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { setBusy(false); return setMsg({ ok: false, text: "Upload failed. Check your connection and try again." }); }
    const res = onDone === "avatar" ? await setAvatar(path) : await addPortfolioMedia(onDone.itemId, path, onDone.kind);
    setBusy(false);
    if (res.error) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: true, text: "Uploaded." }); router.refresh();
  }
  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={label} onChange={(e) => { const f = e.target.files?.[0]; if (f) void go(f); e.target.value = ""; }} />
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : label}</Button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 text-sm font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

/** Private verification documents: record first, then upload against it, then confirm. Never public. */
export function DocumentUploader({ requirementId, label, disabled }: { requirementId: string | null; label: string; disabled?: boolean }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"idle" | "record" | "upload" | "confirm">("idle"); const [err, setErr] = useState<string | null>(null);
  async function go(file: File) {
    setErr(null);
    const bad = validateUpload(file, "document"); if (bad) return setErr(bad);
    setStep("record");
    const rec = await createDocumentRecord({ requirementId, fileName: file.name, mime: file.type, size: file.size });
    if ("error" in rec) { setStep("idle"); return setErr(rec.error); }
    setStep("upload");
    const up = await createClient().storage.from("verification-documents").upload(rec.path, file, { contentType: file.type, upsert: false });
    if (up.error) { setStep("idle"); return setErr("Upload failed. Remove the entry and try again."); }
    setStep("confirm");
    const c = await confirmDocumentUpload(rec.documentId);
    setStep("idle");
    if (c.error) return setErr(c.error);
    router.refresh();
  }
  const busy = step !== "idle";
  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" aria-label={label} disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) void go(f); e.target.value = ""; }} />
      <Button type="button" variant="secondary" size="sm" disabled={busy || disabled} onClick={() => input.current?.click()}>{busy ? { record: "Preparing…", upload: "Uploading…", confirm: "Checking…", idle: "" }[step] : label}</Button>
      {err && <p role="alert" className="mt-1 text-sm font-semibold text-danger">{err}</p>}
    </div>
  );
}

export function ViewDocumentButton({ documentId }: { documentId: string }) {
  const [err, setErr] = useState(false);
  return <><button type="button" className="text-sm font-bold text-forest underline" onClick={async () => { const r = await getDocumentUrl(documentId); if ("url" in r) window.open(r.url, "_blank", "noopener,noreferrer"); else setErr(true); }}>View</button>{err && <span role="alert" className="ml-2 text-sm text-danger">Could not open</span>}</>;
}
