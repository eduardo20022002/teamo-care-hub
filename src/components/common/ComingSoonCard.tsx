import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoonCard({ icon: Icon, title, description }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Badge
        variant="outline"
        className="mt-3 rounded-full border-border bg-background font-normal text-muted-foreground"
      >
        Em breve
      </Badge>
    </div>
  );
}
