// Bloco financeiro reutilizável na ficha do paciente (Fase 5)
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CreditCard, RefreshCw, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { authHeaders } from "@/lib/auth-headers";
import {
  getAuthorizationDetailServer,
  startAuthorizationRenewalServer,
  createInsuranceAuthorizationServer,
} from "@/lib/clinic-financial.functions";
import {
  AUTHORIZATION_STATUS_LABELS,
  VALIDITY_BADGE_CLASSES,
  getAlertLevel,
  type InsuranceAuthorization,
} from "@/types/clinic-financial";
import { toast } from "sonner";

interface Props {
  clinicId: string;
  patientProfileId: string;
  patientName: string;
  paymentType?: "convenio" | "particular" | "misto" | null;
}

function ValidityBadge({ validUntil }: { validUntil: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(validUntil);
  const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const level = getAlertLevel(days);
  const cls = VALIDITY_BADGE_CLASSES[level];

  const label =
    days < 0 ? "Vencida" : days === 0 ? "Vence hoje" : `${days}d restantes`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls.bg} ${cls.text} ${cls.border}`}
    >
      {level === "critical" && <AlertTriangle size={10} />}
      {label}
    </span>
  );
}

function AuthorizationCard({
  auth,
  onRenew,
}: {
  auth: InsuranceAuthorization;
  onRenew: (authId: string) => void;
}) {
  const pct =
    auth.sessions_authorized > 0
      ? Math.min(100, Math.round((auth.sessions_used / auth.sessions_authorized) * 100))
      : 0;

  const critical = auth.sessions_remaining <= 10;

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ border: "0.5px solid #E5E7EB", background: "#FAFAFA" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900">{auth.insurance_plan}</p>
          <p className="text-xs text-gray-500">{auth.authorization_number}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ValidityBadge validUntil={auth.valid_until} />
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background:
                auth.status === "ativa"
                  ? "#DCFCE7"
                  : auth.status === "vencendo"
                  ? "#FEF9C3"
                  : auth.status === "vencida"
                  ? "#FEE2E2"
                  : "#EEF2FF",
              color:
                auth.status === "ativa"
                  ? "#16A34A"
                  : auth.status === "vencendo"
                  ? "#CA8A04"
                  : auth.status === "vencida"
                  ? "#DC2626"
                  : "#4F46E5",
            }}
          >
            {AUTHORIZATION_STATUS_LABELS[auth.status]}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {auth.sessions_used} de {auth.sessions_authorized} sessões realizadas
          </span>
          <span className={critical ? "font-semibold text-red-600" : "text-gray-500"}>
            {critical && <AlertTriangle size={10} className="inline mr-1" />}
            {auth.sessions_remaining} restantes
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#4F46E5",
            }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Validade: {new Date(auth.valid_from).toLocaleDateString("pt-BR")} →{" "}
        {new Date(auth.valid_until).toLocaleDateString("pt-BR")}
      </p>

      {(auth.status === "ativa" || auth.status === "vencendo" || auth.status === "vencida") && (
        <div className="flex gap-2">
          <button
            onClick={() => onRenew(auth.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
          >
            <RefreshCw size={12} />
            Renovar autorização
          </button>
        </div>
      )}
    </div>
  );
}

interface NewAuthFormProps {
  clinicId: string;
  patientProfileId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function NewAuthForm({ clinicId, patientProfileId, onSuccess, onCancel }: NewAuthFormProps) {
  const qc = useQueryClient();
  const createAuth = useServerFn(createInsuranceAuthorizationServer);
  const [form, setForm] = useState({
    insurancePlan: "",
    authorizationNumber: "",
    validFrom: "",
    validUntil: "",
    sessionsAuthorized: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createAuth({
        data: {
          clinicId,
          patientProfileId,
          insurancePlan:       form.insurancePlan,
          authorizationNumber: form.authorizationNumber,
          validFrom:           form.validFrom,
          validUntil:          form.validUntil,
          sessionsAuthorized:  parseInt(form.sessionsAuthorized, 10),
          notes:               form.notes || undefined,
        },
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error((res as { ok: false; error: string }).error);
      toast.success("Autorização cadastrada com sucesso");
      qc.invalidateQueries({ queryKey: ["authorizationDetail", patientProfileId] });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar autorização");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-4 rounded-lg"
      style={{ border: "0.5px solid #E5E7EB", background: "#F9FAFB" }}
    >
      <p className="text-sm font-semibold text-gray-900">Nova autorização</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">Plano de saúde *</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={form.insurancePlan}
            onChange={(e) => setForm((f) => ({ ...f, insurancePlan: e.target.value }))}
            placeholder="Ex: Unimed"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">Número da autorização *</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={form.authorizationNumber}
            onChange={(e) => setForm((f) => ({ ...f, authorizationNumber: e.target.value }))}
            placeholder="AU-2026-0001"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">Início da validade *</label>
          <input
            type="date"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={form.validFrom}
            onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">Vencimento *</label>
          <input
            type="date"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={form.validUntil}
            onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-xs font-medium text-gray-700">Sessões autorizadas *</label>
          <input
            type="number"
            min={1}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={form.sessionsAuthorized}
            onChange={(e) => setForm((f) => ({ ...f, sessionsAuthorized: e.target.value }))}
            placeholder="Ex: 96"
            required
          />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-xs font-medium text-gray-700">Observações internas</label>
          <textarea
            rows={2}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Renovação solicitada em consulta de..."
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar autorização"}
        </button>
      </div>
    </form>
  );
}

export function ClinicaFinanceiroBlock({ clinicId, patientProfileId, patientName, paymentType }: Props) {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const getDetail = useServerFn(getAuthorizationDetailServer);
  const startRenewal = useServerFn(startAuthorizationRenewalServer);

  const authQuery = useQuery({
    queryKey: ["authorizationDetail", patientProfileId],
    queryFn: async () =>
      getDetail({ data: { clinicId, patientProfileId }, headers: await authHeaders() }),
    enabled: !!patientProfileId && paymentType !== "particular",
  });

  const renewMutation = useMutation({
    mutationFn: async (authorizationId: string) =>
      startRenewal({ data: { clinicId, authorizationId }, headers: await authHeaders() }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error((res as { ok: false; error: string }).error || "Erro ao iniciar renovação");
        return;
      }
      toast.success("Renovação iniciada");
      qc.invalidateQueries({ queryKey: ["authorizationDetail", patientProfileId] });
    },
  });

  if (paymentType === "particular") {
    return (
      <div
        className="rounded-xl p-5 flex flex-col gap-3"
        style={{ border: "0.5px solid #E5E7EB", background: "#fff" }}
      >
        <div className="flex items-center gap-2">
          <CreditCard size={16} color="#4F46E5" />
          <h3 className="text-sm font-semibold text-gray-900">
            Financeiro — {patientName}
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
            Particular
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Pagamentos particulares — controle via registros de pagamento.
        </p>
      </div>
    );
  }

  const history = authQuery.data?.ok ? authQuery.data.authorizations : [];
  const active = history.find(
    (a) => a.status !== "encerrada" && a.status !== "vencida"
  ) ?? history[0] ?? null;

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ border: "0.5px solid #E5E7EB", background: "#fff" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CreditCard size={16} color="#4F46E5" />
          <h3 className="text-sm font-semibold text-gray-900">
            Convênio — {patientName}
          </h3>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-semibold transition-colors"
        >
          <Plus size={12} />
          Nova autorização
        </button>
      </div>

      {showNewForm && (
        <NewAuthForm
          clinicId={clinicId}
          patientProfileId={patientProfileId}
          onSuccess={() => setShowNewForm(false)}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {authQuery.isLoading && (
        <p className="text-sm text-gray-400">Carregando autorizações...</p>
      )}

      {!authQuery.isLoading && active ? (
        <AuthorizationCard
          auth={active}
          onRenew={(id) => renewMutation.mutate(id)}
        />
      ) : !authQuery.isLoading && !showNewForm ? (
        <p className="text-sm text-gray-500 py-2">
          Nenhuma autorização ativa. Cadastre a autorização do convênio.
        </p>
      ) : null}

      {history.length > 1 && (
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold w-fit"
        >
          {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showHistory ? "Ocultar" : "Ver"} histórico ({history.length} autorizações)
        </button>
      )}

      {showHistory && (
        <div className="flex flex-col gap-3 mt-1">
          {history.map((a) => (
            <AuthorizationCard
              key={a.id}
              auth={a}
              onRenew={(id) => renewMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
