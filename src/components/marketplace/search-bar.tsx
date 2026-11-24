import { Search } from "lucide-react";

export function SearchBar({ defaultValue, large }: { defaultValue?: string; large?: boolean }) {
  return (
    <form action="/explore" role="search" className={`flex items-center gap-2 rounded-control bg-surface p-1.5 shadow-soft ${large ? "max-w-xl" : ""}`}>
      <Search className="ml-3 h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
      <input name="q" defaultValue={defaultValue} maxLength={80} aria-label="Find a professional or service" placeholder="Find a professional or service…" className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none" />
      <button className="h-11 rounded-control bg-forest px-5 font-bold text-white hover:bg-forest-700">Search</button>
    </form>
  );
}
