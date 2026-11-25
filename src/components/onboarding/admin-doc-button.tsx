"use client";
import { useState } from "react";
import { getAdminDocumentUrl } from "@/server/admin/verification";

export function AdminDocButton({ documentId }: { documentId: string }) {
  const [err, setErr] = useState(false);
  return <><button type="button" className="font-bold text-forest underline" onClick={async () => { const r = await getAdminDocumentUrl(documentId); if ("url" in r) window.open(r.url, "_blank", "noopener,noreferrer"); else setErr(true); }}>Open file</button>{err && <span role="alert" className="ml-2 text-sm text-danger">Could not open</span>}</>;
}
