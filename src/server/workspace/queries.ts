import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, type SessionUser } from "@/server/auth/session";
import type { Dashboard } from "@/lib/workspace";

/** Every workspace page needs a professional profile; otherwise the person is sent to finish setup. */
export async function requireProfessional(): Promise<{ user: SessionUser; professionalId: string }> {
  const user = await requireRole(["professional"]);
  const supabase = await createClient();
  const { data } = await supabase.from("professional_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/workspace/onboarding/profile");
  return { user, professionalId: (data as { id: string }).id };
}

export async function getDashboard(): Promise<Dashboard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("professional_dashboard");
  if (error) throw new Error(`dashboard: ${error.message}`);
  return (data ?? {}) as Dashboard;
}

type Booking = { id: string; reference: string; status: string; title: string; description: string | null; address_text: string | null; scheduled_start: string | null; agreed_amount_minor: number | null; currency: string; customer_id: string; created_at: string; conversation_id: string | null };
const BOOKING_COLS = "id,reference,status,title,description,address_text,scheduled_start,agreed_amount_minor,currency,customer_id,created_at,conversation_id";

async function partyNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("conversation_parties").select("id,display_name").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
}

export async function listBookings(statuses: string[], limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("bookings").select(BOOKING_COLS).in("status", statuses).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`bookings: ${error.message}`);
  const rows = (data ?? []) as Booking[]; const names = await partyNames(rows.map((r) => r.customer_id));
  const updates = rows.length ? (((await supabase.from("job_updates").select("booking_id,message,created_at").in("booking_id", rows.map((r) => r.id)).order("created_at", { ascending: false })).data ?? []) as { booking_id: string; message: string | null; created_at: string }[]) : [];
  return rows.map((r) => ({ ...r, customerName: names.get(r.customer_id) ?? "Customer", updates: updates.filter((u) => u.booking_id === r.id).slice(0, 3) }));
}

export async function listQuotations() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotations").select("id,number,status,total_minor,currency,valid_until,sent_at,booking_id,customer_id,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`quotations: ${error.message}`);
  const rows = (data ?? []) as { id: string; number: string; status: string; total_minor: number; currency: string; valid_until: string | null; sent_at: string | null; booking_id: string; customer_id: string; created_at: string }[];
  const names = await partyNames(rows.map((r) => r.customer_id));
  return rows.map((r) => ({ ...r, customerName: names.get(r.customer_id) ?? "Customer" }));
}

export async function listCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("professional_customers");
  if (error) throw new Error(`customers: ${error.message}`);
  return (data ?? []) as { customer_id: string; display_name: string; bookings_count: number; completed_count: number; last_booking_at: string | null; note: string | null }[];
}

export async function getEarningsLists() {
  const supabase = await createClient();
  const [tx, payouts, commissions] = await Promise.all([
    supabase.from("payment_transactions").select("id,provider_reference,amount_minor,currency,status,is_sandbox,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("payouts").select("id,amount_minor,currency,status,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("commissions").select("id,booking_id,rate_bps,amount_minor,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    transactions: (tx.data ?? []) as { id: string; provider_reference: string; amount_minor: number; currency: string; status: string; is_sandbox: boolean; created_at: string }[],
    payouts: (payouts.data ?? []) as { id: string; amount_minor: number; currency: string; status: string; created_at: string }[],
    commissions: (commissions.data ?? []) as { id: string; booking_id: string; rate_bps: number; amount_minor: number; created_at: string }[],
  };
}

export async function listConversations(userId: string) {
  const supabase = await createClient();
  const [convs, parts, msgs] = await Promise.all([
    supabase.from("conversations").select("id,customer_id,last_message_at").order("last_message_at", { ascending: false }).limit(50),
    supabase.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id", userId),
    supabase.from("messages").select("conversation_id,sender_id,created_at,body").is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
  ]);
  const rows = (convs.data ?? []) as { id: string; customer_id: string; last_message_at: string }[];
  const names = await partyNames(rows.map((r) => r.customer_id));
  const read = new Map(((parts.data ?? []) as { conversation_id: string; last_read_at: string | null }[]).map((p) => [p.conversation_id, p.last_read_at]));
  const messages = (msgs.data ?? []) as { conversation_id: string; sender_id: string; created_at: string; body: string }[];
  return rows.map((r) => {
    const mine = messages.filter((m) => m.conversation_id === r.id); const lr = read.get(r.id);
    return { ...r, customerName: names.get(r.customer_id) ?? "Customer", unread: mine.filter((m) => m.sender_id !== userId && (!lr || m.created_at > lr)).length, preview: mine[0]?.body ?? null };
  });
}

export async function getSubscription(professionalId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("status,current_period_end,subscription_plans(name,tier)").eq("professional_id", professionalId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  return data as unknown as { status: string; current_period_end: string | null; subscription_plans: { name: string; tier: string } | null } | null;
}

export async function getServiceForEdit(professionalId: string, id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("professional_services").select("id,name,category_id,subcategory_id,description,inclusions,exclusions,pricing_type,price_minor,minimum_charge_minor,additional_charges,duration_minutes").eq("id", id).eq("professional_id", professionalId).is("deleted_at", null).maybeSingle();
  return data as { id: string; name: string; category_id: string; subcategory_id: string | null; description: string | null; inclusions: string | null; exclusions: string | null; pricing_type: string; price_minor: number | null; minimum_charge_minor: number | null; additional_charges: string | null; duration_minutes: number | null } | null;
}
