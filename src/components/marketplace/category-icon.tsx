import { BrickWall, Briefcase, Bug, Car, Droplet, Hammer, Laptop, LayoutGrid, Paintbrush, Scissors, Shirt, Sofa, Sparkles, Trees, Truck, Wind, Wrench, Zap, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  droplet: Droplet, zap: Zap, sparkles: Sparkles, wind: Wind, hammer: Hammer, paintbrush: Paintbrush, "layout-grid": LayoutGrid,
  "brick-wall": BrickWall, sofa: Sofa, wrench: Wrench, trees: Trees, truck: Truck, bug: Bug, shirt: Shirt, scissors: Scissors, car: Car, laptop: Laptop, briefcase: Briefcase,
};
export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Briefcase;
  return <Icon className={className} aria-hidden="true" />;
}
