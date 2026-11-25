"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationSelect } from "@/components/onboarding/location-select";
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/server/auth/actions";
import type { LocationOption } from "@/server/discovery/types";

const initial: FormState = {};
const Status = ({ s }: { s: FormState }) => <>{s.error && <p role="alert" className="text-sm font-semibold text-danger">{s.error}</p>}{s.notice && <p role="status" className="text-sm font-semibold text-success">{s.notice}</p>}</>;

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      <Status s={state} />
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <p className="text-center text-sm"><Link className="font-bold text-forest" href="/forgot-password">Forgot your password?</Link></p>
      <p className="text-center text-sm text-ink-muted">New to DECA? <Link className="font-bold text-forest" href="/register">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm({ states }: { states: LocationOption[] }) {
  const [state, action, pending] = useActionState(signUp, initial);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <div role="status" className="rounded-card bg-mint-50 p-6 ring-1 ring-line"><h2 className="text-lg font-extrabold">Check your email</h2><p className="mt-2 text-sm text-ink-muted">{state.notice} The link may take a few minutes to arrive. Check your spam folder too.</p><Link href="/login" className="mt-4 inline-block font-bold text-forest">Go to sign in</Link></div>;
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1.5 text-sm font-bold">I want to</legend>
        {[["customer", "Hire a professional"], ["professional", "Offer my services"]].map(([v, l], i) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3 text-sm font-bold has-[:checked]:border-forest"><input type="radio" name="role" value={v} defaultChecked={i === 0} className="accent-forest" />{l}</label>
        ))}
      </fieldset>
      <Input label="Full name" name="fullName" autoComplete="name" required error={fe.fullName} />
      <Input label="Email" name="email" type="email" autoComplete="email" required error={fe.email} />
      <Input label="Phone number" name="phone" type="tel" autoComplete="tel" placeholder="+2348012345678" required error={fe.phone} />
      <LocationSelect states={states} name="locationId" label="Where are you based?" required />
      {fe.locationId && <p className="text-sm text-danger">{fe.locationId}</p>}
      <Input label="Password (at least 10 characters)" name="password" type="password" autoComplete="new-password" minLength={10} required error={fe.password} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="privacyConsent" required className="mt-1 h-5 w-5 accent-forest" /><span>I have read and accept the <Link href="/legal/privacy_policy" target="_blank" className="font-bold text-forest underline">privacy policy</Link>.</span></label>
      {fe.privacyConsent && <p className="text-sm text-danger">{fe.privacyConsent}</p>}
      <label className="flex items-start gap-2 text-sm text-ink-muted"><input type="checkbox" name="marketingConsent" className="mt-1 h-5 w-5 accent-forest" /><span>Send me tips and offers (optional).</span></label>
      <Status s={state} />
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm text-ink-muted">Already registered? <Link className="font-bold text-forest" href="/login">Sign in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <Status s={state} />
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      <p className="text-center text-sm"><Link className="font-bold text-forest" href="/login">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="space-y-4">
      <Input label="New password (at least 10 characters)" name="password" type="password" autoComplete="new-password" minLength={10} required error={state.fieldErrors?.password} />
      <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <Status s={state} />
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Set new password"}</Button>
    </form>
  );
}
