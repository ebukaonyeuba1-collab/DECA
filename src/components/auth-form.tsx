"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp, type FormState } from "@/server/auth/actions";

const initial: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <p className="text-center text-sm text-ink-muted">New to DECA? <Link className="font-bold text-forest" href="/register">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, initial);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1.5 text-sm font-bold">I want to</legend>
        {[["customer", "Hire a professional"], ["professional", "Offer my services"]].map(([v, l], i) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3 text-sm font-bold has-[:checked]:border-forest">
            <input type="radio" name="role" value={v} defaultChecked={i === 0} className="accent-forest" />{l}
          </label>
        ))}
      </fieldset>
      <Input label="Full name" name="fullName" autoComplete="name" required />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input label="Phone number" name="phone" type="tel" autoComplete="tel" placeholder="+234…" required />
      <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.notice && <p role="status" className="text-sm text-success">{state.notice}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm text-ink-muted">Already registered? <Link className="font-bold text-forest" href="/login">Sign in</Link></p>
    </form>
  );
}
