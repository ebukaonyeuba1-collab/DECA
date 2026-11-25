"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/server/auth/actions";

/** Wraps server-rendered inputs with pending state and error/notice display. */
export function ActionForm({ action, submitLabel, children, className, secondary }: {
  action: (prev: FormState, form: FormData) => Promise<FormState>; submitLabel: string; children: React.ReactNode; className?: string; secondary?: boolean;
}) {
  const [state, run, pending] = useActionState(action, {} as FormState);
  return (
    <form action={run} className={className ?? "space-y-4"} noValidate={false}>
      {children}
      {state.error && <p role="alert" className="text-sm font-semibold text-danger">{state.error}</p>}
      {state.notice && <p role="status" className="text-sm font-semibold text-success">{state.notice}</p>}
      <Button type="submit" variant={secondary ? "secondary" : "primary"} disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
