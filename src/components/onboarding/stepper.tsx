import Link from "next/link";
import { Check } from "lucide-react";
import type { StepState } from "@/lib/onboarding-steps";
import { cn } from "@/lib/utils";

export function Stepper({ steps, current }: { steps: StepState[]; current: string }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <nav aria-label="Onboarding progress">
      <p className="mb-3 text-sm font-semibold text-ink-muted">{done} of {steps.length} steps complete</p>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link href={`/workspace/onboarding/${s.key}`} aria-current={s.key === current ? "step" : undefined}
              className={cn("flex h-11 items-center gap-2 whitespace-nowrap rounded-control px-4 text-sm font-bold", s.key === current ? "bg-forest text-white" : s.done ? "bg-mint text-forest" : "bg-surface text-ink-muted ring-1 ring-line")}>
              {s.done ? <Check className="h-4 w-4" aria-label="Complete" /> : <span aria-hidden="true">{i + 1}</span>}{s.label}{!s.blocking && <span className="text-xs font-medium opacity-70">optional</span>}
            </Link>
          </li>))}
      </ol>
    </nav>
  );
}
