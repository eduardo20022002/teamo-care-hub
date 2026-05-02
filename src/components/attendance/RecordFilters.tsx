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
import type { Child, Professional } from "@/types/database";

export interface RecordFiltersValue {
  childId: string; // "all" | id
  professionalId: string; // "all" | "none" | id
  category: "all" | AttendanceCategoryValue;
  dateFrom: string; // "" ou YYYY-MM-DD
  dateTo: string; // "" ou YYYY-MM-DD
}

export const EMPTY_RECORD_FILTERS: RecordFiltersValue = {
  childId: "all",
  professionalId: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export function isRecordFiltersActive(v: RecordFiltersValue): boolean {
  return (
    v.childId !== "all" ||
    v.professionalId !== "all" ||
    v.category !== "all" ||
    v.dateFrom !== "" ||
    v.dateTo !== ""
  );
}

interface Props {
  value: RecordFiltersValue;
  onChange: (v: RecordFiltersValue) => void;
  childrenList: Child[];
  professionals: Professional[];
  /** Quando true (padrão), exibe sempre o filtro de criança. Quando false, oculta se houver ≤ 1 criança. */
  alwaysShowChild?: boolean;
}

export function RecordFilters({
  value,
  onChange,
  childrenList,
  professionals,
  alwaysShowChild = true,
}: Props) {
  const update = (patch: Partial<RecordFiltersValue>) =>
    onChange({ ...value, ...patch });

  const showChild = alwaysShowChild || childrenList.length > 1;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {showChild && (
          <div className="space-y-1.5">
            <Label className="text-xs">Criança</Label>
            <Select value={value.childId} onValueChange={(v) => update({ childId: v })}>
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
          <Label className="text-xs">Profissional</Label>
          <Select
            value={value.professionalId}
            onValueChange={(v) => update({ professionalId: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              <SelectItem value="none">Sem profissional vinculado</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Categoria</Label>
          <Select
            value={value.category}
            onValueChange={(v) =>
              update({ category: v as RecordFiltersValue["category"] })
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

        <div className="space-y-1.5">
          <Label htmlFor="record-date-from" className="text-xs">
            De
          </Label>
          <Input
            id="record-date-from"
            type="date"
            value={value.dateFrom}
            max={value.dateTo || undefined}
            onChange={(e) => update({ dateFrom: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="record-date-to" className="text-xs">
            Até
          </Label>
          <Input
            id="record-date-to"
            type="date"
            value={value.dateTo}
            min={value.dateFrom || undefined}
            onChange={(e) => update({ dateTo: e.target.value })}
          />
        </div>

        <div className="flex items-end">
          {isRecordFiltersActive(value) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(EMPTY_RECORD_FILTERS)}
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
