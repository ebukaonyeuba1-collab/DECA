import { ActionForm } from "@/components/onboarding/action-form";
import { LocationSelect } from "@/components/onboarding/location-select";
import { Avatar } from "@/components/marketplace/avatar";
import { PublicImageUpload } from "@/components/onboarding/uploaders";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/server/auth/session";
import { listLocations } from "@/server/discovery/queries";
import { saveCustomerProfile } from "@/server/onboarding/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };
const inp = "h-12 w-full rounded-2xl border-2 border-line bg-surface px-3 text-base";

export default async function CustomerProfile() {
  const user = await requireRole(["customer"]);
  const supabase = await createClient();
  const [{ data: p }, states] = await Promise.all([supabase.from("profiles").select("full_name,phone,avatar_path,location_id,phone_verified_at").eq("id", user.id).maybeSingle(), listLocations(null)]);
  const loc = p?.location_id ? (await supabase.from("locations").select("name").eq("id", p.location_id).maybeSingle()).data?.name : null;
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-extrabold">Your profile</h1>
      <div className="flex items-center gap-4"><Avatar name={p?.full_name ?? "You"} path={p?.avatar_path ?? null} className="h-20 w-20 text-2xl" /><PublicImageUpload userId={user.id} folder="avatar" label={p?.avatar_path ? "Change photo" : "Add photo"} onDone="avatar" /></div>
      <ActionForm action={saveCustomerProfile} submitLabel="Save profile">
        <div><label htmlFor="fn" className="mb-1.5 block text-sm font-bold">Full name</label><input id="fn" name="fullName" required defaultValue={p?.full_name} className={inp} autoComplete="name" /></div>
        <div><label htmlFor="ph" className="mb-1.5 block text-sm font-bold">Phone number</label><input id="ph" name="phone" type="tel" required defaultValue={p?.phone ?? ""} className={inp} autoComplete="tel" /><p className="mt-1 text-xs text-ink-muted">{p?.phone_verified_at ? "Verified." : "Phone verification is not available yet. Your number stays private."}</p></div>
        <LocationSelect states={states} name="locationId" label="Preferred service area" initialId={p?.location_id} initialLabel={loc} />
      </ActionForm>
    </div>
  );
}
