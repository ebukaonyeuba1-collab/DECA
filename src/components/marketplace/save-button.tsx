import Link from "next/link";
import { Heart } from "lucide-react";
import { toggleSaved } from "@/server/discovery/actions";
import type { SessionUser } from "@/server/auth/session";

/** Customers toggle a saved professional; visitors are sent to sign in; other roles see nothing. */
export function SaveButton({ professionalId, slug, saved, user }: { professionalId: string; slug: string; saved: boolean; user: SessionUser | null }) {
  const cls = "inline-flex h-10 w-10 items-center justify-center rounded-control bg-surface text-forest shadow-soft hover:bg-mint-100";
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/professionals/${slug}`)}`} className={cls} aria-label="Sign in to save this professional"><Heart className="h-5 w-5" aria-hidden="true" /></Link>;
  if (user.role !== "customer") return null;
  return (
    <form action={toggleSaved}>
      <input type="hidden" name="professionalId" value={professionalId} /><input type="hidden" name="slug" value={slug} />
      <button className={cls} aria-label={saved ? "Remove from saved" : "Save professional"} aria-pressed={saved}><Heart className={saved ? "h-5 w-5 fill-forest" : "h-5 w-5"} aria-hidden="true" /></button>
    </form>
  );
}
