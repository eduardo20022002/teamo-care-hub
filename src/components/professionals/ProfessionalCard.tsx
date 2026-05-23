import { useNavigate } from "@tanstack/react-router";
import { Mail, Pencil, Phone, Trash2 } from "lucide-react";
import type { Professional } from "@/types/database";
import { getInitial } from "@/lib/formatters";

const AVATAR_GRADIENT = "linear-gradient(135deg, #DDE3FF 0%, #FBD9EC 100%)";

interface Props {
  professional: Professional;
  onEdit: (p: Professional) => void;
  onDelete: (p: Professional) => void;
}

export function ProfessionalCard({ professional, onEdit, onDelete }: Props) {
  const navigate = useNavigate();
  const openDetail = () =>
    navigate({
      to: "/profissionais/$professionalId",
      params: { professionalId: professional.id },
    });

  return (
    <div className="flex flex-col rounded-[16px] border border-[#EEF0F4] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={openDetail}
        className="flex items-center gap-3 text-left"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#4F46E5]"
          style={{ background: AVATAR_GRADIENT }}
        >
          {getInitial(professional.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {professional.name}
          </p>
          <p className="truncate text-xs font-medium" style={{ color: "#4F46E5" }}>
            {professional.specialty}
          </p>
        </div>
      </button>

      <div className="mt-3 space-y-1.5 border-t border-[#EEF0F4] pt-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{professional.email}</span>
        </p>
        {professional.phone && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{professional.phone}</span>
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(professional)}
          aria-label={`Editar ${professional.name}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#EEF0F4] bg-[#F6F7FB] py-2 text-xs font-semibold text-foreground transition-colors hover:bg-[#EEF1FF] hover:text-[#4F46E5]"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
          Editar
        </button>
        <button
          type="button"
          onClick={() => onDelete(professional)}
          aria-label={`Excluir ${professional.name}`}
          className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[#EEF0F4] bg-[#F6F7FB] px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-200"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
