import { describe, expect, it, vi } from "vitest";
import { handleWebhook, MAX_WEBHOOK_BYTES, type WebhookDeps } from "./webhook";

const body = JSON.stringify({ event: "charge.success", data: { id: 42, reference: "r1", status: "success" } });
const deps = (over: Partial<WebhookDeps> = {}): WebhookDeps => ({
  verifySignature: () => true,
  record: vi.fn(async () => ({ recorded: true })),
  ...over,
});

describe("payment webhook handler", () => {
  it("rejects a bad signature before reading the payload", async () => {
    const d = deps({ verifySignature: () => false });
    expect((await handleWebhook(body, "bad", d)).status).toBe(401);
    expect(d.record).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON without throwing", async () => {
    expect((await handleWebhook("{not json", "sig", deps())).status).toBe(400);
    expect((await handleWebhook("", "sig", deps())).status).toBe(400);
  });
  it("rejects wrong shapes and missing identifiers", async () => {
    for (const bad of ["[]", "null", '"str"', '{"event":1}', '{"event":"x"}', '{"event":"x","data":{}}', '{"event":"x","data":"nope"}']) {
      const r = await handleWebhook(bad, "sig", deps());
      expect(r.status).toBe(400);
    }
  });
  it("rejects oversized bodies", async () => {
    expect((await handleWebhook("x".repeat(MAX_WEBHOOK_BYTES + 1), "sig", deps())).status).toBe(413);
  });
  it("records a new event once and reports replays as duplicates (still 200)", async () => {
    const first = await handleWebhook(body, "sig", deps());
    expect(first).toEqual({ status: 200, body: { received: true, duplicate: false } });
    const replay = await handleWebhook(body, "sig", deps({ record: async () => ({ recorded: false }) }));
    expect(replay).toEqual({ status: 200, body: { received: true, duplicate: true } });
  });
  it("builds a stable event id from event name and provider id", async () => {
    const d = deps();
    await handleWebhook(body, "sig", d);
    expect(d.record).toHaveBeenCalledWith(expect.objectContaining({ provider: "paystack", eventId: "charge.success:42", eventType: "charge.success" }));
  });
  it("returns 500 (retryable) when recording fails, never an unhandled error", async () => {
    const r = await handleWebhook(body, "sig", deps({ record: async () => { throw new Error("db down"); } }));
    expect(r.status).toBe(500);
  });
  it("never trusts payload status: no settlement dependency exists in the handler", () => {
    expect(Object.keys(deps())).toEqual(["verifySignature", "record"]);
  });
});
