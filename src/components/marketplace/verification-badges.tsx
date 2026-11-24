import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function VerificationBadges({ identity, credentials, experience }: { identity: boolean; credentials: boolean; experience: boolean }) {
  const items = [[identity, "Identity verified"], [credentials, "Credentials verified"], [experience, "Experience verified"]] as const;
  const shown = items.filter(([on]) => on);
  if (shown.length === 0) return null;
  return <ul className="flex flex-wrap gap-1.5">{shown.map(([, label]) => <li key={label}><Badge tone="success"><ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{label}</Badge></li>)}</ul>;
}
