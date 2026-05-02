import { Search, SearchX } from "lucide-react";

interface Props {
  state: "initial" | "no-results";
  query?: string;
}

export function EmptySearch({ state, query }: Props) {
  if (state === "initial") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Search className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-medium text-foreground">
          Comece a digitar para buscar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Você pode buscar por trechos de registros, nomes de profissionais,
          especialidades ou nomes de documentos.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-foreground">
        Nenhum resultado encontrado{query ? ` para "${query}"` : ""}.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Tente outros termos ou ajuste os filtros.
      </p>
    </div>
  );
}
