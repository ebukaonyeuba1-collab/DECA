import { ForgotForm } from "@/components/auth-form";
export const metadata = { title: "Reset your password" };
export default function Page() {
  return <main className="mx-auto max-w-md px-6 py-16"><h1 className="text-3xl font-extrabold">Reset your password</h1><p className="mt-2 text-sm text-ink-muted">Enter your email and we will send you a link.</p><div className="mt-8"><ForgotForm /></div></main>;
}
