import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { useClinicPlan } from "@/services/subscription.service";
import { useUpgrade } from "@/components/premium/PremiumGate";
import { UsageBar } from "@/components/premium/UsageBar";
import {
  listInsuranceAuthorizationsServer,
  startAuthorizationRenewalServer,
  completeAuthorizationRenewalServer,
  createInsuranceAuthorizationServer,
  listClinicPatientsServer,
} from "@/lib/clinic-financial.functions";
import { authHeaders } from "@/lib/auth-headers";
import {
  AUTHORIZATION_STATUS_LABELS,
  VALIDITY_BADGE_CLASSES,
  getAlertLevel,
  type InsuranceAuthorization,
  type AuthorizationStatus,
} from "@/types/clinic-financial";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { AlertTriangle, CreditCard, RefreshCw, ChevronRight, Plus, X, Search, Download } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { toCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/clinica/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Clínica TEAmo" }] }),
  component: ClinicFinanceiroPage,
});

// ─── Helpers visuais ─────────────────────────────────────────────────────────

type FilterStatus = "todas" | AuthorizationStatus;

const STATUS_TABS: { key: FilterStatus; label: string }[] = [
  { key: "todas",                  label: "Todas"              },
  { key: "ativa",                  label: "Ativas"             },
  { key: "vencendo",               label: "Vencendo"           },
  { key: "renovacao_em_andamento", label: "Renovação"          },
  { key: "vencida",                label: "Vencidas"           },
];

function ValidityBadge({ validUntil }: { validUntil: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(validUntil);
  const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const level = getAlertLevel(days);
  const cls = VALIDITY_BADGE_CLASSES[level];

  const label =
    days < 0 ? "Vencida" : days === 0 ? "Vence hoje" : `${days}d`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls.bg} ${cls.text} ${cls.border}`}
    >
      {level === "critical" && <AlertTriangle size={10} />}
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: AuthorizationStatus }) {
  const colors: Record<AuthorizationStatus, { bg: string; text: string }> = {
    ativa:                   { bg: "#DCFCE7", text: "#16A34A" },
    vencendo:                { bg: "#FEF9C3", text: "#CA8A04" },
    vencida:                 { bg: "#FEE2E2", text: "#DC2626" },
    renovacao_em_andamento:  { bg: "#EEF2FF", text: "#4F46E5" },
    encerrada:               { bg: "#F3F4F6", text: "#6B7280" },
  };
  const c = colors[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {AUTHORIZATION_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Modal de nova autorização ────────────────────────────────────────────────

interface NewAuthModalProps {
  clinicId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function NewAuthModal({ clinicId, onSuccess, onClose }: NewAuthModalProps) {
  const qc = useQueryClient();
  const createAuth = useServerFn(createInsuranceAuthorizationServer);
  const listPatients = useServerFn(listClinicPatientsServer);
  const [form, setForm] = useState({
    patientProfileId:    "",
    patientName:         "",
    insurancePlan:       "",
    authorizationNumber: "",
    validFrom:           "",
    validUntil:          "",
    sessionsAuthorized:  "",
    notes:               "",
  });
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    authHeaders().then((headers) =>
      listPatients({ data: { clinicId }, headers }).then((res) => {
        if (res.ok) setPatients(res.patients);
      })
    ).catch(() => null);
  }, [clinicId]);

  const filteredPatients = patientSearch.length >= 2
    ? patients.filter((p) => p.name.toLowerCase().includes(patientSearch.toLowerCase())).slice(0, 6)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientProfileId) { toast.error("Selecione o paciente"); return; }
    setLoading(true);
    try {
      const res = await createAuth({
        data: {
          clinicId,
          patientProfileId:    form.patientProfileId,
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
      toast.success("Autorização cadastrada");
      qc.invalidateQueries({ queryKey: ["insuranceAuthorizations", clinicId] });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl w-full max-w-md flex flex-col"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nova autorização</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1 relative">
            <label className="text-xs font-medium text-gray-700">Paciente *</label>
            {form.patientProfileId ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-sm">
                <span className="font-medium text-indigo-700">{form.patientName}</span>
                <button
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, patientProfileId: "", patientName: "" })); setPatientSearch(""); }}
                  className="text-indigo-400 hover:text-indigo-600 ml-2"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={patientSearch}
                    onChange={(e) => { setPatientSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Digite o nome do paciente..."
                  />
                </div>
                {showDropdown && filteredPatients.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 z-10 max-h-48 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, patientProfileId: p.id, patientName: p.name }));
                          setShowDropdown(false);
                          setPatientSearch("");
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                {patientSearch.length >= 2 && filteredPatients.length === 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">Nenhum paciente encontrado com esse nome.</p>
                )}
              </>
            )}
          </div>
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
          </div>
          <div className="flex flex-col gap-1">
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Observações internas</label>
            <textarea
              rows={2}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Renovação solicitada em consulta de..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar autorização"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal de completar renovação ────────────────────────────────────────────

interface CompleteRenewalModalProps {
  clinicId: string;
  authorizationId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function CompleteRenewalModal({ clinicId, authorizationId, onSuccess, onClose }: CompleteRenewalModalProps) {
  const qc = useQueryClient();
  const completeRenewal = useServerFn(completeAuthorizationRenewalServer);
  const [form, setForm] = useState({
    newNumber:             "",
    newValidUntil:         "",
    newSessionsAuthorized: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await completeRenewal({
        data: {
          clinicId,
          authorizationId,
          newNumber:             form.newNumber,
          newValidUntil:         form.newValidUntil,
          newSessionsAuthorized: parseInt(form.newSessionsAuthorized, 10),
        },
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error((res as { ok: false; error: string }).error);
      toast.success("Renovação concluída com sucesso");
      qc.invalidateQueries({ queryKey: ["insuranceAuthorizations", clinicId] });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao concluir renovação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm flex flex-col" style={{ border: "0.5px solid #E5E7EB" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Concluir renovação</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Novo número de autorização *</label>
            <input
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.newNumber}
              onChange={(e) => setForm((f) => ({ ...f, newNumber: e.target.value }))}
              placeholder="AU-2027-0001"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Novo vencimento *</label>
            <input
              type="date"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.newValidUntil}
              onChange={(e) => setForm((f) => ({ ...f, newValidUntil: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Novas sessões autorizadas *</label>
            <input
              type="number" min={1}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.newSessionsAuthorized}
              onChange={(e) => setForm((f) => ({ ...f, newSessionsAuthorized: e.target.value }))}
              placeholder="96"
              required
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
              {loading ? "Salvando..." : "Confirmar renovação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────

function AuthRow({
  auth,
  onRenew,
  onCompleteRenewal,
}: {
  auth: InsuranceAuthorization;
  onRenew: (authId: string) => void;
  onCompleteRenewal: (authId: string) => void;
}) {
  const pct =
    auth.sessions_authorized > 0
      ? Math.min(100, Math.round((auth.sessions_used / auth.sessions_authorized) * 100))
      : 0;
  const critical = auth.sessions_remaining <= 10;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {auth.patient_name ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{auth.insurance_plan}</td>
      <td className="px-4 py-3 text-xs font-mono text-gray-500">{auth.authorization_number}</td>
      <td className="px-4 py-3">
        <ValidityBadge validUntil={auth.valid_until} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 min-w-[120px]">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{auth.sessions_used}/{auth.sessions_authorized}</span>
            <span className={critical ? "font-semibold text-red-600 flex items-center gap-0.5" : "text-gray-500"}>
              {critical && <AlertTriangle size={10} />}
              {auth.sessions_remaining} rest.
            </span>
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#4F46E5",
              }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={auth.status} />
      </td>
      <td className="px-4 py-3">
        {auth.status === "renovacao_em_andamento" ? (
          <button
            onClick={() => onCompleteRenewal(auth.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
          >
            <RefreshCw size={12} />
            Concluir renovação
          </button>
        ) : auth.status !== "encerrada" ? (
          <button
            onClick={() => onRenew(auth.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-semibold transition-colors"
          >
            <ChevronRight size={12} />
            {auth.status === "vencida" ? "Ver detalhes" : "Renovar"}
          </button>
        ) : (
          <span className="text-xs text-gray-400">Encerrada</span>
        )}
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function ClinicFinanceiroPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { openUpgrade } = useUpgrade();
  const [filter, setFilter] = useState<FilterStatus>("todas");
  const [showNewModal, setShowNewModal] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const getClinic = useServerFn(getMyClinicServer);
  const listAuths = useServerFn(listInsuranceAuthorizationsServer);
  const startRenewal = useServerFn(startAuthorizationRenewalServer);

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const clinicId = clinicQuery.data?.clinic?.id ?? "";
  const { isClinicPremium, limits } = useClinicPlan(clinicId || undefined);

  const authsQuery = useQuery({
    queryKey: ["insuranceAuthorizations", clinicId],
    queryFn: async () =>
      listAuths({ data: { clinicId }, headers: await authHeaders() }),
    enabled: !!clinicId,
    staleTime: 30_000,
  });

  const startRenewalMutation = useMutation({
    mutationFn: async (authorizationId: string) =>
      startRenewal({ data: { clinicId, authorizationId }, headers: await authHeaders() }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error((res as { ok: false; error: string }).error || "Erro"); return; }
      toast.success("Renovação iniciada");
      qc.invalidateQueries({ queryKey: ["insuranceAuthorizations", clinicId] });
    },
  });

  const allAuths: InsuranceAuthorization[] = authsQuery.data?.ok
    ? authsQuery.data.authorizations
    : [];

  const filtered = useMemo(
    () => filter === "todas" ? allAuths : allAuths.filter((a) => a.status === filter),
    [allAuths, filter]
  );

  const expiringCount = allAuths.filter((a) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(a.valid_until);
    const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 30 && a.status !== "encerrada";
  }).length;

  // Exportação CSV (issue #9): reconciliação com convênio em planilha.
  // Client-side, a partir dos dados já carregados (respeita o filtro atual).
  const handleExportCsv = () => {
    if (filtered.length === 0) { toast.info("Nada para exportar neste filtro."); return; }
    const csv = toCsv(filtered, [
      { key: "patient_name", header: "Paciente" },
      { key: "insurance_plan", header: "Convênio" },
      { key: "authorization_number", header: "Nº autorização" },
      { key: "valid_until", header: "Válido até" },
      { key: "sessions_authorized", header: "Sessões autorizadas" },
      { key: "sessions_used", header: "Sessões usadas" },
      { key: "sessions_remaining", header: "Sessões restantes" },
      { key: "status", header: "Status" },
    ]);
    downloadCsv(`autorizacoes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  if (clinicQuery.isLoading) return <LoadingSpinner label="Carregando..." />;

  return (
    <>
      {showNewModal && clinicId && (
        <NewAuthModal
          clinicId={clinicId}
          onSuccess={() => setShowNewModal(false)}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {renewingId && clinicId && (
        <CompleteRenewalModal
          clinicId={clinicId}
          authorizationId={renewingId}
          onSuccess={() => setRenewingId(null)}
          onClose={() => setRenewingId(null)}
        />
      )}

      <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        {!isClinicPremium && !!clinicId && (
          <UsageBar
            used={allAuths.length}
            total={limits.autorizacoes}
            noun={["autorização", "autorizações"]}
            onUpgrade={() => openUpgrade("clinica-autorizacoes")}
            accentColor="#2563EB"
          />
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Autorizações de convênio</h1>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
              <span>{allAuths.length} autorizações ativas</span>
              {expiringCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  <AlertTriangle size={10} />
                  {expiringCount} vencendo em breve
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Download size={15} />
              Exportar CSV
            </button>
            <button
              onClick={() => (!isClinicPremium && allAuths.length >= limits.autorizacoes) ? openUpgrade("clinica-autorizacoes") : setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              <Plus size={15} />
              Nova autorização
            </button>
          </div>
        </div>

        {/* Tabs de filtro */}
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "#F3F4F6" }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                filter === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.key !== "todas" && (
                <span className="ml-1.5 text-gray-400">
                  {allAuths.filter((a) => a.status === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          {authsQuery.isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <LoadingSpinner label="Carregando autorizações..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                <CreditCard size={24} color="#D97706" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {filter === "todas" ? "Nenhuma autorização cadastrada" : `Nenhuma autorização ${AUTHORIZATION_STATUS_LABELS[filter as AuthorizationStatus]?.toLowerCase()}`}
                </p>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                  Cadastre a autorização do convênio quando a família trouxer o número aprovado pelo plano de saúde.
                </p>
              </div>
              <button
                onClick={() => (!isClinicPremium && allAuths.length >= limits.autorizacoes) ? openUpgrade("clinica-autorizacoes") : setShowNewModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                <Plus size={15} />
                Nova autorização
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Paciente", "Plano", "Autorização", "Validade", "Sessões", "Status", "Ação"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((auth) => (
                    <AuthRow
                      key={auth.id}
                      auth={auth}
                      onRenew={(id) => startRenewalMutation.mutate(id)}
                      onCompleteRenewal={(id) => setRenewingId(id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
