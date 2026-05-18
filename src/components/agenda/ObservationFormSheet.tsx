import { useEffect, useState, type FormEvent } from "react";
import { Bell, Calendar, ChevronDown, FileImage, Loader2, Mic, Paperclip, X } from "lucide-react";
import { agendaObservationSchema, type AgendaObservationInput } from "@/lib/agenda/validation";
import { ALERT_TONE, BRAND_GRADIENT, BRAND_SHADOW } from "@/lib/agenda/tokens";
import type { Professional } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AgendaObservationInput) => Promise<void> | void;
  submitting?: boolean;
  eventId: string;
  professionals: Professional[];
  /**
   * Profissional do próprio evento atual — vai para o topo da lista do
   * dropdown e é o default sugerido quando o reminder é ativado.
   */
  currentEventProfessional?: { id: string; name: string } | null;
  /**
   * Próximo evento daquele profissional (calculado fora — service) —
   * usado para sugerir o "Quando" do lembrete.
   */
  nextEventDateLabel?: string | null;
  nextEventDateISO?: string | null;
}

export function ObservationFormSheet({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  eventId,
  professionals,
  currentEventProfessional,
  nextEventDateLabel,
  nextEventDateISO,
}: Props) {
  const [text, setText] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [targetProfId, setTargetProfId] = useState<string>("");
  const [fireAt, setFireAt] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && currentEventProfessional?.id) {
      setTargetProfId(currentEventProfessional.id);
    }
    if (open && nextEventDateISO) {
      setFireAt(nextEventDateISO.slice(0, 10));
    }
  }, [open, currentEventProfessional, nextEventDateISO]);

  if (!open) return null;

  const orderedProfessionals = [...professionals].sort((a, b) => {
    if (a.id === currentEventProfessional?.id) return -1;
    if (b.id === currentEventProfessional?.id) return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = agendaObservationSchema.safeParse({
      event_id: eventId,
      text,
      reminder_enabled: reminderEnabled,
      reminder_target_professional_id: reminderEnabled && targetProfId ? targetProfId : null,
      reminder_fire_at: reminderEnabled && fireAt ? new Date(fireAt).toISOString() : null,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
    setText("");
    setReminderEnabled(false);
    setTargetProfId("");
    setFireAt("");
  };

  const handleClose = () => {
    if (submitting) return;
    setErrors({});
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={handleClose}
        className="absolute inset-0 cursor-default bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="obs-sheet-title"
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:max-w-md sm:rounded-3xl sm:shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />

        <div className="mb-1 flex items-start justify-between gap-3">
          <h2
            id="obs-sheet-title"
            className="text-[19px] font-extrabold tracking-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
          >
            Anotar observação
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[#9CA3AF] transition-colors hover:bg-[#E5E7EB] hover:text-[#6B7280] disabled:opacity-50"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <p
          className="mb-[18px] text-[13.5px] leading-snug"
          style={{ color: "#6B7280", maxWidth: 320 }}
        >
          Anote algo do compromisso. Você pode anexar mídia e marcar pra lembrar com outro profissional.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Anotação */}
          <label
            className="mb-1.5 block text-[12.5px] font-semibold"
            style={{ color: "#374151", letterSpacing: "-0.005em" }}
          >
            Anotação
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Algo importante sobre o compromisso…"
            rows={4}
            disabled={submitting}
            autoFocus
            maxLength={5000}
            className={`min-h-[112px] w-full resize-y rounded-xl border bg-[#F6F7FB] px-3.5 py-3 text-[14px] leading-relaxed outline-none transition-all ${
              errors.text
                ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
            } disabled:opacity-60`}
            style={{ color: "#0F172A" }}
          />
          {errors.text && (
            <p className="mt-1 text-xs text-red-500">{errors.text}</p>
          )}

          {/* Anexos (preview UI only — upload na fase de attachments) */}
          <label
            className="mb-1.5 mt-3.5 block text-[12.5px] font-semibold"
            style={{ color: "#374151", letterSpacing: "-0.005em" }}
          >
            Anexos{" "}
            <span style={{ color: "#9CA3AF", fontWeight: 500 }}>(opcional)</span>
          </label>
          <div className="flex gap-2">
            <AttachButton icon={<FileImage size={16} strokeWidth={1.7} color="#7C3AED" />}>
              Foto
            </AttachButton>
            <AttachButton icon={<Mic size={16} strokeWidth={1.7} color="#EC4899" />}>
              Áudio
            </AttachButton>
            <AttachButton icon={<Paperclip size={16} strokeWidth={1.7} color="#6B7280" />}>
              Arquivo
            </AttachButton>
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: "#9CA3AF" }}>
            Upload de anexos chega em breve. Por ora você pode salvar a observação por texto.
          </p>

          {/* Bloco laranja "Lembrar de mencionar" */}
          <div
            className="mt-4 rounded-xl border p-3.5"
            style={{
              background: ALERT_TONE.background,
              borderColor: ALERT_TONE.border,
            }}
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <Bell size={18} strokeWidth={1.7} color={ALERT_TONE.bodyColor} />
              <div className="min-w-0 flex-1">
                <div
                  className="text-[13.5px] font-extrabold"
                  style={{ color: ALERT_TONE.titleColor, letterSpacing: "-0.005em" }}
                >
                  Lembrar de mencionar
                </div>
                <div className="text-[11.5px]" style={{ color: ALERT_TONE.bodyColor }}>
                  Te avisamos no dia certo, na hora certa.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reminderEnabled}
                onClick={() => setReminderEnabled((v) => !v)}
                className="relative h-6 w-10 flex-shrink-0 rounded-full transition-colors"
                style={{
                  background: reminderEnabled ? ALERT_TONE.ctaColor : "#E5E7EB",
                }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.2)] transition-all"
                  style={{ left: reminderEnabled ? 18 : 2 }}
                />
              </button>
            </div>

            {reminderEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div
                    className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em]"
                    style={{ color: ALERT_TONE.bodyColor }}
                  >
                    Para quem
                  </div>
                  <div className="relative">
                    <select
                      value={targetProfId}
                      onChange={(e) => setTargetProfId(e.target.value)}
                      disabled={submitting}
                      className="h-[38px] w-full appearance-none rounded-[10px] border bg-white px-3 pr-9 text-[13px] font-semibold outline-none"
                      style={{
                        borderColor: ALERT_TONE.border,
                        color: targetProfId ? "#0F172A" : "#9CA3AF",
                      }}
                    >
                      <option value="">Escolher profissional</option>
                      {orderedProfessionals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                      color={ALERT_TONE.bodyColor}
                    />
                  </div>
                </div>
                <div>
                  <div
                    className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em]"
                    style={{ color: ALERT_TONE.bodyColor }}
                  >
                    Quando
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      value={fireAt}
                      onChange={(e) => setFireAt(e.target.value)}
                      disabled={submitting}
                      className="h-[38px] w-full rounded-[10px] border bg-white px-3 pr-9 text-[13px] font-semibold outline-none"
                      style={{
                        borderColor: ALERT_TONE.border,
                        color: "#0F172A",
                        colorScheme: "light",
                      }}
                    />
                    <Calendar
                      size={14}
                      strokeWidth={1.6}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                      color={ALERT_TONE.bodyColor}
                    />
                  </div>
                  {nextEventDateLabel && (
                    <div
                      className="mt-1 text-[11px]"
                      style={{ color: ALERT_TONE.bodyColor }}
                    >
                      Próxima consulta · {nextEventDateLabel}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: BRAND_SHADOW,
              letterSpacing: "-0.005em",
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar observação
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151] disabled:opacity-50"
            style={{ color: "#6B7280" }}
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}

function AttachButton({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border bg-white text-[12.5px] font-bold opacity-60"
      style={{ borderColor: "#E5E7EB", color: "#374151", cursor: "not-allowed" }}
      title="Em breve"
    >
      {icon}
      {children}
    </button>
  );
}
