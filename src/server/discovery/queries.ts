import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toRpcArgs, type DiscoveryParams } from "@/lib/discovery-params";
import type { AvailabilityRow, CategoryRow, CoverageRow, LocationOption, PortfolioRow, ProfessionalCardData, ProfessionalProfile, ReviewRow, ServiceRow } from "./types";

// Discovery reads ONLY the public views and the search RPC, with explicit column lists. Never base tables.
const PROFILE_COLS = "id,slug,display_name,headline,bio,years_experience,account_type,primary_category_slug,primary_category_name,avatar_path,business_name,business_logo_path,rating_avg,review_count,completed_jobs,is_sponsored,identity_verified,credentials_verified,experience_verified,joined_at";
const CARD_COLS = "id,slug,display_name,headline,years_experience,primary_category_slug,primary_category_name,avatar_path,business_name,rating_avg,review_count,completed_jobs,is_sponsored,identity_verified,credentials_verified,experience_verified";

function fail(what: string, error: { message: string }): never { throw new Error(`${what}: ${error.message}`); }

export async function searchProfessionals(params: DiscoveryParams): Promise<{ rows: ProfessionalCardData[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_professionals", toRpcArgs(params));
  if (error) fail("search", error);
  const rows = (data ?? []) as ProfessionalCardData[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_categories").select("id,slug,name,description,icon,service_subcategories(id,slug,name,sort_order,is_active)").eq("is_active", true).order("sort_order");
  if (error) fail("categories", error);
  return (data ?? []).map((c) => {
    const subs = [...(c.service_subcategories ?? [])].filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);
    return { id: c.id, slug: c.slug, name: c.name, description: c.description, icon: c.icon, subcategories: subs.map((s) => ({ slug: s.slug, name: s.name })), subcategoryIds: subs.map((s) => s.id) };
  });
}

export async function categoryCounts(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_category_counts");
  if (error) fail("category counts", error);
  return Object.fromEntries((data ?? []).map((r: { category_slug: string; professional_count: number }) => [r.category_slug, Number(r.professional_count)]));
}

export async function getProfessionalBySlug(slug: string): Promise<ProfessionalProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_professionals").select(PROFILE_COLS).eq("slug", slug).maybeSingle();
  if (error) fail("profile", error);
  return (data as ProfessionalProfile | null) ?? null;
}

export async function getProfessionalsBySlugs(slugs: string[]): Promise<ProfessionalCardData[]> {
  if (slugs.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_professionals").select(CARD_COLS).in("slug", slugs);
  if (error) fail("recent", error);
  const order = new Map(slugs.map((s, i) => [s, i]));
  return ((data ?? []) as ProfessionalCardData[]).sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}

export async function getProfessionalDetail(id: string) {
  const supabase = await createClient();
  const [services, coverage, portfolio, reviews, availability] = await Promise.all([
    supabase.from("public_professional_services").select("id,category_name,subcategory_name,name,description,inclusions,exclusions,pricing_type,price_minor,minimum_charge_minor,additional_charges,duration_minutes,currency").eq("professional_id", id).order("name"),
    supabase.from("public_service_coverage").select("location_id,level,location_name,state_name,city_name,neighbourhood_name,travel_available,remote_available").eq("professional_id", id),
    supabase.from("public_portfolio").select("id,title,description,completed_on,category_slug,media").eq("professional_id", id).order("completed_on", { ascending: false, nullsFirst: false }).limit(12),
    supabase.from("public_reviews").select("id,rating_overall,rating_quality,rating_communication,rating_punctuality,rating_value,body,created_at,reviewer_name,response_body,response_at").eq("professional_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("public_availability").select("weekday,start_time,end_time").eq("professional_id", id).order("weekday"),
  ]);
  for (const r of [services, coverage, portfolio, reviews, availability]) if (r.error) fail("profile detail", r.error);
  return {
    services: (services.data ?? []) as ServiceRow[], coverage: (coverage.data ?? []) as CoverageRow[], portfolio: (portfolio.data ?? []) as PortfolioRow[],
    reviews: (reviews.data ?? []) as ReviewRow[], availability: (availability.data ?? []) as AvailabilityRow[],
  };
}

export async function listLocations(parentId: string | null): Promise<LocationOption[]> {
  const supabase = await createClient();
  let q = supabase.from("locations").select("id,name,level").eq("is_active", true).order("name");
  q = parentId ? q.eq("parent_id", parentId) : q.eq("level", "state");
  const { data, error } = await q;
  if (error) fail("locations", error);
  return (data ?? []) as LocationOption[];
}

/** The signed-in customer's saved professionals (RLS limits this to their own rows). */
export async function getSavedIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("saved_professionals").select("professional_id");
  return new Set((data ?? []).map((r: { professional_id: string }) => r.professional_id));
}
