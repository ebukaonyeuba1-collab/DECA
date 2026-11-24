import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/server/payments/registry";
import { handleWebhook } from "@/server/payments/webhook";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const lookup = getPaymentProvider();
  if (!lookup.available) return NextResponse.json({ error: "payments unavailable" }, { status: 503 });
  let raw: string;
  try { raw = await request.text(); } catch { return NextResponse.json({ error: "unreadable body" }, { status: 400 }); }
  try {
    const db = createServiceClient();
    const result = await handleWebhook(raw, request.headers.get("x-paystack-signature"), {
      verifySignature: (b, s) => lookup.provider.verifyWebhookSignature(b, s),
      record: async (e) => {
        const { data, error } = await db.rpc("record_payment_event", {
          p_provider: e.provider, p_event_id: e.eventId, p_event_type: e.eventType, p_signature_valid: true, p_payload: e.payload,
        });
        if (error) throw error;
        return { recorded: data === true };
      },
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
