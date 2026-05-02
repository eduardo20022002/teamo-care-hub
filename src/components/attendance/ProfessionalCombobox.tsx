import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Professional } from "@/types/database";

export interface ProfessionalSelection {
  professional_id: string | null;
  professional_name: string;
}

interface Props {
  id?: string;
  value: ProfessionalSelection;
  onChange: (value: ProfessionalSelection) => void;
  professionals: Professional[];
  disabled?: boolean;
}

export function ProfessionalCombobox({
  id,
  value,
  onChange,
  professionals,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return professionals;
    return professionals.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.specialty.toLowerCase().includes(q),
    );
  }, [professionals, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return professionals.some((p) => p.name.toLowerCase() === q);
  }, [professionals, query]);

  const display = value.professional_name || "Selecionar ou digitar nome";
  const isUnregistered = !!value.professional_name && !value.professional_id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn(
              "truncate",
              !value.professional_name && "text-muted-foreground",
            )}
          >
            {display}
            {isUnregistered && (
              <span className="ml-2 text-xs text-muted-foreground">
                (não cadastrado)
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou digitar nome..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 && exactMatch && (
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Cadastrados">
                {filtered.map((p) => {
                  const selected = value.professional_id === p.id;
                  return (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onChange({
                          professional_id: p.id,
                          professional_name: p.name,
                        });
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.specialty}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {query.trim() && !exactMatch && (
              <CommandGroup heading="Não cadastrado">
                <CommandItem
                  value={`__custom__${query}`}
                  onSelect={() => {
                    onChange({
                      professional_id: null,
                      professional_name: query.trim(),
                    });
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Usar este nome: <strong className="ml-1">{query.trim()}</strong>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
