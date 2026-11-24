import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-forest text-white hover:bg-forest-700",
  secondary: "bg-surface text-forest ring-2 ring-inset ring-forest hover:bg-mint-50",
  ghost: "text-forest hover:bg-mint-100",
  danger: "bg-danger text-white hover:opacity-90",
} as const;
const sizes = { md: "h-12 px-6 text-base", sm: "h-10 px-4 text-sm" } as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; size?: keyof typeof sizes };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return <button ref={ref} className={cn("inline-flex items-center justify-center gap-2 rounded-control font-bold transition-colors duration-200 ease-deca disabled:cursor-not-allowed disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
});
