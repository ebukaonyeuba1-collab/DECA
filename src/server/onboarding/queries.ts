import "server-only";
import { createClient } from "@/lib/supabase/server";
import { stepStates, type Progress } from "@/lib/onboarding-steps";

export type OnboardingData = Awaited<ReturnType<typeof getOnboardingData>>;

/** Everything the onboarding screens need, read through the user's own session (RLS applies). */
export async function getOnboardingData(userId: string) {
  const supabase = await createClient();
  const [profileQ, proQ] = await Promise.all([
    supabase.from("profiles").select("full_name,phone,avatar_path,location_id").eq("id", userId).maybeSingle(),
    supabase.from("professional_profiles").select("id,slug,account_type,business_id,display_name,headline,bio,years_experience,primary_category_id,verification_status,is_listed").eq("user_id", userId).maybeSingle(),
  ]);
  const profile = profileQ.data as { full_name: string; phone: string | null; avatar_path: string | null; location_id: string | null } | null;
  const pro = proQ.data as { id: string; slug: string; account_type: string; business_id: string | null; display_name: string; headline: string | null; bio: string | null; years_experience: number | null; primary_category_id: string | null; verification_status: string; is_listed: boolean } | null;
  const empty = { data: [] as never[] };
  const pid = pro?.id;
  const [business, services, coverage, portfolio, availability, exceptions, documents, requirements, application, accepted, policies, location] = await Promise.all([
    pro?.business_id ? supabase.from("businesses").select("registered_name,registration_number,description,address_line,email,phone,year_established,website").eq("id", pro.business_id).maybeSingle() : { data: null },
    pid ? supabase.from("professional_services").select("id,name,category_id,pricing_type,price_minor,description").eq("professional_id", pid).is("deleted_at", null).order("created_at") : empty,
    pid ? supabase.from("service_locations").select("id,travel_available,remote_available,locations(name,level,parent_id)").eq("professional_id", pid) : empty,
    pid ? supabase.from("portfolio_items").select("id,title,description,completed_on,portfolio_media(id,storage_path,kind)").eq("professional_id", pid).is("deleted_at", null).order("created_at") : empty,
    pid ? supabase.from("professional_availability").select("weekday,start_time,end_time").eq("professional_id", pid).is("service_id", null) : empty,
    pid ? supabase.from("availability_exceptions").select("id,starts_on,ends_on,reason").eq("professional_id", pid).order("starts_on") : empty,
    pid ? supabase.from("professional_documents").select("id,requirement_id,file_name,review_status,review_note,uploaded_at,created_at").eq("professional_id", pid).is("deleted_at", null).order("created_at") : empty,
    pid ? supabase.rpc("applicable_requirements", { p_professional: pid }) : empty,
    pid ? supabase.from("verification_applications").select("id,status,decision_reason,submitted_at").eq("professional_id", pid).maybeSingle() : { data: null },
    supabase.from("policy_acceptances").select("policy_key,version").eq("user_id", userId),
    supabase.from("platform_settings").select("value").eq("key", "policies").maybeSingle(),
    profile?.location_id ? supabase.from("locations").select("name").eq("id", profile.location_id).maybeSingle() : { data: null },
  ]);
  type Doc = { id: string; requirement_id: string | null; file_name: string; review_status: string; review_note: string | null; uploaded_at: string | null };
  type Req = { id: string; kind: string; name: string; description: string | null; is_required: boolean };
  const docs = (documents.data ?? []) as Doc[]; const reqs = (requirements.data ?? []) as Req[];
  const events = application.data ? ((await supabase.from("verification_events").select("event_type,message,created_at").eq("application_id", (application.data as { id: string }).id).order("created_at", { ascending: false }).limit(10)).data ?? []) : [];
  const requiredReqs = reqs.filter((r) => r.is_required);
  const uploadedRequired = requiredReqs.filter((r) => docs.some((d) => d.requirement_id === r.id && d.uploaded_at && d.review_status !== "rejected")).length;
  const status = (application.data as { status: string } | null)?.status ?? pro?.verification_status ?? "not_started";
  const progress: Progress = {
    hasProfile: !!pro && !!profile?.phone, services: (services.data ?? []).length, coverage: (coverage.data ?? []).length, portfolio: (portfolio.data ?? []).length,
    availabilityRows: (availability.data ?? []).length, requiredDocs: requiredReqs.length, uploadedRequiredDocs: uploadedRequired, status,
  };
  const policy = (policies.data?.value ?? {}) as { version?: string; professional_required?: string[] };
  const acceptedNow = new Set(((accepted.data ?? []) as { policy_key: string; version: string }[]).filter((a) => a.version === policy.version).map((a) => a.policy_key));
  return {
    profile, pro, business: business.data as Record<string, string | number | null> | null, services: (services.data ?? []) as { id: string; name: string; category_id: string; pricing_type: string; price_minor: number | null; description: string | null }[],
    coverage: (coverage.data ?? []) as unknown as { id: string; travel_available: boolean; remote_available: boolean; locations: { name: string; level: string } | null }[],
    portfolio: (portfolio.data ?? []) as unknown as { id: string; title: string; description: string | null; completed_on: string | null; portfolio_media: { id: string; storage_path: string; kind: string }[] }[],
    availability: (availability.data ?? []) as { weekday: number; start_time: string; end_time: string }[],
    exceptions: (exceptions.data ?? []) as { id: string; starts_on: string; ends_on: string; reason: string | null }[],
    docs, reqs, application: application.data as { id: string; status: string; decision_reason: string | null; submitted_at: string | null } | null, events: events as { event_type: string; message: string | null; created_at: string }[],
    requiredPolicies: policy.professional_required ?? [], acceptedPolicies: acceptedNow, locationName: (location.data as { name: string } | null)?.name ?? null,
    steps: stepStates(progress), status,
  };
}
