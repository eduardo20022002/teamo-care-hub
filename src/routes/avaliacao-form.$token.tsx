import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from "lucide-react";
import { getFormByTokenServer, submitForm2Server } from "@/lib/clinic-evaluation.functions";

export const Route = createFileRoute("/avaliacao-form/$token")({
  head: () => ({ meta: [{ title: "Confirmação de Agendamento — TEAmo" }] }),
  component: AvaliacaoFormPage,
});

function AvaliacaoFormPage() {
  const { token } = Route.useParams();
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const getForm = useServerFn(getFormByTokenServer);
  const submitForm2 = useServerFn(submitForm2Server);

  const formQuery = useQuery({
    queryKey: ["form-token", token],
    queryFn: async () => getForm({ data: { token } }),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (isConfirmed: boolean) =>
      submitForm2({
        data: {
          token,
          confirmed: isConfirmed,
          rejectionReason: !isConfirmed ? rejectionReason : undefined,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return;
      setSubmitted(true);
    },
  });

  const form = formQuery.data;

  if (formQuery.isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-2 text-gray-400 py-12">
          <Loader2 size={20} className="animate-spin" /> Carregando...
        </div>
      </PageShell>
    );
  }

  if (!form?.ok || !formQuery.data) {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} color="#EF4444" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link inválido</h2>
          <p className="text-sm text-gray-500">Este link não existe ou foi removido. Entre em contato com a clínica.</p>
        </div>
      </PageShell>
    );
  }

  if (form.expired) {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} color="#D97706" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link expirado</h2>
          <p className="text-sm text-gray-500">Este link de confirmação expirou. Por favor, entre em contato com a clínica para receber um novo link.</p>
        </div>
      </PageShell>
    );
  }

  if (form.used && !submitted) {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} color="#16A34A" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Já respondido</h2>
          <p className="text-sm text-gray-500">Este formulário já foi respondido anteriormente. Obrigado!</p>
        </div>
      </PageShell>
    );
  }

  if (submitted) {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: confirmed ? "#DCFCE7" : "#FEE2E2" }}>
            {confirmed
              ? <CheckCircle2 size={28} color="#16A34A" />
              : <XCircle size={28} color="#EF4444" />}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {confirmed ? "Agendamento confirmado!" : "Horário rejeitado"}
          </h2>
          <p className="text-sm text-gray-500">
            {confirmed
              ? "Ótimo! Sua resposta foi registrada. Entraremos em contato para confirmar os próximos passos."
              : "Entendemos. A clínica entrará em contato para propor um novo horário."}
          </p>
        </div>
      </PageShell>
    );
  }

  const payload = form.payload as {
    child_name?: string;
    proposed_schedule?: {
      days?: string;
      startTime?: string;
      endTime?: string;
      therapistName?: string;
      sessionType?: string;
      roomName?: string;
    };
  };

  const schedule = payload.proposed_schedule;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Confirmação de agendamento</h1>
          {payload.child_name && (
            <p className="text-sm text-gray-500 mt-1">{payload.child_name}</p>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: "#F8F9FF", border: "0.5px solid #C7D2FE" }}>
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Horário proposto</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Dias</p>
              <p className="text-sm font-medium text-gray-900">{schedule?.days ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Horário</p>
              <p className="text-sm font-medium text-gray-900">
                {schedule?.startTime ?? "—"} – {schedule?.endTime ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Terapeuta</p>
              <p className="text-sm font-medium text-gray-900">{schedule?.therapistName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Tipo</p>
              <p className="text-sm font-medium text-gray-900">
                {schedule?.sessionType ?? "ABA Individual"}
                {schedule?.roomName ? ` — ${schedule.roomName}` : ""}
              </p>
            </div>
          </div>
        </div>

        {confirmed === false && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Motivo (opcional — ajuda a clínica a propor melhor horário)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none"
              placeholder="Ex: Não consigo neste dia pela escola..."
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setConfirmed(true);
              submitMutation.mutate(true);
            }}
            disabled={submitMutation.isPending}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#4F46E5" }}
          >
            {submitMutation.isPending && confirmed === true
              ? <Loader2 size={16} className="animate-spin" />
              : <CheckCircle2 size={16} />}
            Confirmar este horário
          </button>

          {confirmed === false ? (
            <button
              onClick={() => submitMutation.mutate(false)}
              disabled={submitMutation.isPending}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium text-red-600"
              style={{ border: "1px solid #EF4444" }}
            >
              {submitMutation.isPending && confirmed === false
                ? <Loader2 size={16} className="animate-spin" />
                : null}
              Confirmar que não funciona
            </button>
          ) : (
            <button
              onClick={() => setConfirmed(false)}
              className="w-full py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ border: "0.5px solid #E5E7EB" }}
            >
              Este horário não funciona
            </button>
          )}
        </div>

        <p className="text-xs text-center text-gray-400">
          Ao confirmar, sua resposta será registrada com data e hora conforme a LGPD (Art. 11).
          Não é necessário fazer login.
        </p>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#F6F7FB" }}>
      <header className="h-14 flex items-center px-6" style={{
        background: "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)",
      }}>
        <span className="text-white font-bold text-lg">TEAmo</span>
        <span className="text-white/70 text-sm ml-2">clínica</span>
      </header>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: "0.5px solid #E5E7EB" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
