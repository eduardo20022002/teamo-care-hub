import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

export function GlobalSearchCard() {
  return (
    <Link
      to="/busca"
      aria-label="Buscar no histórico"
      className="group block rounded-xl border border-primary/30 bg-primary-soft/60 p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-primary-soft"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Search className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Buscar no histórico
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Encontre registros, profissionais e documentos rapidamente.
          </p>
        </div>
      </div>
    </Link>
  );
}
