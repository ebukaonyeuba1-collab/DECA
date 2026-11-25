import { notFound, redirect } from "next/navigation";
import { listCategories } from "@/server/discovery/queries";
import { isSupabaseConfigured } from "@/lib/env";

/** Category landing: resolves the slug against active categories, then shows the filtered explore view. */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();
  const categories = await listCategories().catch(() => []);
  if (!categories.some((c) => c.slug === slug)) notFound();
  redirect(`/explore?category=${slug}`);
}
