import { cn } from "@/lib/utils";
const tones = { neutral: "bg-mint-100 text-forest", success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", danger: "bg-danger/15 text-danger" } as const;
export function Badge({ tone = "neutral", className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-control px-3 py-1 text-xs font-bold", tones[tone], className)}>{children}</span>;
}
