import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATTENDANCE_CATEGORIES,
  ATTENDANCE_CATEGORY_LABELS,
  type AttendanceCategoryValue,
} from "@/lib/validation";
import type { Child } from "@/types/database";
import type { SearchKind } from "@/services/search.service";

export type KindFilter = "all" | SearchKind;
export type CategoryFilter = "all" | AttendanceCategoryValue;

export interface SearchFiltersValue {
  childId: string; // "all" | id
  kind: KindFilter;
  category: CategoryFilter;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_SEARCH_FILTERS: SearchFiltersValue = {
  childId: "all",
  kind: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export function isSearchFiltersActive(v: SearchFiltersValue): boolean {
  return (
    v.childId !== "all" ||
    v.kind !== "all" ||
    v.category !== "all" ||
    v.dateFrom !== "" ||
    v.dateTo !== ""
  );
}

interface Props {
  value: SearchFiltersValue;
  onChange: (v: SearchFiltersValue) => void;
  childrenList: Child[];
}

export function SearchFilters({ value, onChange, childrenList }: Props) {
  const update = (patch: Partial<SearchFiltersValue>) =>
    onChange({ ...value, ...patch });

  // Categoria só faz sentido se "Tipo" inclui registros
  const categoryEnabled = value.kind === "all" || value.kind === "record";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de conteúdo</Label>
          <Select
            value={value.kind}
            onValueChange={(v) => update({ kind: v as KindFilter })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="record">Registros</SelectItem>
              <SelectItem value="document">Documentos</SelectItem>
              <SelectItem value="professional">Profissionais</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Categoria de atendimento
            {!categoryEnabled && (
              <span className="ml-1 text-muted-foreground">(só para registros)</span>
            )}
          </Label>
          <Select
            value={value.category}
            disabled={!categoryEnabled}
            onValueChange={(v) =>
              update({ category: v as CategoryFilter })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {ATTENDANCE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {ATTENDANCE_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {childrenList.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Criança</Label>
            <Select
              value={value.childId}
              onValueChange={(v) => update({ childId: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as crianças</SelectItem>
                {childrenList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="search-date-from" className="text-xs">
            De
          </Label>
          <Input
            id="search-date-from"
            type="date"
            value={value.dateFrom}
            max={value.dateTo || undefined}
            onChange={(e) => update({ dateFrom: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="search-date-to" className="text-xs">
            Até
          </Label>
          <Input
            id="search-date-to"
            type="date"
            value={value.dateTo}
            min={value.dateFrom || undefined}
            onChange={(e) => update({ dateTo: e.target.value })}
          />
        </div>

        <div className="flex items-end">
          {isSearchFiltersActive(value) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(EMPTY_SEARCH_FILTERS)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-4 w-4" strokeWidth={1.75} />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
