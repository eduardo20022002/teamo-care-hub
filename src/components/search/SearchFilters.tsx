import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Child } from "@/types/database";
import type { SearchKind } from "@/services/search.service";

export type KindFilter = "all" | SearchKind;

interface Props {
  childrenList: Child[];
  childFilter: string;
  onChildChange: (v: string) => void;
  kindFilter: KindFilter;
  onKindChange: (v: KindFilter) => void;
}

export function SearchFilters({
  childrenList,
  childFilter,
  onChildChange,
  kindFilter,
  onKindChange,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {childrenList.length > 1 && (
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
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de conteúdo</Label>
        <Select
          value={kindFilter}
          onValueChange={(v) => onKindChange(v as KindFilter)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="record">Registros</SelectItem>
            <SelectItem value="professional">Profissionais</SelectItem>
            <SelectItem value="document">Documentos</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
