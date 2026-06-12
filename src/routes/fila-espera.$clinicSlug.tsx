import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Heart, AlertCircle, Plus, X, Minus } from "lucide-react";
import { getPublicClinicBySlugServer, submitQueueEntryServer } from "@/lib/queue.functions";
import {
  QUEUE_DIAS,
  PARENTESCO_OPCOES,
  FORM_TURNOS,
  FORM_CONDICOES,
  CONDICAO_STATUS_OPCOES,
  type CondicaoStatus,
  type FormCondicoes,
  type FormComportamentos,
} from "@/types/queue";

export const Route = createFileRoute("/fila-espera/$clinicSlug")({
  head: () => ({
    meta: [{ title: "Solicitação de Vaga — TEAmo" }],
  }),
  component: FilaEsperaFormPage,
});

// ─── Estado do formulário ─────────────────────────────────────────────────────

interface Responsavel {
  nome: string;
  parentesco: string;
  parentesco_outro: string;
  telefone: string;
  email: string;
}

interface HorarioDia {
  ativo: boolean;
  inicio: string;
  fim: string;
}

interface FormState {
  child_name: string;
  child_birthdate: string;
  responsaveis: Responsavel[];
  condicoes: FormCondicoes;
  comportamentos: FormComportamentos;
  terapia_aba_atual: boolean | null;
  terapia_aba_horas: number;
  como_soube: string;
  observacoes: string;
  disp_modo: "turno" | "horario" | null;
  disp_grade: Record<string, string[]>;       // dia -> turnos
  disp_horarios: Record<string, HorarioDia>;  // dia -> {ativo,inicio,fim}
  disp_restricoes: string;
  consentimento: boolean;
}

const emptyResponsavel = (): Responsavel => ({
  nome: "", parentesco: "", parentesco_outro: "", telefone: "", email: "",
});

const INITIAL: FormState = {
  child_name: "",
  child_birthdate: "",
  responsaveis: [emptyResponsavel()],
  condicoes: {},
  comportamentos: {},
  terapia_aba_atual: null,
  terapia_aba_horas: 10,
  como_soube: "",
  observacoes: "",
  disp_modo: null,
  disp_grade: {},
  disp_horarios: {},
  disp_restricoes: "",
  consentimento: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function idadeExtenso(birthdate: string): string | null {
  if (!birthdate) return null;
  const b = new Date(birthdate + "T00:00:00");
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  if (b > now) return null;
  let anos = now.getFullYear() - b.getFullYear();
  let meses = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) meses--;
  if (meses < 0) { anos--; meses += 12; }
  const pAno = anos === 1 ? "1 ano" : `${anos} anos`;
  const pMes = meses === 1 ? "1 mês" : `${meses} meses`;
  if (anos === 0) return pMes;
  if (meses === 0) return pAno;
  return `${pAno} e ${pMes}`;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ─── Componentes de UI ────────────────────────────────────────────────────────

function Section({ n, title, intro, children }: {
  n: number; title: string; intro?: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl p-5 mb-4" style={{ border: "0.5px solid #E5E7EB" }}>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white"
          style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED)" }}
        >
          {n}
        </span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      {intro && <p className="text-xs text-gray-500 mb-4 ml-8">{intro}</p>}
      <div className={intro ? "" : "mt-3"}>{children}</div>
    </section>
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
      className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 outline-none transition-colors focus:border-indigo-500"
      style={{ border: "1.5px solid #E5E7EB", ...(props.style ?? {}) }}
    />
  );
}

function Chip({ active, onClick, children, disabled }: {
  active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40"
      style={{
        border: `1.5px solid ${active ? "#4F46E5" : "#E5E7EB"}`,
        background: active ? "#4F46E5" : "white",
        color: active ? "white" : "#374151",
      }}
    >
      {children}
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function FilaEsperaFormPage() {
  const { clinicSlug } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ["public-clinic", clinicSlug],
    queryFn: () => getPublicClinicBySlugServer({ data: { slug: clinicSlug } }),
    retry: false,
  });

  const submit = useMutation({
    mutationFn: async () => {
      // Filtrar responsáveis: primeiro sempre; demais só se completos
      const responsaveis = form.responsaveis
        .filter((r, i) => i === 0 || (r.nome.trim() && r.email.trim()))
        .map((r) => ({
          nome:             r.nome.trim(),
          parentesco:       r.parentesco,
          parentesco_outro: r.parentesco === "outro" ? r.parentesco_outro.trim() : undefined,
          telefone:         digitsOnly(r.telefone),
          email:            r.email.trim(),
        }));

      const disponibilidade =
        form.disp_modo === "turno"
          ? {
              modo: "turno" as const,
              grade: Object.fromEntries(
                Object.entries(form.disp_grade).filter(([, t]) => t.length > 0),
              ),
              restricoes: form.disp_restricoes.trim() || undefined,
            }
          : form.disp_modo === "horario"
          ? {
              modo: "horario" as const,
              horarios: Object.entries(form.disp_horarios)
                .filter(([, h]) => h.ativo)
                .map(([dia, h]) => ({ dia, inicio: h.inicio, fim: h.fim })),
              restricoes: form.disp_restricoes.trim() || undefined,
            }
          : undefined;

      return submitQueueEntryServer({
        data: {
          clinicSlug,
          child_name:        form.child_name.trim(),
          child_birthdate:   form.child_birthdate,
          responsaveis,
          condicoes:         form.condicoes,
          comportamentos:    form.comportamentos,
          terapia_aba_atual: form.terapia_aba_atual ?? undefined,
          terapia_aba_horas: form.terapia_aba_atual ? form.terapia_aba_horas : undefined,
          como_soube:        form.como_soube.trim() || undefined,
          observacoes:       form.observacoes.trim() || undefined,
          disponibilidade,
          consentimento:     true,
        },
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        navigate({
          to: "/fila-espera/$clinicSlug/confirmacao",
          params: { clinicSlug },
          search: { protocolo: res.protocol },
        });
      } else {
        setError(res.error || "Erro ao enviar. Tente novamente.");
      }
    },
    onError: () => setError("Não foi possível enviar. Tente novamente."),
  });

  const validate = (): string | null => {
    // Seção 1
    if (form.child_name.trim().length < 3) return "Por favor, informe o nome completo da criança.";
    if (!form.child_birthdate) return "Por favor, informe a data de nascimento.";
    const b = new Date(form.child_birthdate + "T00:00:00");
    if (isNaN(b.getTime()) || b > new Date()) return "Data de nascimento inválida.";
    const anos = (Date.now() - b.getTime()) / (365.25 * 86_400_000);
    if (anos > 18) return "A idade não pode ser superior a 18 anos.";

    // Seção 2 — primeiro responsável
    const r0 = form.responsaveis[0];
    if (!r0.nome.trim()) return "Informe o nome do responsável principal.";
    if (!r0.parentesco) return "Informe o grau de parentesco do responsável.";
    if (r0.parentesco === "outro" && !r0.parentesco_outro.trim()) return "Especifique a relação com a criança.";
    if (digitsOnly(r0.telefone).length < 10) return "Informe um telefone válido com DDD.";
    if (!EMAIL_RE.test(r0.email.trim())) return "Informe um e-mail válido.";
    // Responsáveis adicionais preenchidos parcialmente
    for (let i = 1; i < form.responsaveis.length; i++) {
      const r = form.responsaveis[i];
      const algum = r.nome.trim() || r.email.trim() || digitsOnly(r.telefone);
      if (algum) {
        if (!r.nome.trim() || !EMAIL_RE.test(r.email.trim()) || digitsOnly(r.telefone).length < 10 || !r.parentesco) {
          return `Complete ou remova os dados do responsável ${i + 1}.`;
        }
      }
    }

    // Seção 3 — comportamentos obrigatório (exibido sempre)
    const c = form.comportamentos;
    if (!c.autolesao && !c.agressividade && !c.nenhum) {
      return "Selecione uma das opções sobre comportamentos.";
    }

    // Seção 4 — disponibilidade
    if (!form.disp_modo) return "Informe sua disponibilidade de horários.";
    if (form.disp_modo === "turno") {
      const algumTurno = Object.values(form.disp_grade).some((t) => t.length > 0);
      if (!algumTurno) return "Selecione ao menos um turno disponível.";
    } else {
      const ativos = Object.entries(form.disp_horarios).filter(([, h]) => h.ativo);
      if (ativos.length === 0) return "Selecione ao menos um dia com horário disponível.";
      for (const [, h] of ativos) {
        if (!h.inicio || !h.fim) return "Preencha os horários de início e término.";
        if (h.fim <= h.inicio) return "O horário de término deve ser após o horário de início.";
      }
    }

    // Seção 5
    if (!form.consentimento) return "É necessário aceitar a Política de Privacidade para enviar.";
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    submit.mutate();
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

      <main className="pt-20 pb-10 px-4 max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Solicitação de vaga</h1>
          <p className="text-sm text-gray-500 mt-1">
            Preencha os dados abaixo para entrar na fila de espera da {clinic.name}.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

        {/* ── Seção 1 — Criança ── */}
        <Section n={1} title="Dados da criança">
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel required>Nome completo da criança</FieldLabel>
              <Input
                value={form.child_name}
                onChange={(e) => set({ child_name: e.target.value })}
                placeholder="Nome completo da criança"
                autoCapitalize="words"
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
              {idadeExtenso(form.child_birthdate) && (
                <p className="text-xs text-gray-500 mt-1.5">{idadeExtenso(form.child_birthdate)}</p>
              )}
            </div>
          </div>
        </Section>

        {/* ── Seção 2 — Responsáveis ── */}
        <Section n={2} title="Responsáveis" intro="Informe os dados de quem acompanha a criança e será nosso contato principal.">
          <div className="flex flex-col gap-5">
            {form.responsaveis.map((r, i) => (
              <ResponsavelBlock
                key={i}
                index={i}
                value={r}
                onChange={(patch) => {
                  const next = [...form.responsaveis];
                  next[i] = { ...next[i], ...patch };
                  set({ responsaveis: next });
                }}
                onRemove={i > 0 ? () => set({ responsaveis: form.responsaveis.filter((_, j) => j !== i) }) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={() => set({ responsaveis: [...form.responsaveis, emptyResponsavel()] })}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline self-start"
            >
              <Plus size={15} /> Adicionar outro responsável
            </button>
          </div>
        </Section>

        {/* ── Seção 3 — Condições ── */}
        <Section n={3} title="Condições e diagnóstico" intro="Essas informações nos ajudam a entender melhor o perfil da criança e organizar nossa fila de atendimento.">
          <CondicoesBlock
            condicoes={form.condicoes}
            setCondicoes={(condicoes) => set({ condicoes })}
            comportamentos={form.comportamentos}
            setComportamentos={(comportamentos) => set({ comportamentos })}
            terapiaAtual={form.terapia_aba_atual}
            setTerapiaAtual={(terapia_aba_atual) => set({ terapia_aba_atual })}
            horas={form.terapia_aba_horas}
            setHoras={(terapia_aba_horas) => set({ terapia_aba_horas })}
            comoSoube={form.como_soube}
            setComoSoube={(como_soube) => set({ como_soube })}
            observacoes={form.observacoes}
            setObservacoes={(observacoes) => set({ observacoes })}
          />
        </Section>

        {/* ── Seção 4 — Disponibilidade ── */}
        <Section n={4} title="Disponibilidade de horários" intro="Informe quando vocês têm disponibilidade. Isso nos ajuda a encontrar um horário que funcione para a família.">
          <DisponibilidadeBlock
            modo={form.disp_modo}
            setModo={(disp_modo) => set({ disp_modo, disp_grade: {}, disp_horarios: {} })}
            grade={form.disp_grade}
            setGrade={(disp_grade) => set({ disp_grade })}
            horarios={form.disp_horarios}
            setHorarios={(disp_horarios) => set({ disp_horarios })}
            restricoes={form.disp_restricoes}
            setRestricoes={(disp_restricoes) => set({ disp_restricoes })}
          />
        </Section>

        {/* ── Seção 5 — Consentimento ── */}
        <Section n={5} title="Consentimento">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.consentimento}
              onChange={(e) => set({ consentimento: e.target.checked })}
              className="mt-0.5 w-5 h-5 accent-indigo-600 flex-shrink-0"
            />
            <span className="text-sm text-gray-800">
              Li e concordo com a Política de Privacidade da clínica.
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-3 ml-8">
            Seus dados serão usados exclusivamente para gestão do atendimento desta clínica,
            conforme a Lei Geral de Proteção de Dados (LGPD). Você pode solicitar acesso, correção
            ou exclusão dos seus dados a qualquer momento entrando em contato com a clínica.
          </p>
        </Section>

        {/* Erro */}
        {error && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm text-red-700"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
          >
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Envio */}
        <button
          type="submit"
          disabled={!form.consentimento || submit.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED)" }}
        >
          {submit.isPending ? (
            <><Loader2 size={16} className="animate-spin" /> Enviando...</>
          ) : (
            "Enviar solicitação"
          )}
        </button>

        </form>
      </main>
    </div>
  );
}

// ─── Bloco: Responsável ───────────────────────────────────────────────────────

function ResponsavelBlock({ index, value, onChange, onRemove }: {
  index: number;
  value: Responsavel;
  onChange: (patch: Partial<Responsavel>) => void;
  onRemove?: () => void;
}) {
  const req = index === 0;
  return (
    <div
      className={index > 0 ? "rounded-xl p-4 relative" : "relative"}
      style={index > 0 ? { background: "#F9FAFB", border: "1px solid #E5E7EB" } : undefined}
    >
      {index > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500">Responsável {index + 1}</span>
          {onRemove && (
            <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
              <X size={12} /> Remover
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel required={req}>Nome completo</FieldLabel>
          <Input value={value.nome} onChange={(e) => onChange({ nome: e.target.value })} placeholder="Seu nome completo" autoCapitalize="words" maxLength={200} />
        </div>
        <div>
          <FieldLabel required={req}>Grau de parentesco</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {PARENTESCO_OPCOES.map((p) => (
              <Chip key={p.value} active={value.parentesco === p.value} onClick={() => onChange({ parentesco: p.value })}>
                {p.label}
              </Chip>
            ))}
          </div>
          {value.parentesco === "outro" && (
            <Input
              value={value.parentesco_outro}
              onChange={(e) => onChange({ parentesco_outro: e.target.value })}
              placeholder="Qual a relação com a criança?"
              maxLength={120}
              style={{ marginTop: 8 }}
            />
          )}
        </div>
        <div>
          <FieldLabel required={req}>Telefone</FieldLabel>
          <Input
            type="tel"
            inputMode="numeric"
            value={value.telefone}
            onChange={(e) => onChange({ telefone: maskTelefone(e.target.value) })}
            placeholder="(XX) XXXXX-XXXX"
            maxLength={16}
          />
        </div>
        <div>
          <FieldLabel required={req}>E-mail</FieldLabel>
          <Input type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="seu@email.com" maxLength={255} />
          {req && value.email.trim() && EMAIL_RE.test(value.email.trim()) && (
            <p className="text-xs text-gray-500 mt-1">Você receberá a confirmação neste e-mail.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bloco: Condições e diagnóstico ───────────────────────────────────────────

function CondicoesBlock({
  condicoes, setCondicoes, comportamentos, setComportamentos,
  terapiaAtual, setTerapiaAtual, horas, setHoras,
  comoSoube, setComoSoube, observacoes, setObservacoes,
}: {
  condicoes: FormCondicoes;
  setCondicoes: (c: FormCondicoes) => void;
  comportamentos: FormComportamentos;
  setComportamentos: (c: FormComportamentos) => void;
  terapiaAtual: boolean | null;
  setTerapiaAtual: (v: boolean) => void;
  horas: number;
  setHoras: (n: number) => void;
  comoSoube: string;
  setComoSoube: (v: string) => void;
  observacoes: string;
  setObservacoes: (v: string) => void;
}) {
  const setCond = (key: string, status: CondicaoStatus) => {
    setCondicoes({ ...condicoes, [key]: status });
  };

  const toggleComp = (key: keyof FormComportamentos) => {
    if (key === "nenhum") {
      setComportamentos({ nenhum: !comportamentos.nenhum, autolesao: false, agressividade: false });
    } else {
      setComportamentos({ ...comportamentos, [key]: !comportamentos[key], nenhum: false });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Condições com status */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">
          A criança tem diagnóstico ou investigação para alguma das condições abaixo?
        </p>
        <p className="text-xs text-gray-500 mb-3">Marque todas que se aplicam e indique o status de cada uma.</p>
        <div className="flex flex-col gap-3">
          {FORM_CONDICOES.map((cond) => {
            const current = (condicoes as Record<string, CondicaoStatus | undefined>)[cond.key];
            return (
              <div key={cond.key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-800">{cond.label}</span>
                <div className="flex gap-1.5 flex-shrink-0">
                  {CONDICAO_STATUS_OPCOES.map((s) => (
                    <Chip key={s.value} active={current === s.value} onClick={() => setCond(cond.key, s.value)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </div>
            );
          })}
          {(condicoes.outra === "sim" || condicoes.outra === "investigacao") && (
            <Input
              value={condicoes.outra_qual ?? ""}
              onChange={(e) => setCondicoes({ ...condicoes, outra_qual: e.target.value })}
              placeholder="Qual condição?"
              maxLength={200}
            />
          )}
        </div>
      </div>

      {/* Comportamentos */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">
          A criança apresenta algum dos comportamentos abaixo com frequência semanal ou maior?
        </p>
        <div className="flex flex-col gap-2">
          <ComportamentoCheck
            checked={!!comportamentos.autolesao}
            onChange={() => toggleComp("autolesao")}
            label="Autolesão com lesão visível"
            desc="morder, bater a cabeça, arranhar até machucar"
          />
          <ComportamentoCheck
            checked={!!comportamentos.agressividade}
            onChange={() => toggleComp("agressividade")}
            label="Agressividade física a outras pessoas"
            desc="bater, morder, empurrar terceiros"
          />
          <ComportamentoCheck
            checked={!!comportamentos.nenhum}
            onChange={() => toggleComp("nenhum")}
            label="Nenhum dos anteriores"
          />
        </div>
      </div>

      {/* Terapia ABA atual */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">A criança está em terapia ABA atualmente?</p>
        <div className="grid grid-cols-2 gap-2">
          {[{ v: true, l: "Sim" }, { v: false, l: "Não" }].map((opt) => (
            <button
              key={opt.l}
              type="button"
              onClick={() => setTerapiaAtual(opt.v)}
              className="py-3 rounded-lg text-sm font-semibold transition-colors"
              style={{
                border: `1.5px solid ${terapiaAtual === opt.v ? "#4F46E5" : "#E5E7EB"}`,
                background: terapiaAtual === opt.v ? "#EEF2FF" : "white",
                color: terapiaAtual === opt.v ? "#4F46E5" : "#374151",
              }}
            >
              {opt.l}
            </button>
          ))}
        </div>
        {terapiaAtual === true && (
          <div className="mt-3">
            <FieldLabel>Quantas horas por semana?</FieldLabel>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setHoras(Math.max(1, horas - 1))} className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ border: "1.5px solid #E5E7EB" }}>
                <Minus size={16} />
              </button>
              <input
                type="number"
                min={1}
                max={60}
                value={horas}
                onChange={(e) => setHoras(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-16 text-center py-2 rounded-lg text-sm outline-none"
                style={{ border: "1.5px solid #E5E7EB" }}
              />
              <button type="button" onClick={() => setHoras(Math.min(60, horas + 1))} className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ border: "1.5px solid #E5E7EB" }}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Como soube */}
      <div>
        <FieldLabel>Como ficou sabendo da clínica? <span className="font-normal text-gray-400">(opcional)</span></FieldLabel>
        <Input value={comoSoube} onChange={(e) => setComoSoube(e.target.value)} placeholder="Ex: indicação de amigo, redes sociais, pesquisa no Google..." maxLength={300} />
      </div>

      {/* Observações */}
      <div>
        <FieldLabel>Observações adicionais <span className="font-normal text-gray-400">(opcional)</span></FieldLabel>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma informação que queira compartilhar antes do nosso contato?"
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 outline-none resize-y"
          style={{ border: "1.5px solid #E5E7EB" }}
        />
        <p className="text-xs text-gray-400 text-right mt-1">{observacoes.length}/1000</p>
      </div>
    </div>
  );
}

function ComportamentoCheck({ checked, onChange, label, desc }: {
  checked: boolean; onChange: () => void; label: string; desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full flex items-start gap-3 text-left rounded-xl p-3 transition-colors"
      style={{ border: `1.5px solid ${checked ? "#4F46E5" : "#E5E7EB"}`, background: checked ? "#EEF2FF" : "white" }}
    >
      <span
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center"
        style={{ borderColor: checked ? "#4F46E5" : "#D1D5DB", background: checked ? "#4F46E5" : "white" }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
    </button>
  );
}

// ─── Bloco: Disponibilidade ───────────────────────────────────────────────────

function DisponibilidadeBlock({
  modo, setModo, grade, setGrade, horarios, setHorarios, restricoes, setRestricoes,
}: {
  modo: "turno" | "horario" | null;
  setModo: (m: "turno" | "horario") => void;
  grade: Record<string, string[]>;
  setGrade: (g: Record<string, string[]>) => void;
  horarios: Record<string, { ativo: boolean; inicio: string; fim: string }>;
  setHorarios: (h: Record<string, { ativo: boolean; inicio: string; fim: string }>) => void;
  restricoes: string;
  setRestricoes: (v: string) => void;
}) {
  const toggleCelula = (dia: string, turno: string) => {
    const atuais = grade[dia] ?? [];
    let next: string[];
    if (turno === "integral") {
      next = atuais.includes("integral") ? [] : ["integral"];
    } else {
      next = atuais.includes(turno) ? atuais.filter((t) => t !== turno) : [...atuais.filter((t) => t !== "integral"), turno];
    }
    setGrade({ ...grade, [dia]: next });
  };

  const toggleDia = (dia: string) => {
    const cur = horarios[dia];
    setHorarios({ ...horarios, [dia]: cur?.ativo ? { ...cur, ativo: false } : { ativo: true, inicio: "08:00", fim: "11:00" } });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Cards de modo */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: "turno" as const, t: "Por turno", d: "Manhã, tarde, noite ou integral" },
          { v: "horario" as const, t: "Por horário específico", d: "Ex: das 8h às 10h" },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setModo(opt.v)}
            className="text-left rounded-xl p-3 transition-colors"
            style={{
              border: `1.5px solid ${modo === opt.v ? "#4F46E5" : "#E5E7EB"}`,
              background: modo === opt.v ? "#EEF2FF" : "white",
            }}
          >
            <p className="text-sm font-semibold text-gray-900">{opt.t}</p>
            <p className="text-xs text-gray-500 mt-0.5">{opt.d}</p>
          </button>
        ))}
      </div>

      {/* Modo turno — grade */}
      {modo === "turno" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-1"></th>
                {QUEUE_DIAS.map((d) => (
                  <th key={d.value} className="p-1 text-xs font-medium text-gray-500">{d.label.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FORM_TURNOS.map((turno) => (
                <tr key={turno.value}>
                  <td className="p-1 text-xs font-medium text-gray-600 whitespace-nowrap pr-2">{turno.label}</td>
                  {QUEUE_DIAS.map((d) => {
                    const sel = (grade[d.value] ?? []).includes(turno.value);
                    const temIntegral = (grade[d.value] ?? []).includes("integral");
                    const disabled = turno.value !== "integral" && temIntegral;
                    return (
                      <td key={d.value} className="p-1">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleCelula(d.value, turno.value)}
                          className="w-full aspect-square min-w-[36px] rounded-md flex items-center justify-center transition-colors disabled:opacity-30"
                          style={{
                            border: `1.5px solid ${sel ? "#4F46E5" : "#E5E7EB"}`,
                            background: sel ? "#EEF2FF" : "white",
                          }}
                        >
                          {sel && (
                            <svg width="12" height="10" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modo horário específico */}
      {modo === "horario" && (
        <div className="flex flex-col gap-2">
          {QUEUE_DIAS.map((d) => {
            const h = horarios[d.value];
            const ativo = !!h?.ativo;
            return (
              <div key={d.value} className="rounded-lg p-3" style={{ border: "1px solid #E5E7EB", background: ativo ? "#FAFAFF" : "white" }}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ativo} onChange={() => toggleDia(d.value)} className="w-4 h-4 accent-indigo-600" />
                    <span className="text-sm font-medium text-gray-800">{d.label}</span>
                  </label>
                  {ativo && (
                    <button type="button" onClick={() => toggleDia(d.value)} className="text-gray-400 hover:text-red-500">
                      <X size={15} />
                    </button>
                  )}
                </div>
                {ativo && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className="text-gray-500">Das</span>
                    <input type="time" value={h.inicio} onChange={(e) => setHorarios({ ...horarios, [d.value]: { ...h, inicio: e.target.value } })} className="px-2 py-1.5 rounded-lg outline-none" style={{ border: "1.5px solid #E5E7EB" }} />
                    <span className="text-gray-500">às</span>
                    <input type="time" value={h.fim} onChange={(e) => setHorarios({ ...horarios, [d.value]: { ...h, fim: e.target.value } })} className="px-2 py-1.5 rounded-lg outline-none" style={{ border: "1.5px solid #E5E7EB" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Restrições */}
      {modo && (
        <div>
          <FieldLabel>Restrições de horário <span className="font-normal text-gray-400">(opcional)</span></FieldLabel>
          <Input value={restricoes} onChange={(e) => setRestricoes(e.target.value)} placeholder="Ex: não pode nas quartas por causa da escola, só antes das 9h..." maxLength={500} />
        </div>
      )}
    </div>
  );
}
