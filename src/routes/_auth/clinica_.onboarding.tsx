import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2, MapPin, Users, CheckCircle2, ArrowRight, ArrowLeft, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getMyClinicServer, createClinicServer } from "@/lib/clinic.functions";
import { authHeaders } from "@/lib/auth-headers";
import { CLINIC_SERVICES } from "@/types/clinic";
import type { ClinicAddress } from "@/types/clinic";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const HEADER_GRADIENT = "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)";

export const Route = createFileRoute("/_auth/clinica_/onboarding")({
  head: () => ({
    meta: [{ title: "Configurar clínica — TEAmo" }],
  }),
  component: ClinicOnboardingPage,
});

const STEPS = [
  { title: "Dados da clínica", icon: Building2, desc: "Nome, CNPJ e endereço" },
  { title: "Modalidades",      icon: Users,     desc: "Serviços que a clínica oferece" },
  { title: "Tudo pronto!",     icon: CheckCircle2, desc: "Sua clínica está configurada" },
] as const;

// ─── CNPJ formatter ──────────────────────────────────────────────────────────
function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  // Check if all digits are the same
  if (/^(\d)\1{13}$/.test(digits)) return false;
  return true; // Simplified validation — full mod-11 can be added
}

// ─── BR states ───────────────────────────────────────────────────────────────
const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// ─── Step 1: Clinic data ──────────────────────────────────────────────────────
function Step1({
  name, setName, cnpj, setCnpj, address, setAddress,
}: {
  name: string; setName: (v: string) => void;
  cnpj: string; setCnpj: (v: string) => void;
  address: ClinicAddress; setAddress: (v: ClinicAddress) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clinic-name" className="text-sm font-medium text-gray-700">
          Nome da clínica <span className="text-red-500">*</span>
        </label>
        <input
          id="clinic-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Clínica Terapêutica Esperança"
          maxLength={120}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>

      {/* CNPJ */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clinic-cnpj" className="text-sm font-medium text-gray-700">
          CNPJ <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          id="clinic-cnpj"
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
          placeholder="00.000.000/0000-00"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        {cnpj && cnpj.replace(/\D/g, "").length === 14 && !validateCNPJ(cnpj) && (
          <p className="text-xs text-red-500">CNPJ inválido</p>
        )}
      </div>

      {/* Address */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-gray-700">Endereço <span className="text-gray-400 font-normal">(opcional)</span></p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label htmlFor="street" className="text-xs text-gray-500">Logradouro</label>
            <input
              id="street"
              type="text"
              value={address.street ?? ""}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
              placeholder="Rua, Avenida..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="number" className="text-xs text-gray-500">Número</label>
            <input
              id="number"
              type="text"
              value={address.number ?? ""}
              onChange={(e) => setAddress({ ...address, number: e.target.value })}
              placeholder="123"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="complement" className="text-xs text-gray-500">Complemento</label>
            <input
              id="complement"
              type="text"
              value={address.complement ?? ""}
              onChange={(e) => setAddress({ ...address, complement: e.target.value })}
              placeholder="Sala 12, Bloco B..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="text-xs text-gray-500">Cidade</label>
            <input
              id="city"
              type="text"
              value={address.city ?? ""}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              placeholder="Recife"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-xs text-gray-500">Estado</label>
            <select
              id="state"
              value={address.state ?? ""}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors bg-white"
            >
              <option value="">Selecione</option>
              {BR_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Services ─────────────────────────────────────────────────────────
function Step2({
  services, setServices,
}: {
  services: string[]; setServices: (v: string[]) => void;
}) {
  const toggle = (s: string) => {
    setServices(
      services.includes(s)
        ? services.filter((x) => x !== s)
        : [...services, s],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Selecione as modalidades que sua clínica oferece. Você pode ajustar isso depois nas configurações.
      </p>
      <div className="flex flex-col gap-2">
        {CLINIC_SERVICES.map((service) => {
          const selected = services.includes(service);
          return (
            <button
              key={service}
              type="button"
              onClick={() => toggle(service)}
              className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all"
              style={{
                border: `1.5px solid ${selected ? "#4F46E5" : "#E5E7EB"}`,
                background: selected ? "#EEF2FF" : "#FAFAFA",
              }}
            >
              <div
                className="w-5 h-5 rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-colors"
                style={{
                  borderColor: selected ? "#4F46E5" : "#D1D5DB",
                  background: selected ? "#4F46E5" : "white",
                }}
              >
                {selected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6l3 3 6-6" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium" style={{ color: selected ? "#4F46E5" : "#374151" }}>
                {service}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────
function Step3({ clinicName }: { clinicName: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "#DCFCE7" }}
      >
        <CheckCircle2 size={32} color="#16A34A" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900">{clinicName} está pronta!</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-sm">
          Sua clínica foi configurada com sucesso. Agora você pode convidar sua equipe e começar
          a receber pacientes na fila de espera.
        </p>
      </div>
      <ul className="text-sm text-gray-600 flex flex-col gap-1.5">
        <li className="flex items-center gap-2">
          <CheckCircle2 size={14} color="#16A34A" />
          Dashboard da clínica disponível
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 size={14} color="#16A34A" />
          Fila de espera configurada
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 size={14} color="#16A34A" />
          Pronto para convidar equipe
        </li>
      </ul>
    </div>
  );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────
function ClinicOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getClinic    = useServerFn(getMyClinicServer);
  const createClinic = useServerFn(createClinicServer);

  const [step, setStep] = useState(0);

  // Step 1 state
  const [name, setName]       = useState("");
  const [cnpj, setCnpj]       = useState("");
  const [address, setAddress] = useState<ClinicAddress>({});

  // Step 2 state
  const [services, setServices] = useState<string[]>(["Avaliação inicial", "ABA individual"]);

  // Check if already has clinic
  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      createClinic({
        data: {
          name:     name.trim(),
          cnpj:     cnpj.trim() || undefined,
          address,
          services,
        },
        headers: await authHeaders(),
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Não foi possível criar a clínica. Tente novamente.");
        return;
      }
      setStep(2);
    },
    onError: () => {
      toast.error("Não foi possível criar a clínica. Tente novamente.");
    },
  });

  if (clinicQuery.isLoading) {
    return <LoadingSpinner label="Verificando clínica..." />;
  }

  // Already has clinic → redirect
  if (clinicQuery.data?.clinic) {
    navigate({ to: "/clinica" });
    return null;
  }

  const canAdvanceStep1 = name.trim().length >= 2 &&
    (!cnpj || cnpj.replace(/\D/g, "").length === 0 || validateCNPJ(cnpj));

  const handleNext = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 0) {
      if (!canAdvanceStep1) return;
      setStep(1);
    } else if (step === 1) {
      createMutation.mutate();
    } else {
      navigate({ to: "/clinica" });
    }
  };

  const currentStepMeta = STEPS[step];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F6F7FB" }}>
      {/* Header */}
      <header
        className="flex items-center px-6 gap-3 shrink-0"
        style={{ height: 56, background: HEADER_GRADIENT }}
      >
        <Building2 size={20} color="white" />
        <span className="text-white font-bold text-base">TEAmo · Configuração da clínica</span>
      </header>

      {/* Wizard container */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div
          className="w-full max-w-lg bg-white rounded-2xl p-8 flex flex-col gap-6"
          style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
        >
          {/* Progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
                  style={{
                    background: i < step ? "#4F46E5" : i === step ? "#4F46E5" : "#F3F4F6",
                    color: i <= step ? "white" : "#9CA3AF",
                  }}
                >
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l4 4 8-8" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 transition-colors"
                    style={{ background: i < step ? "#4F46E5" : "#E5E7EB" }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step header */}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{currentStepMeta.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{currentStepMeta.desc}</p>
          </div>

          {/* Step content */}
          <form onSubmit={(e) => void handleNext(e)} className="flex flex-col gap-6">
            {step === 0 && (
              <Step1
                name={name} setName={setName}
                cnpj={cnpj} setCnpj={setCnpj}
                address={address} setAddress={setAddress}
              />
            )}
            {step === 1 && (
              <Step2 services={services} setServices={setServices} />
            )}
            {step === 2 && (
              <Step3 clinicName={name} />
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center pt-2">
              {step > 0 && step < 2 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Voltar
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={
                  (step === 0 && !canAdvanceStep1) ||
                  createMutation.isPending
                }
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Criando clínica...
                  </>
                ) : step === 2 ? (
                  <>
                    Ir para o dashboard
                    <ArrowRight size={15} />
                  </>
                ) : step === 1 ? (
                  <>
                    Criar clínica
                    <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    Próximo
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
