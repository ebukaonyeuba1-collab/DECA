import type { PricingType } from "@/lib/pricing";

export type ProfessionalCardData = {
  id: string; slug: string; display_name: string; headline: string | null; summary: string | null; years_experience: number | null;
  primary_category_slug: string | null; primary_category_name: string | null; avatar_path: string | null; business_name: string | null;
  rating_avg: number; review_count: number; completed_jobs: number; is_sponsored: boolean;
  identity_verified: boolean; credentials_verified: boolean; experience_verified: boolean;
  starting_price_minor: number | null; pricing_type: PricingType | null; currency: string | null; location_label: string | null; total_count: number;
};
export type ProfessionalProfile = Omit<ProfessionalCardData, "summary" | "starting_price_minor" | "pricing_type" | "currency" | "location_label" | "total_count"> & {
  bio: string | null; account_type: string; business_logo_path: string | null; joined_at: string;
};
export type ServiceRow = { id: string; category_name: string; subcategory_name: string | null; name: string; description: string | null; inclusions: string | null; exclusions: string | null; pricing_type: PricingType; price_minor: number | null; minimum_charge_minor: number | null; additional_charges: string | null; duration_minutes: number | null; currency: string };
export type CoverageRow = { location_id: string; level: string; location_name: string; state_name: string | null; city_name: string | null; neighbourhood_name: string | null; travel_available: boolean; remote_available: boolean };
export type PortfolioRow = { id: string; title: string; description: string | null; completed_on: string | null; category_slug: string | null; media: { path: string; type: "image" | "video"; kind: "work" | "before" | "after" }[] };
export type ReviewRow = { id: string; rating_overall: number; rating_quality: number | null; rating_communication: number | null; rating_punctuality: number | null; rating_value: number | null; body: string | null; created_at: string; reviewer_name: string; response_body: string | null; response_at: string | null };
export type AvailabilityRow = { weekday: number; start_time: string; end_time: string };
export type CategoryRow = { id: string; slug: string; name: string; description: string | null; icon: string | null; subcategories: { slug: string; name: string }[] };
export type LocationOption = { id: string; name: string; level: string };
