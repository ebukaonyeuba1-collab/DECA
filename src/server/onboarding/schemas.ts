import { z } from "zod";
import { nairaToKobo } from "@/lib/naira";

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (max: number) => z.preprocess(empty, z.string().trim().max(max, `Keep this under ${max} characters`).optional());
const optUuid = z.preprocess(empty, z.string().uuid().optional());
const optInt = (min: number, max: number) => z.preprocess(empty, z.coerce.number().int().min(min).max(max).optional());
const uuid = (msg: string) => z.string().uuid(msg);
const phone = z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number, for example +2348012345678");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").refine((d) => !Number.isNaN(Date.parse(d)), "Enter a valid date");

export const professionalProfileSchema = z.object({
  accountType: z.enum(["individual", "business"]),
  fullName: z.string().trim().min(2, "Enter your full legal name").max(120),
  phone,
  locationId: optUuid,
  displayName: z.string().trim().min(2, "Enter the name customers will see").max(80),
  headline: optText(120), bio: optText(2000),
  yearsExperience: z.coerce.number({ invalid_type_error: "Enter years of experience" }).int().min(0).max(80),
  primaryCategoryId: uuid("Choose your main service category"),
});
export const businessSchema = z.object({
  registeredName: z.string().trim().min(2, "Enter the registered business name").max(120),
  registrationNumber: optText(40), description: optText(1000), addressLine: optText(200),
  email: z.preprocess(empty, z.string().trim().email("Enter a valid business email").optional()),
  phone: z.preprocess(empty, phone.optional()),
  yearEstablished: optInt(1900, new Date().getFullYear()),
  website: z.preprocess(empty, z.string().trim().url("Enter a full website address starting with https://").max(200).refine((u) => /^https?:\/\//i.test(u), "Website must start with http:// or https://").optional()),
});
const PRICED = ["fixed", "starting", "hourly", "daily"] as const;
export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Name the service").max(100),
  categoryId: uuid("Choose a category"), subcategoryId: optUuid,
  description: optText(1000), inclusions: optText(500), exclusions: optText(500), additionalCharges: optText(300),
  pricingType: z.enum(["fixed", "starting", "hourly", "daily", "per_project", "inspection_based"]),
  price: optText(20), minimumCharge: optText(20), durationMinutes: optInt(5, 1440),
}).superRefine((v, ctx) => {
  if ((PRICED as readonly string[]).includes(v.pricingType) && nairaToKobo(v.price) === null) ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price in naira, for example 8500" });
  if (v.price && nairaToKobo(v.price) === null) ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a valid amount in naira" });
  if (v.minimumCharge && nairaToKobo(v.minimumCharge) === null) ctx.addIssue({ code: "custom", path: ["minimumCharge"], message: "Enter a valid amount in naira" });
});
export const coverageSchema = z.object({ locationId: uuid("Choose where you work"), travel: z.literal("on").optional(), remote: z.literal("on").optional() });
export const dayOffSchema = z.object({ startsOn: date, endsOn: date, reason: optText(100) }).refine((v) => v.endsOn >= v.startsOn, { message: "The end date cannot be before the start", path: ["endsOn"] });
export const portfolioItemSchema = z.object({
  title: z.string().trim().min(2, "Give the project a title").max(100), description: optText(500),
  completedOn: z.preprocess(empty, date.optional()), categoryId: optUuid,
}).refine((v) => !v.completedOn || v.completedOn <= new Date().toISOString().slice(0, 10), { message: "Completion date cannot be in the future", path: ["completedOn"] });
export const customerProfileSchema = z.object({ fullName: z.string().trim().min(2, "Enter your full name").max(120), phone, locationId: optUuid });
export const documentRecordSchema = z.object({
  requirementId: optUuid, fileName: z.string().trim().min(1).max(200), mime: z.string().max(100), size: z.number().int().positive(),
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export type WeeklySlot = { weekday: number; start: string; end: string };
export function parseAvailability(form: FormData): { slots: WeeklySlot[] } | { error: string } {
  const slots: WeeklySlot[] = [];
  for (let d = 0; d < 7; d++) {
    if (form.get(`d${d}_on`) !== "on") continue;
    const start = String(form.get(`d${d}_start`) ?? ""), end = String(form.get(`d${d}_end`) ?? "");
    if (!TIME.test(start) || !TIME.test(end)) return { error: "Enter valid opening and closing times." };
    if (end <= start) return { error: "Closing time must be after opening time." };
    slots.push({ weekday: d, start, end });
  }
  return { slots };
}
