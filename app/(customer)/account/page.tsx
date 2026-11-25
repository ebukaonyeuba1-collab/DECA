import Link from "next/link";
import { requireRole } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function Account() {
  const user = await requireRole(["customer"]);
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name,phone,location_id,phone_verified_at").eq("id", user.id).maybeSingle();
  const missing = [!p?.full_name && "your name", !p?.phone && "your phone number", !p?.location_id && "your location"].filter(Boolean);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Hello{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}</h1>
      {missing.length > 0 ? <p className="rounded-2xl bg-warning/10 p-4 font-semibold">Complete your profile: add {missing.join(", ")}. <Link href="/account/profile" className="underline">Update profile</Link></p> : <p className="rounded-2xl bg-mint-50 p-4 font-semibold">Your profile is complete. <Link href="/account/profile" className="underline">Edit</Link></p>}
      <p className="text-ink-muted">Bookings, messages and saved professionals arrive in the next stages. Until then you can <Link href="/explore" className="font-bold text-forest underline">explore professionals</Link> and save the ones you like.</p>
    </div>
  );
}
