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

export interface PanelFiltersValue {
  childId: string; // "all" | id
  professionalId: string; // "all" | "none" | id
  category: "all" | AttendanceCategoryValue;
  dateFrom: string; // ""
  dateTo: string; // ""
}

export const EMPTY_PANEL_FILTERS: PanelFiltersValue = {
  childId: "all",
  professionalId: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export function isPanelFiltersActive(v: PanelFiltersValue): boolean {
  return (
    v.childId !== "all" ||
    v.professionalId !== "all" ||
    v.category !== "all" ||
    v.dateFrom !== "" ||
    v.dateTo !== ""
  );
}

interface Props {
  value: PanelFiltersValue;
  onChange: (v: PanelFiltersValue) => void;
  childrenList: Child[];
  professionals: Professional[];
}

export function PanelFilters({ value, onChange, childrenList, professionals }: Props) {
  const update = (patch: Partial<PanelFiltersValue>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <SelectItem value="none">Não cadastrado</SelectItem>
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
            onValueChange={(v) => update({ category: v as PanelFiltersValue["category"] })}
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
          <Label htmlFor="panel-date-from" className="text-xs">
            De
          </Label>
          <Input
            id="panel-date-from"
            type="date"
            value={value.dateFrom}
            max={value.dateTo || undefined}
            onChange={(e) => update({ dateFrom: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="panel-date-to" className="text-xs">
            Até
          </Label>
          <Input
            id="panel-date-to"
            type="date"
            value={value.dateTo}
            min={value.dateFrom || undefined}
            onChange={(e) => update({ dateTo: e.target.value })}
          />
        </div>

        <div className="flex items-end">
          {isPanelFiltersActive(value) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(EMPTY_PANEL_FILTERS)}
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
