import { initials, publicMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function Avatar({ name, path, className }: { name: string; path: string | null; className?: string }) {
  const url = publicMediaUrl(path);
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" width={96} height={96} loading="lazy" className={cn("rounded-full object-cover", className)} />
    : <span aria-hidden="true" className={cn("grid place-items-center rounded-full bg-gradient-to-br from-forest to-forest-700 font-extrabold text-white", className)}>{initials(name)}</span>;
}
