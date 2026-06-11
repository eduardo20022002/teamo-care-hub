import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Loader2, Heart, AlertCircle } from "lucide-react";
import { getPublicClinicBySlugServer, submitQueueEntryServer } from "@/lib/queue.functions";
import {
  QUEUE_DIAS,
  QUEUE_TURNOS,
  type QueueModalidade,
} from "@/types/queue";

export const Route = createFileRoute("/fila-espera/$clinicSlug")({
  head: () => ({
    meta: [{ title: "Solicitação de Vaga — TEAmo" }],
  }),
  component: FilaEsperaFormPage,
});

// ─── Tipos do formulário ──────────────────────────────────────────────────────

interface FormData {
  // Etapa 1 — Criança
  child_name: string;
  child_birthdate: string;
  child_diagnosis: string;
  child_cid: string;
  // Etapa 2 — Fatores clínicos
  sem_servico_atual: boolean;
  diagnose_recente: boolean;
  idade_critica: boolean;
  comportamento_desafio: boolean;
  gravidade: "leve" | "moderado" | "grave";
  comportamento_descricao: string;
  renda_baixa: boolean;
  responsavel_solo: boolean;
  distancia_km: string;
  // Etapa 3 — Modalidades e disponibilidade
  modalidades: QueueModalidade[];
  dias: string[];
  turnos: string[];
  // Etapa 4 — Contato
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_telefone: string;
}

const INITIAL: FormData = {
  child_name: "", child_birthdate: "", child_diagnosis: "", child_cid: "",
  sem_servico_atual: false, diagnose_recente: false, idade_critica: false,
  comportamento_desafio: false, gravidade: "leve", comportamento_descricao: "",
  renda_baixa: false, responsavel_solo: false, distancia_km: "",
  modalidades: [], dias: [], turnos: [],
  responsavel_nome: "", responsavel_email: "", responsavel_telefone: "",
};

const STEP_TITLES = [
  "Dados da criança",
  "Contexto clínico",
  "Interesse e disponibilidade",
  "Contato do responsável",
];

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function CheckCard({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 text-left rounded-xl p-4 transition-colors"
      style={{
        border: `1.5px solid ${checked ? "#4F46E5" : "#E5E7EB"}`,
        background: checked ? "#EEF2FF" : "#FFFFFF",
      }}
    >
      <span
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
        style={{
          borderColor: checked ? "#4F46E5" : "#D1D5DB",
          background: checked ? "#4F46E5" : "white",
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </button>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 outline-none transition-colors"
      style={{ border: "1.5px solid #E5E7EB" }}
    />
  );
}

// ─── Etapas ───────────────────────────────────────────────────────────────────

function Step1({ form, set }: { form: FormData; set: (p: Partial<FormData>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel required>Nome completo da criança</FieldLabel>
        <Input
          value={form.child_name}
          onChange={(e) => set({ child_name: e.target.value })}
          placeholder="Nome da criança"
          maxLength={200}
        />
      </div>
      <div>
        <FieldLabel required>Data de nascimento</FieldLabel>
        <Input
          type="date"
          value={form.child_birthdate}
          onChange={(e) => set({ child_birthdate: e.target.value })}
          max={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div>
        <FieldLabel>Diagnóstico (se houver)</FieldLabel>
        <Input
          value={form.child_diagnosis}
          onChange={(e) => set({ child_diagnosis: e.target.value })}
          placeholder="Ex: TEA leve, TDAH..."
          maxLength={500}
        />
      </div>
      <div>
        <FieldLabel>CID (código do diagnóstico)</FieldLabel>
        <Input
          value={form.child_cid}
          onChange={(e) => set({ child_cid: e.target.value })}
          placeholder="Ex: F84.0"
          maxLength={20}
        />
      </div>
    </div>
  );
}

function Step2({ form, set }: { form: FormData; set: (p: Partial<FormData>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Situação atual do atendimento</p>
        <div className="flex flex-col gap-2">
          <CheckCard
            checked={form.sem_servico_atual}
            onChange={(v) => set({ sem_servico_atual: v })}
            label="Não está recebendo nenhum atendimento especializado"
            description="A criança ainda não tem acompanhamento ABA ou similar"
          />
          <CheckCard
            checked={form.diagnose_recente}
            onChange={(v) => set({ diagnose_recente: v })}
            label="Diagnóstico recente (menos de 1 ano)"
            description="A família está nos primeiros meses após o diagnóstico"
          />
          <CheckCard
            checked={form.idade_critica}
            onChange={(v) => set({ idade_critica: v })}
            label="Criança com menos de 6 anos"
            description="Fase de maior plasticidade neurológica e impacto da intervenção precoce"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Comportamentos desafiadores</p>
        <CheckCard
          checked={form.comportamento_desafio}
          onChange={(v) => set({ comportamento_desafio: v })}
          label="A criança apresenta comportamentos desafiadores frequentes"
          description="Automutilação, agressividade, crises intensas, etc."
        />
        {form.comportamento_desafio && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <FieldLabel>Intensidade</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {(["leve", "moderado", "grave"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set({ gravidade: g })}
                    className="py-2 rounded-lg text-sm font-medium capitalize transition-colors"
                    style={{
                      border: `1.5px solid ${form.gravidade === g ? "#4F46E5" : "#E5E7EB"}`,
                      background: form.gravidade === g ? "#EEF2FF" : "white",
                      color: form.gravidade === g ? "#4F46E5" : "#374151",
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Descrição (opcional)</FieldLabel>
              <textarea
                value={form.comportamento_descricao}
                onChange={(e) => set({ comportamento_descricao: e.target.value })}
                placeholder="Descreva brevemente os comportamentos observados..."
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 outline-none resize-none"
                style={{ border: "1.5px solid #E5E7EB" }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Contexto da família</p>
        <div className="flex flex-col gap-2">
          <CheckCard
            checked={form.renda_baixa}
            onChange={(v) => set({ renda_baixa: v })}
            label="Família de baixa renda"
            description="Renda familiar até 3 salários mínimos"
          />
          <CheckCard
            checked={form.responsavel_solo}
            onChange={(v) => set({ responsavel_solo: v })}
            label="Responsável único (monoparental)"
            description="Apenas um responsável cuida da criança"
          />
          <div>
            <FieldLabel>Distância até a clínica (km aproximado)</FieldLabel>
            <Input
              type="number"
              min={0}
              max={9999}
              value={form.distancia_km}
              onChange={(e) => set({ distancia_km: e.target.value })}
              placeholder="Ex: 25"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3({ form, set }: { form: FormData; set: (p: Partial<FormData>) => void }) {
  const toggleModalidade = (m: QueueModalidade) => {
    set({
      modalidades: form.modalidades.includes(m)
        ? form.modalidades.filter((x) => x !== m)
        : [...form.modalidades, m],
    });
  };
  const toggleDia = (d: string) => {
    set({ dias: form.dias.includes(d) ? form.dias.filter((x) => x !== d) : [...form.dias, d] });
  };
  const toggleTurno = (t: string) => {
    set({ turnos: form.turnos.includes(t) ? form.turnos.filter((x) => x !== t) : [...form.turnos, t] });
  };

  const modalidadeItems: { value: QueueModalidade; label: string; desc: string }[] = [
    { value: "avaliacao",       label: "Avaliação ABA",           desc: "Primeiro passo recomendado para novos casos" },
    { value: "aba_individual",  label: "Terapia ABA individual",   desc: "Sessões individuais com terapeuta" },
    { value: "aba_grupo",       label: "Terapia ABA em grupo",     desc: "Sessões com outras crianças" },
    { value: "orientacao_pais", label: "Orientação para pais",     desc: "Sessões de orientação sem a criança" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Qual atendimento você busca?</p>
        <p className="text-xs text-gray-500 mb-3">Selecione um ou mais. Se não souber, escolha "Avaliação ABA".</p>
        <div className="flex flex-col gap-2">
          {modalidadeItems.map((m) => (
            <CheckCard
              key={m.value}
              checked={form.modalidades.includes(m.value)}
              onChange={() => toggleModalidade(m.value)}
              label={m.label}
              description={m.desc}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Disponibilidade de dias</p>
        <div className="grid grid-cols-3 gap-2">
          {QUEUE_DIAS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDia(d.value)}
              className="py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                border: `1.5px solid ${form.dias.includes(d.value) ? "#4F46E5" : "#E5E7EB"}`,
                background: form.dias.includes(d.value) ? "#EEF2FF" : "white",
                color: form.dias.includes(d.value) ? "#4F46E5" : "#374151",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Disponibilidade de turnos</p>
        <div className="flex flex-col gap-2">
          {QUEUE_TURNOS.map((t) => (
            <CheckCard
              key={t.value}
              checked={form.turnos.includes(t.value)}
              onChange={() => toggleTurno(t.value)}
              label={t.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step4({ form, set }: { form: FormData; set: (p: Partial<FormData>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel required>Nome do responsável</FieldLabel>
        <Input
          value={form.responsavel_nome}
          onChange={(e) => set({ responsavel_nome: e.target.value })}
          placeholder="Nome completo do responsável"
          maxLength={200}
        />
      </div>
      <div>
        <FieldLabel required>E-mail</FieldLabel>
        <Input
          type="email"
          value={form.responsavel_email}
          onChange={(e) => set({ responsavel_email: e.target.value })}
          placeholder="email@exemplo.com"
          maxLength={255}
        />
      </div>
      <div>
        <FieldLabel>Telefone / WhatsApp</FieldLabel>
        <Input
          type="tel"
          value={form.responsavel_telefone}
          onChange={(e) => set({ responsavel_telefone: e.target.value })}
          placeholder="(xx) 9xxxx-xxxx"
          maxLength={30}
        />
      </div>
      <div
        className="rounded-xl p-4 text-sm text-gray-600"
        style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
      >
        <p className="font-medium text-gray-800 mb-1">Seus dados estão protegidos</p>
        <p className="text-xs">
          As informações fornecidas serão usadas exclusivamente pela clínica para gerenciar
          sua solicitação de vaga. Tratamos seus dados conforme a LGPD.
        </p>
      </div>
    </div>
  );
}

// ─── Validação por etapa ──────────────────────────────────────────────────────

function validateStep(step: number, form: FormData): string | null {
  if (step === 0) {
    if (!form.child_name.trim()) return "Informe o nome da criança.";
    if (!form.child_birthdate)   return "Informe a data de nascimento.";
    const birth = new Date(form.child_birthdate);
    if (isNaN(birth.getTime()) || birth > new Date()) return "Data de nascimento inválida.";
  }
  if (step === 2) {
    if (form.modalidades.length === 0) return "Selecione pelo menos um tipo de atendimento.";
  }
  if (step === 3) {
    if (!form.responsavel_nome.trim())  return "Informe o nome do responsável.";
    if (!form.responsavel_email.trim()) return "Informe o e-mail.";
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.responsavel_email);
    if (!emailOk) return "E-mail inválido.";
  }
  return null;
}

// ─── Página principal ─────────────────────────────────────────────────────────

function FilaEsperaFormPage() {
  const { clinicSlug } = Route.useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setFormState] = useState<FormData>(INITIAL);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const set = (patch: Partial<FormData>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
    setFieldError(null);
  };

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ["public-clinic", clinicSlug],
    queryFn: () => getPublicClinicBySlugServer({ data: { slug: clinicSlug } }),
    retry: false,
  });

  const submit = useMutation({
    mutationFn: async () =>
      submitQueueEntryServer({
        data: {
          clinicSlug,
          child_name:           form.child_name.trim(),
          child_birthdate:      form.child_birthdate,
          child_diagnosis:      form.child_diagnosis || undefined,
          child_cid:            form.child_cid || undefined,
          factor_a: {
            sem_servico_atual: form.sem_servico_atual || undefined,
            diagnose_recente:  form.diagnose_recente  || undefined,
            idade_critica:     form.idade_critica     || undefined,
          },
          factor_b: form.comportamento_desafio
            ? {
                comportamento_desafio: true,
                gravidade:             form.gravidade,
                descricao:             form.comportamento_descricao || undefined,
              }
            : { comportamento_desafio: false },
          factor_c: {
            renda_baixa:      form.renda_baixa      || undefined,
            responsavel_solo: form.responsavel_solo  || undefined,
            distancia_km:     form.distancia_km ? parseInt(form.distancia_km) : undefined,
          },
          modalidades:          form.modalidades,
          disponibilidade:      { dias: form.dias, turnos: form.turnos },
          responsavel_nome:     form.responsavel_nome.trim(),
          responsavel_email:    form.responsavel_email.trim(),
          responsavel_telefone: form.responsavel_telefone || undefined,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        navigate({ to: "/fila-espera/$clinicSlug/confirmacao", params: { clinicSlug } });
      } else {
        setFieldError(res.error || "Erro ao enviar. Tente novamente.");
      }
    },
  });

  const handleNext = () => {
    const err = validateStep(step, form);
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      submit.mutate();
    }
  };

  if (clinicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F6F7FB" }}>
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#F6F7FB" }}>
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h1 className="text-lg font-semibold text-gray-900">Clínica não encontrada</h1>
        <p className="text-sm text-gray-500 mt-1 text-center">
          O link que você acessou não corresponde a nenhuma clínica cadastrada.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F6F7FB" }}>
      {/* Header */}
      <header
        className="fixed top-0 inset-x-0 z-10 h-14 flex items-center px-4"
        style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)" }}
      >
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">TEAmo</span>
        </div>
        <span className="ml-2 text-white/70 text-xs truncate">· {clinic.name}</span>
      </header>

      <main className="pt-14 pb-8 px-4 max-w-lg mx-auto">
        {/* Título + progresso */}
        <div className="pt-6 pb-4">
          <p className="text-xs font-medium text-indigo-600 mb-1">Etapa {step + 1} de 4</p>
          <h1 className="text-lg font-bold text-gray-900">{STEP_TITLES[step]}</h1>
          {/* Barra de progresso */}
          <div className="mt-3 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((step + 1) / 4) * 100}%`,
                background: "linear-gradient(to right, #4F46E5, #7C3AED)",
              }}
            />
          </div>
        </div>

        {/* Conteúdo da etapa */}
        <div
          className="bg-white rounded-xl p-5"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 form={form} set={set} />}
          {step === 3 && <Step4 form={form} set={set} />}
        </div>

        {/* Erro de campo */}
        {fieldError && (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm text-red-700"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
          >
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {fieldError}
          </div>
        )}

        {/* Navegação */}
        <div className="mt-4 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white"
              style={{ border: "1.5px solid #E5E7EB" }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={submit.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED)" }}
          >
            {submit.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Enviando...</>
            ) : step < 3 ? (
              <>Continuar <ChevronRight size={16} /></>
            ) : (
              "Enviar solicitação"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
