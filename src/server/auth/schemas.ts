import { z } from "zod";

const password = z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer");
const phone = z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number, for example +2348012345678");

export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone,
  password,
  // Only these two roles can be chosen by a visitor. Admin roles are granted by a super admin.
  role: z.enum(["customer", "professional"]),
  locationId: z.string().uuid("Choose your state").optional().or(z.literal("").transform(() => undefined)),
  privacyConsent: z.literal("on", { errorMap: () => ({ message: "You must accept the privacy policy to create an account" }) }),
  marketingConsent: z.literal("on").optional(),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") });
export const resetSchema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });
export type RegisterInput = z.infer<typeof registerSchema>;
