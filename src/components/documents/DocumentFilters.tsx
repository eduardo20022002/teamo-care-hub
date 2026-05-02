import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Child } from "@/types/database";

export type SourceFilter = "all" | "child" | "record";
export type TypeFilter = "all" | "pdf" | "image";
export type PeriodFilter = "all" | "7d" | "30d" | "year";

interface Props {
  childrenList: Child[];
  childFilter: string;
  onChildChange: (v: string) => void;
  sourceFilter: SourceFilter;
  onSourceChange: (v: SourceFilter) => void;
  typeFilter: TypeFilter;
  onTypeChange: (v: TypeFilter) => void;
  periodFilter: PeriodFilter;
  onPeriodChange: (v: PeriodFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function DocumentFilters({
  childrenList,
  childFilter,
  onChildChange,
  sourceFilter,
  onSourceChange,
  typeFilter,
  onTypeChange,
  periodFilter,
  onPeriodChange,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="doc-search" className="text-xs">
          Buscar por nome
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            id="doc-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Ex.: laudo, relatório..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Criança</Label>
          <Select value={childFilter} onValueChange={onChildChange}>
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
          <Label className="text-xs">Origem</Label>
          <Select
            value={sourceFilter}
            onValueChange={(v) => onSourceChange(v as SourceFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="child">Documento da criança</SelectItem>
              <SelectItem value="record">Anexo de registro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={typeFilter}
            onValueChange={(v) => onTypeChange(v as TypeFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="image">Imagens</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Período</Label>
          <Select
            value={periodFilter}
            onValueChange={(v) => onPeriodChange(v as PeriodFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer data</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
