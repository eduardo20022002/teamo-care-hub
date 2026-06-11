import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  CalendarX,
  RotateCcw,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCommunicationByTokenServer,
  confirmCommunicationServer,
} from "@/lib/clinic-communication.functions";
import type {
  CommType,
  CommPayloadCancelamento,
  CommPayloadReposicao,
  CommPayloadAutorizacao,
  CommPayloadRenovacao,
} from "@/types/clinic-communication";

export const Route = createFileRoute("/confirmacao-clinica/$token")({
  head: () => ({
    meta: [
      { title: "Confirmação — TEAmo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConfirmacaoClinicaPage,
});

// ─── Layout shell mobile-first ───────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col">
      <div className="h-14 flex items-center justify-center"
        style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)" }}>
        <span className="text-white font-bold text-xl tracking-tight">
          <span className="text-white">TEA</span>
          <span style={{ color: "#FDE68A" }}>mo</span>
          <span className="ml-2 text-xs font-normal text-indigo-200 uppercase tracking-widest">CLÍNICA</span>
        </span>
      </div>
      <div className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right ml-4">{value}</span>
    </div>
  );
}

// ─── Variantes visuais ───────────────────────────────────────────────────────

function VariantCancelamento({
  payload,
  onConfirm,
  loading,
}: {
  payload: CommPayloadCancelamento;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
          <CalendarX size={28} color="#EF4444" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 text-center">Sessão cancelada</h1>
        <p className="text-sm text-gray-500 text-center mt-1">
          Informamos o cancelamento da sessão abaixo.
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-0.5">
        {payload.patient_name && <InfoRow label="Paciente" value={payload.patient_name} />}
        {payload.session_date && <InfoRow label="Data" value={formatDateBR(payload.session_date)} />}
        {payload.start_time && <InfoRow label="Horário" value={formatTime(payload.start_time)} />}
        {payload.therapist_name && <InfoRow label="Terapeuta" value={payload.therapist_name} />}
      </div>

      <p className="text-xs text-indigo-600 text-center mb-4 leading-relaxed">
        Uma reposição será agendada em breve. Você receberá uma nova mensagem com as opções de horário disponíveis.
      </p>

      <Button
        onClick={onConfirm}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 text-sm font-semibold"
      >
        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
        Confirmar ciência
      </Button>
    </div>
  );
}

function VariantAutorizacao({
  payload,
  onConfirm,
  loading,
}: {
  payload: CommPayloadAutorizacao;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 rounded-full bg-yellow-50 flex items-center justify-center mb-3">
          <ShieldAlert size={28} color="#D97706" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 text-center">Autorização vencendo</h1>
        {payload.insurance_plan && (
          <p className="text-sm text-gray-500 text-center mt-1">
            {payload.insurance_plan}
            {payload.valid_until ? ` · vence em ${payload.days_until_expiry} dias (${formatDateBR(payload.valid_until)})` : ""}
          </p>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
        <p className="text-xs font-semibold text-yellow-800 mb-2">Próximos passos:</p>
        <ol className="space-y-1.5">
          {["Agendar consulta com neurologista para nova guia",
            "Solicitar autorização ao plano de saúde",
            "Enviar número da autorização para a clínica"].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-yellow-800">
              <span className="w-4 h-4 rounded-full bg-yellow-300 text-yellow-900 flex-none flex items-center justify-center text-[10px] font-bold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <Button
        onClick={onConfirm}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 text-sm font-semibold"
      >
        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
        Estou ciente
      </Button>
    </div>
  );
}

function VariantReposicao({
  payload,
  onConfirm,
  onReject,
  loading,
}: {
  payload: CommPayloadReposicao;
  onConfirm: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
          <RotateCcw size={28} color="#2563EB" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 text-center">Horário de reposição</h1>
        {payload.patient_name && (
          <p className="text-sm text-gray-500 text-center mt-1">
            Reposição de {payload.patient_name}
          </p>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-5 space-y-0.5">
        {payload.proposed_date && <InfoRow label="Nova data" value={formatDateBR(payload.proposed_date)} />}
        {payload.proposed_time && <InfoRow label="Horário" value={formatTime(payload.proposed_time)} />}
        {payload.therapist_name && <InfoRow label="Terapeuta" value={payload.therapist_name} />}
        {payload.room_name && <InfoRow label="Sala" value={payload.room_name} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onConfirm}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-11 text-sm font-semibold"
        >
          {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
          Confirmar
        </Button>
        <Button
          variant="outline"
          onClick={onReject}
          disabled={loading}
          className="border-gray-200 text-gray-700 rounded-xl h-11 text-sm font-semibold hover:bg-gray-50"
        >
          Não consigo
        </Button>
      </div>
    </div>
  );
}

function VariantRenovacao({
  payload,
  onConfirm,
  onReject,
  loading,
}: {
  payload: CommPayloadRenovacao;
  onConfirm: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-3">
          <RefreshCw size={28} color="#7C3AED" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 text-center">Renovação de contrato</h1>
        {payload.patient_name && payload.clinic_name && (
          <p className="text-sm text-gray-500 text-center mt-1">
            {payload.patient_name} · {payload.clinic_name}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 overflow-hidden mb-5">
        {payload.current_period && (
          <div className="grid grid-cols-2">
            <div className="p-3 bg-gray-50 border-r border-gray-100">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Período atual</p>
              <p className="text-sm font-semibold text-gray-900">{payload.current_period}</p>
            </div>
            <div className="p-3 bg-indigo-50">
              <p className="text-[10px] text-indigo-600 uppercase tracking-wide mb-0.5">Período proposto</p>
              <p className="text-sm font-semibold text-indigo-900">{payload.proposed_period ?? "—"}</p>
            </div>
          </div>
        )}
        {payload.modality && (
          <div className="p-3 border-t border-gray-100">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">Modalidade</span>
              <span className="text-sm font-semibold text-gray-900">{payload.modality}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onConfirm}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 text-sm font-semibold"
        >
          {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
          Confirmar renovação
        </Button>
        <Button
          variant="outline"
          onClick={onReject}
          disabled={loading}
          className="border-gray-200 text-gray-700 rounded-xl h-11 text-sm font-semibold hover:bg-gray-50"
        >
          Não quero renovar
        </Button>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

function ConfirmacaoClinicaPage() {
  const { token } = Route.useParams();
  const [done, setDone] = useState(false);
  const [lastAction, setLastAction] = useState<"confirmar" | "rejeitar" | "ciencia">("ciencia");

  const getComm = useServerFn(getCommunicationByTokenServer);
  const confirmComm = useServerFn(confirmCommunicationServer);

  const query = useQuery({
    queryKey: ["confirmacao-clinica", token],
    queryFn: async () => getComm({ data: { token } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async (action: "confirmar" | "rejeitar" | "ciencia") => {
      setLastAction(action);
      return confirmComm({ data: { token, action } });
    },
    onSuccess: (res) => {
      if (res.ok) setDone(true);
    },
  });

  if (query.isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </PageShell>
    );
  }

  const data = query.data;

  if (!data?.ok) {
    return (
      <PageShell>
        <div className="p-6 text-center py-10">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} color="#EF4444" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link inválido</h2>
          <p className="text-sm text-gray-500">
            Este link não existe ou foi removido. Por favor, entre em contato com a clínica.
          </p>
        </div>
      </PageShell>
    );
  }

  if (data.expired) {
    return (
      <PageShell>
        <div className="p-6 text-center py-10">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} color="#D97706" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link expirado</h2>
          <p className="text-sm text-gray-500">
            Este link de confirmação expirou. Por favor, entre em contato com a clínica para mais informações.
          </p>
        </div>
      </PageShell>
    );
  }

  if (data.confirmed && !done) {
    return (
      <PageShell>
        <div className="p-6 text-center py-10">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} color="#16A34A" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Já confirmado</h2>
          <p className="text-sm text-gray-500">
            Esta mensagem já foi confirmada anteriormente. Obrigado!
          </p>
        </div>
      </PageShell>
    );
  }

  if (done) {
    const isRejected = lastAction === "rejeitar";
    return (
      <PageShell>
        <div className="p-6 text-center py-10">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isRejected ? "bg-red-50" : "bg-green-50"}`}>
            {isRejected
              ? <XCircle size={28} color="#EF4444" />
              : <CheckCircle2 size={28} color="#16A34A" />}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {isRejected ? "Resposta registrada" : "Confirmação recebida!"}
          </h2>
          <p className="text-sm text-gray-500">
            {isRejected
              ? "Entendemos. A clínica entrará em contato para verificar outras opções."
              : "Obrigado! Sua resposta foi registrada com sucesso."}
          </p>
        </div>
      </PageShell>
    );
  }

  if (mutation.error || (mutation.data && !mutation.data.ok)) {
    const errMsg = mutation.data && !mutation.data.ok ? mutation.data.error : "Erro ao processar. Tente novamente.";
    return (
      <PageShell>
        <div className="p-6 text-center py-10">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} color="#EF4444" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Erro</h2>
          <p className="text-sm text-gray-500">{errMsg}</p>
        </div>
      </PageShell>
    );
  }

  const commType = data.communication.comm_type as CommType;
  const payload = data.payload;
  const loading = mutation.isPending;

  const contactLine = (
    <p className="text-[11px] text-gray-400 text-center mt-4">
      Dúvidas? Entre em contato:{" "}
      <span className="text-indigo-500">clinica@teamo.com.br</span>
    </p>
  );

  if (commType === "cancelamento_ausencia_terapeuta") {
    return (
      <PageShell>
        <VariantCancelamento
          payload={payload as CommPayloadCancelamento}
          onConfirm={() => mutation.mutate("ciencia")}
          loading={loading}
        />
        {contactLine}
      </PageShell>
    );
  }

  if (commType === "autorizacao_vencendo") {
    return (
      <PageShell>
        <VariantAutorizacao
          payload={payload as CommPayloadAutorizacao}
          onConfirm={() => mutation.mutate("ciencia")}
          loading={loading}
        />
        {contactLine}
      </PageShell>
    );
  }

  if (commType === "proposta_reposicao") {
    return (
      <PageShell>
        <VariantReposicao
          payload={payload as CommPayloadReposicao}
          onConfirm={() => mutation.mutate("confirmar")}
          onReject={() => mutation.mutate("rejeitar")}
          loading={loading}
        />
        {contactLine}
      </PageShell>
    );
  }

  if (commType === "renovacao_contrato" || commType === "mudanca_terapeuta") {
    return (
      <PageShell>
        <VariantRenovacao
          payload={payload as CommPayloadRenovacao}
          onConfirm={() => mutation.mutate("confirmar")}
          onReject={() => mutation.mutate("rejeitar")}
          loading={loading}
        />
        {contactLine}
      </PageShell>
    );
  }

  // Fallback genérico para outros tipos
  return (
    <PageShell>
      <div className="p-6">
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
            <CheckCircle2 size={28} color="#4F46E5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 text-center">Confirmação</h1>
          <p className="text-sm text-gray-500 text-center mt-1">
            Por favor, confirme que você recebeu esta mensagem.
          </p>
        </div>
        <Button
          onClick={() => mutation.mutate("ciencia")}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 text-sm font-semibold"
        >
          {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          Confirmar ciência
        </Button>
        {contactLine}
      </div>
    </PageShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateBR(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-");
    const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const date = new Date(`${y}-${m}-${d}T12:00:00`);
    return `${days[date.getDay()]}, ${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":");
    return `${h}h${m !== "00" ? m : ""}`;
  } catch {
    return timeStr;
  }
}
