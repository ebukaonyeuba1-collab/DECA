import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toAdminRpcArgs, type AdminParams } from "@/lib/admin-verification";

export type AdminRow = {
  professional_id: string; application_id: string | null; display_name: string; slug: string; account_type: string; business_name: string | null;
  category_name: string | null; location_label: string | null; status: string; is_listed: boolean; submitted_at: string | null; reviewed_at: string | null;
  decision_reason: string | null; reviewed_by_name: string | null; joined_at: string; total_count: number;
};

// Every read below runs as the signed-in administrator. The database re-checks the role in each function and policy.
export async function listProfessionals(params: AdminParams): Promise<{ rows: AdminRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_professionals", toAdminRpcArgs(params));
  if (error) throw new Error(`admin list: ${error.message}`);
  const rows = (data ?? []) as AdminRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}
export async function verificationCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_verification_counts");
  if (error) throw new Error(`admin counts: ${error.message}`);
  return Object.fromEntries(((data ?? []) as { grp: string; n: number }[]).map((r) => [r.grp, Number(r.n)]));
}

export async function getApplicationDetail(applicationId: string) {
  const supabase = await createClient();
  const { data: app } = await supabase.from("verification_applications").select("id,professional_id,status,submitted_at,reviewed_by,reviewed_at,decision_reason,internal_notes").eq("id", applicationId).maybeSingle();
  if (!app) return null;
  const pid = app.professional_id as string;
  const { data: pro } = await supabase.from("professional_profiles").select("id,user_id,slug,account_type,display_name,headline,bio,years_experience,primary_category_id,business_id,verification_status,is_listed,created_at").eq("id", pid).maybeSingle();
  if (!pro) return null;
  const [profile, business, services, coverage, portfolio, docs, reqs, events, accepted, policySetting, categories] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone,phone_verified_at,location_id,created_at").eq("id", pro.user_id).maybeSingle(),
    pro.business_id ? supabase.from("businesses").select("registered_name,registration_number,description,address_line,email,phone,year_established,website").eq("id", pro.business_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("professional_services").select("id,name,category_id,pricing_type,price_minor,minimum_charge_minor,additional_charges,duration_minutes,description,is_active,deleted_at").eq("professional_id", pid).order("created_at"),
    supabase.from("service_locations").select("id,travel_available,remote_available,locations(name,level)").eq("professional_id", pid),
    supabase.from("portfolio_items").select("id,title,description,completed_on,portfolio_media(id,storage_path,kind)").eq("professional_id", pid).is("deleted_at", null),
    supabase.from("professional_documents").select("id,requirement_id,file_name,mime_type,size_bytes,review_status,review_note,reviewed_by,reviewed_at,uploaded_at,created_at,deleted_at").eq("professional_id", pid).order("created_at"),
    supabase.rpc("applicable_requirements", { p_professional: pid }),
    supabase.from("verification_events").select("id,actor_id,event_type,from_status,to_status,message,created_at").eq("application_id", applicationId).order("created_at", { ascending: false }).order("id"),
    supabase.from("policy_acceptances").select("policy_key,version,accepted_at").eq("user_id", pro.user_id),
    supabase.from("platform_settings").select("value").eq("key", "policies").maybeSingle(),
    supabase.from("service_categories").select("id,name"),
  ]);
  const location = (profile.data as { location_id: string | null } | null)?.location_id
    ? (await supabase.from("locations").select("name,parent_id").eq("id", (profile.data as { location_id: string }).location_id).maybeSingle()).data as { name: string; parent_id: string | null } | null : null;
  const parent = location?.parent_id ? (await supabase.from("locations").select("name").eq("id", location.parent_id).maybeSingle()).data as { name: string } | null : null;
  // Resolve administrator names with one extra read (no fragile embeds).
  const actorIds = [...new Set([app.reviewed_by, ...((events.data ?? []) as { actor_id: string | null }[]).map((e) => e.actor_id), ...((docs.data ?? []) as { reviewed_by: string | null }[]).map((d) => d.reviewed_by)].filter(Boolean) as string[])];
  const names = actorIds.length ? ((await supabase.from("profiles").select("id,full_name").in("id", actorIds)).data ?? []) as { id: string; full_name: string }[] : [];
  return {
    app: app as { id: string; professional_id: string; status: string; submitted_at: string | null; reviewed_by: string | null; reviewed_at: string | null; decision_reason: string | null; internal_notes: string | null },
    pro: pro as { id: string; user_id: string; slug: string; account_type: string; display_name: string; headline: string | null; bio: string | null; years_experience: number | null; primary_category_id: string | null; business_id: string | null; verification_status: string; is_listed: boolean; created_at: string },
    profile: profile.data as { full_name: string; email: string | null; phone: string | null; phone_verified_at: string | null; created_at: string } | null,
    locationLabel: location ? [location.name, parent?.name].filter(Boolean).join(", ") : null,
    business: business.data as Record<string, string | number | null> | null,
    services: (services.data ?? []) as { id: string; name: string; category_id: string; pricing_type: string; price_minor: number | null; minimum_charge_minor: number | null; additional_charges: string | null; duration_minutes: number | null; description: string | null; is_active: boolean; deleted_at: string | null }[],
    coverage: (coverage.data ?? []) as unknown as { id: string; travel_available: boolean; remote_available: boolean; locations: { name: string; level: string } | null }[],
    portfolio: (portfolio.data ?? []) as unknown as { id: string; title: string; description: string | null; completed_on: string | null; portfolio_media: { id: string; storage_path: string; kind: string }[] }[],
    docs: (docs.data ?? []) as { id: string; requirement_id: string | null; file_name: string; mime_type: string | null; size_bytes: number | null; review_status: string; review_note: string | null; reviewed_by: string | null; reviewed_at: string | null; uploaded_at: string | null; created_at: string; deleted_at: string | null }[],
    reqs: (reqs.data ?? []) as { id: string; name: string; is_required: boolean }[],
    events: (events.data ?? []) as { id: string; actor_id: string | null; event_type: string; from_status: string | null; to_status: string | null; message: string | null; created_at: string }[],
    accepted: (accepted.data ?? []) as { policy_key: string; version: string; accepted_at: string }[],
    currentPolicyVersion: ((policySetting.data as { value?: { version?: string } } | null)?.value?.version) ?? null,
    categoryNames: new Map(((categories.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])),
    adminNames: new Map(names.map((n) => [n.id, n.full_name || "Administrator"])),
  };
}
export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;
