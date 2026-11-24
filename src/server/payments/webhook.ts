import { z } from "zod";

/** Maximum accepted webhook body (bytes). Provider events are small; anything larger is rejected before parsing. */
export const MAX_WEBHOOK_BYTES = 256 * 1024;

const payloadSchema = z.object({
  event: z.string().min(1).max(100),
  data: z.object({ id: z.union([z.string().min(1), z.number()]).optional(), reference: z.string().min(1).max(200).optional() }).passthrough(),
}).passthrough();

export type WebhookDeps = {
  verifySignature: (rawBody: string, signature: string | null) => boolean;
  /** Records the event once. Must return recorded=false for a replay (database unique constraint). */
  record: (e: { provider: string; eventId: string; eventType: string; payload: unknown }) => Promise<{ recorded: boolean }>;
};
export type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * Stage 1 scope: authenticate, validate, and record. It deliberately NEVER changes a payment's status:
 * settlement and booking transitions are Stage 7 and must start from provider.verify() on the server,
 * never from this payload and never from the browser.
 */
export async function handleWebhook(rawBody: string, signature: string | null, deps: WebhookDeps, provider = "paystack"): Promise<WebhookResult> {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return { status: 413, body: { error: "payload too large" } };
  if (!deps.verifySignature(rawBody, signature)) return { status: 401, body: { error: "invalid signature" } };

  let json: unknown;
  try { json = JSON.parse(rawBody); } catch { return { status: 400, body: { error: "malformed json" } }; }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return { status: 400, body: { error: "unexpected payload shape" } };

  const { event, data } = parsed.data;
  const ref = data.id ?? data.reference;
  if (ref === undefined) return { status: 400, body: { error: "missing event identifier" } };

  try {
    const { recorded } = await deps.record({ provider, eventId: `${event}:${ref}`, eventType: event, payload: parsed.data });
    return { status: 200, body: { received: true, duplicate: !recorded } };
  } catch {
    // 500 makes the provider retry, which is safe because recording is idempotent.
    return { status: 500, body: { error: "could not record event" } };
  }
}
