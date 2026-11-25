import { notFound } from "next/navigation";
import { POLICY_DRAFT, POLICY_TITLES, isPolicyKey } from "@/lib/policies";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params; return { title: isPolicyKey(key) ? POLICY_TITLES[key] : "Policy" };
}
export default async function Policy({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isPolicyKey(key)) notFound();
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <p className="rounded-2xl bg-warning/10 p-3 text-sm font-bold text-warning">Draft summary. This text is pending legal review and is not a final policy.</p>
      <h1 className="mt-6 text-3xl font-extrabold">{POLICY_TITLES[key]}</h1>
      <ul className="mt-6 list-disc space-y-3 pl-5">{POLICY_DRAFT[key].map((l) => <li key={l}>{l}</li>)}</ul>
    </article>
  );
}
