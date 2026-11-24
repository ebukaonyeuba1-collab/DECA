import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, error, className, id, ...props }, ref) {
  const auto = useId(); const fieldId = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-bold">{label}</label>
      <input ref={ref} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-err` : undefined}
        className={cn("h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base placeholder:text-ink-muted focus:border-forest-700", className)} {...props} />
      {error && <p id={`${fieldId}-err`} className="text-sm text-danger">{error}</p>}
    </div>
  );
});
