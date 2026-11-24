import { z } from "zod";

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  // Only these two roles can be chosen by a visitor. Admin roles are granted by a super admin.
  role: z.enum(["customer", "professional"]),
});
export type RegisterInput = z.infer<typeof registerSchema>;
