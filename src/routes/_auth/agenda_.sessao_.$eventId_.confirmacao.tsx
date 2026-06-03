import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useConfirmSession, useGetSessionRecord } from "@/services/therapist.service";
import type { SessionAttendance } from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/agenda/sessao/$eventId/confirmacao")({
  head: () => ({
    meta: [{ title: "Confirmar sessão — TEAmo" }],
  }),
  component: SessionConfirmPage,
});

function SessionConfirmPage() {
  const navigate = useNavigate();
  const { eventId } = Route.useParams();
  const confirm = useConfirmSession();
  const { data, isLoading } = useGetSessionRecord(eventId);

  const event = data?.event as any;
  const child = data?.child as any;

  const defaultDuration = event?.actual_duration_minutes ?? 60;
  const defaultStartTime = event?.start_at
    ? new Date(event.start_at).toTimeString().slice(0, 5)
    : "";

  const [attendance, setAttendance] = useState<SessionAttendance | null>(null);
  const [actualDuration, setActualDuration] = useState<string>(String(defaultDuration));
  const [actualStartTime, setActualStartTime] = useState<string>(defaultStartTime);
  const [absenceReason, setAbsenceReason] = useState("");
  const [notifyFamily, setNotifyFamily] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sessionDate = event?.start_at
    ? new Date(event.start_at).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  const sessionTime = event?.start_at
    ? new Date(event.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  const attendanceOptions: { value: SessionAttendance; label: string; color: string; bg: string }[] = [
    { value: "happened", label: "Aconteceu", color: TEAL, bg: TEAL_SOFT },
    { value: "missed_justified", label: "Falta justificada", color: "#D97706", bg: "#FEF3C7" },
    { value: "missed_no_show", label: "Falta sem aviso", color: "#DC2626", bg: "#FEF2F2" },
  ];

  const handleSubmit = async () => {
    if (!attendance) {
      toast.error("Selecione o status de comparecimento.");
      return;
    }

    setSubmitting(true);
    try {
      const happened = attendance === "happened";

      // Monta o actualStartAt como ISO se veio hora local
      let actualStartAt: string | undefined;
      if (happened && actualStartTime && event?.start_at) {
        const base = new Date(event.start_at);
        const [h, m] = actualStartTime.split(":");
        base.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        actualStartAt = base.toISOString();
      }

      const result = await confirm.mutateAsync({
        eventId,
        attendance,
        actualDurationMinutes: happened ? parseInt(actualDuration, 10) || undefined : undefined,
        actualStartAt,
        absenceReason: !happened ? absenceReason.trim() || undefined : undefined,
        notifyFamily: !happened ? notifyFamily : undefined,
      });

      if (result.happened) {
        navigate({ to: "/agenda/sessao/$eventId/registro" as any, params: { eventId } as any });
      } else {
        toast.success("Falta registrada.");
        navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao confirmar sessão.");
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell hideMenu onBack={() => navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any })}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin" color={TEAL} />
        </div>
      </AppShell>
    );
  }

  const happened = attendance === "happened";
  const isMissed = attendance === "missed_justified" || attendance === "missed_no_show";

  return (
    <AppShell hideMenu onBack={() => navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any })}>
      <div className="mx-auto max-w-[480px] px-4 py-6">
        {/* Header */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-8"
          style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1">
            Confirmação de sessão
          </p>
          <h1 className="text-[20px] font-extrabold text-[#0F172A]">
            {child?.name ?? event?.title ?? "Sessão"}
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {sessionDate}{sessionDate && sessionTime ? " · " : ""}{sessionTime}
          </p>
        </div>

        {/* Pergunta central */}
        <p className="text-[17px] font-bold text-[#0F172A] mb-4">A sessão aconteceu?</p>
        <div className="flex flex-col gap-2.5 mb-6">
          {attendanceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAttendance(opt.value)}
              className="flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all"
              style={
                attendance === opt.value
                  ? { borderColor: opt.color, background: opt.bg }
                  : { borderColor: "#E5E7EB", background: "white" }
              }
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full border-2 transition-colors"
                style={
                  attendance === opt.value
                    ? { borderColor: opt.color, background: opt.color }
                    : { borderColor: "#D1D5DB", background: "transparent" }
                }
              />
              <span
                className="text-[15px] font-semibold"
                style={{ color: attendance === opt.value ? opt.color : "#374151" }}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>

        {/* Campos extras — sessão aconteceu */}
        {happened && (
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Duração real (minutos)
              </label>
              <input
                type="number"
                min={1}
                max={480}
                value={actualDuration}
                onChange={(e) => setActualDuration(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Horário de início real{" "}
                <span className="text-[#9CA3AF] font-normal">(opcional)</span>
              </label>
              <input
                type="time"
                value={actualStartTime}
                onChange={(e) => setActualStartTime(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>
        )}

        {/* Campos extras — falta */}
        {isMissed && (
          <div className="flex flex-col gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Motivo da falta{" "}
                <span className="text-[#9CA3AF] font-normal">(opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Criança estava doente…"
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value.slice(0, 500))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            {/* Toggle notificar família */}
            <button
              type="button"
              onClick={() => setNotifyFamily((v) => !v)}
              className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
              style={
                notifyFamily
                  ? { borderColor: TEAL_BORDER, background: TEAL_SOFT }
                  : { borderColor: "#E5E7EB", background: "#FAFAFA" }
              }
            >
              <Bell size={16} strokeWidth={1.8} color={notifyFamily ? TEAL : "#9CA3AF"} />
              <span className="text-sm font-medium" style={{ color: notifyFamily ? TEAL : "#374151" }}>
                Notificar família sobre a falta
              </span>
              <span
                className="ml-auto h-5 w-9 rounded-full transition-colors flex items-center"
                style={{ background: notifyFamily ? TEAL : "#D1D5DB" }}
              >
                <span
                  className="h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: notifyFamily ? "translateX(18px)" : "translateX(2px)" }}
                />
              </span>
            </button>
          </div>
        )}

        {/* Botão de ação */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!attendance || submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl text-white text-[15px] font-bold transition-all hover:-translate-y-px disabled:opacity-50"
          style={{
            background: isMissed ? "#DC2626" : TEAL,
          }}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : happened ? (
            "Continuar para o registro"
          ) : isMissed ? (
            "Registrar falta"
          ) : (
            "Confirmar"
          )}
        </button>
      </div>
    </AppShell>
  );
}
