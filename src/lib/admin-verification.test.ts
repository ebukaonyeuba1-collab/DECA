import { describe, expect, it } from "vitest";
import { ADMIN_GROUPS, adminQuery, describeEvent, parseAdminParams, toAdminRpcArgs } from "./admin-verification";

const uuid = "00000000-0000-4000-8000-000000000001";
describe("admin views", () => {
  it("defaults to the pending queue and exposes pending, approved and rejected views", () => {
    expect(parseAdminParams({}).group).toBe("pending");
    for (const g of ["pending", "approved", "rejected"]) expect(ADMIN_GROUPS.some((x) => x.key === g)).toBe(true);
    expect(parseAdminParams({ group: "approved" }).group).toBe("approved");
    expect(parseAdminParams({ group: "rejected" }).group).toBe("rejected");
  });
  it("parses filters and drops hostile input", () => {
    expect(parseAdminParams({ group: "all", q: "  ade ", status: "approved", category: "plumbing", l: uuid, page: "3" }))
      .toMatchObject({ group: "all", q: "ade", status: "approved", category: "plumbing", loc: uuid, page: 3 });
    expect(parseAdminParams({ group: "everything", status: "hacked", category: "x; drop", l: "nope", page: "-4" }))
      .toMatchObject({ group: "pending", status: undefined, category: undefined, loc: undefined, page: 1 });
    expect(parseAdminParams({ q: "a".repeat(400) }).q?.length).toBe(80);
  });
  it("builds links that keep filters and maps to the RPC", () => {
    const p = parseAdminParams({ group: "rejected", q: "ade", page: "2" });
    expect(adminQuery(p)).toBe("?group=rejected&q=ade&page=2");
    expect(adminQuery(p, { group: "approved", page: undefined })).toBe("?group=approved&q=ade");
    expect(adminQuery(parseAdminParams({}))).toBe("");
    expect(toAdminRpcArgs(p)).toMatchObject({ p_group: "rejected", p_query: "ade", p_limit: 20, p_offset: 20, p_status: null });
  });
});
describe("decision history wording", () => {
  it("shows the decision, the previous state and the reason", () => {
    expect(describeEvent({ event_type: "admin_decision", from_status: "submitted", to_status: "rejected", message: "Documents unreadable" }))
      .toEqual({ title: "Decision: Rejected", detail: "From Submitted. Reason: Documents unreadable" });
    expect(describeEvent({ event_type: "admin_decision", from_status: "under_review", to_status: "approved", message: null }).title).toBe("Decision: Approved");
  });
  it("explains a sensitive profile change", () => {
    expect(describeEvent({ event_type: "sensitive_change", from_status: "approved", to_status: "under_review", message: "Professional changed their main category." }).title).toBe("Sensitive profile change");
  });
  it("handles document events and unknown types", () => {
    expect(describeEvent({ event_type: "document_rejected", from_status: null, to_status: null, message: "blurry" }).detail).toBe("Reason: blurry");
    expect(describeEvent({ event_type: "something_new", from_status: null, to_status: null, message: null }).title).toBe("something new");
  });
});
