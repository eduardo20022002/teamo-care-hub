import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAdd: () => void;
}

export function EmptyProfessionals({ onAdd }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Users className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        Nenhum profissional cadastrado
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Cadastre os profissionais que acompanham a criança para organizar o
        cuidado em um só lugar.
      </p>
      <Button onClick={onAdd} className="mt-5">
        <Plus className="mr-1 h-4 w-4" strokeWidth={2} />
        Cadastrar primeiro profissional
      </Button>
    </div>
  );
}
