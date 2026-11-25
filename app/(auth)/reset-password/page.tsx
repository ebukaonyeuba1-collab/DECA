import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=confirmation");   // reached only through a valid recovery link
  return <main className="mx-auto max-w-md px-6 py-16"><h1 className="text-3xl font-extrabold">Choose a new password</h1><div className="mt-8"><ResetForm /></div></main>;
}
