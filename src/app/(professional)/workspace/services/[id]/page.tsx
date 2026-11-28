import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/onboarding/action-form";
import { ServiceFields } from "@/components/onboarding/service-fields";
import { PageHeader } from "@/components/workspace/ui";
import { requireProfessional, getServiceForEdit } from "@/server/workspace/queries";
import { listCategories } from "@/server/discovery/queries";
import { updateService } from "@/server/workspace/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit service" };
const koboToNaira = (k: number | null) => (k == null ? "" : String(k / 100));

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { professionalId } = await requireProfessional();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s, categories] = await Promise.all([getServiceForEdit(professionalId, id), listCategories()]);
  if (!s) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/workspace/services" className="inline-flex h-11 items-center text-sm font-bold text-forest">Back to services</Link>
      <PageHeader title="Edit service" />
      <ActionForm action={updateService} submitLabel="Save service"><input type="hidden" name="id" value={s.id} />
        <ServiceFields categories={categories} defaults={{ name: s.name, categoryId: s.category_id, subcategoryId: s.subcategory_id, description: s.description, inclusions: s.inclusions, exclusions: s.exclusions, pricingType: s.pricing_type, price: koboToNaira(s.price_minor), minimumCharge: koboToNaira(s.minimum_charge_minor), durationMinutes: s.duration_minutes, additionalCharges: s.additional_charges }} />
      </ActionForm>
    </div>
  );
}
