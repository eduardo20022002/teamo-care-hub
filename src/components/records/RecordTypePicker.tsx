import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  RECORD_TYPES,
  RECORD_TYPE_CONFIG,
  type RecordType,
} from "@/lib/validation";
import { RECORD_TYPE_ICONS } from "./RecordTypeChip";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: RecordType) => void;
}

export function RecordTypePicker({ open, onOpenChange, onSelect }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[24px] px-0 pb-0 pt-0"
      >
        <SheetTitle className="sr-only">Selecionar tipo de registro</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header — o X de fechar é o padrão do SheetContent (canto superior direito) */}
        <div className="px-5 pb-4 pt-3 pr-12">
          <h2 className="text-[17px] font-bold text-foreground">
            O que você quer registrar?
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Escolha o tipo — assim a gente organiza os campos certos pra você.
          </p>
        </div>

        <div className="h-px bg-[#EEF0F4]" />

        {/* Type grid */}
        <div className="grid grid-cols-2 gap-3 px-5 py-5">
          {RECORD_TYPES.map((type) => {
            const cfg = RECORD_TYPE_CONFIG[type];
            const Icon = RECORD_TYPE_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onSelect(type);
                }}
                className="flex flex-col gap-2 rounded-[14px] border border-[#EEF0F4] bg-white p-4 text-left shadow-sm active:opacity-75 hover:border-[#D1D5DB] transition-colors"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-[12px]"
                  style={{ background: cfg.tint }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: cfg.color }}
                    strokeWidth={1.75}
                  />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-foreground leading-snug">
                    {cfg.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {cfg.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cancel */}
        <div className="px-5 pb-8 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-sm text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
