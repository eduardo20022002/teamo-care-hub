import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { getFormByTokenServer, submitForm3Server } from "@/lib/clinic-evaluation.functions";
import type { Guardian, EmergencyContact, AddressData, InsuranceData } from "@/types/clinic-evaluation";

export const Route = createFileRoute("/cadastro-completo/$token")({
  head: () => ({ meta: [{ title: "Cadastro Completo — TEAmo" }] }),
  component: CadastroCompletoPage,
});

const SECTIONS = [
  "Dados da criança",
  "Responsáveis",
  "Endereço",
  "Emergência",
  "Financeiro / Convênio",
  "Diagnóstico",
  "Equipe multidisciplinar",
  "Situação escolar",
  "Outros profissionais",
  "Rotina familiar",
  "Consentimento",
];

function CadastroCompletoPage() {
  const { token } = Route.useParams();
  const [section, setSection] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const getForm = useServerFn(getFormByTokenServer);
  const submitForm3 = useServerFn(submitForm3Server);

  // ── Estado do formulário ─────────────────────────────────────────────────
  const [childFullName, setChildFullName] = useState("");
  const [childCpf, setChildCpf] = useState("");
  const [childBirthdate, setChildBirthdate] = useState("");
  const [guardians, setGuardians] = useState<Guardian[]>([
    { nome: "", cpf: "", parentesco: "", email: "", telefone: "", is_primary: true },
  ]);
  const [address, setAddress] = useState<AddressData>({
    logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "",
  });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { nome: "", parentesco: "", telefone: "" },
  ]);
  const [paymentType, setPaymentType] = useState<"convenio" | "particular" | "misto" | "">("");
  const [insuranceData, setInsuranceData] = useState<InsuranceData>({});
  const [diagnosisFamilyReport, setDiagnosisFamilyReport] = useState("");
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [otherComorbidity, setOtherComorbidity] = useState("");
  const [currentProfessionals, setCurrentProfessionals] = useState<{ nome: string; especialidade: string; contato: string }[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<{ nome?: string; serie?: string; periodo?: string; temsuporte?: boolean }>({});
  const [otherProfessionals, setOtherProfessionals] = useState<{ nome: string; especialidade: string }[]>([]);
  const [familyRoutine, setFamilyRoutine] = useState("");
  const [expectations, setExpectations] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const COMORBIDITY_OPTIONS = ["TDAH", "Ansiedade", "Deficiência intelectual (DI)", "Epilepsia", "TOD", "Outro"];

  const formQuery = useQuery({
    queryKey: ["form-token", token],
    queryFn: async () => getForm({ data: { token } }),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () =>
      submitForm3({
        data: {
          token,
          childFullName,
          childCpf: childCpf || undefined,
          childBirthdate,
          guardians: guardians.filter((g) => g.nome),
          address,
          emergencyContacts: emergencyContacts.filter((c) => c.nome),
          paymentType: paymentType || undefined,
          insuranceData: Object.keys(insuranceData).length ? insuranceData : undefined,
          diagnosisFamilyReport: diagnosisFamilyReport || undefined,
          comorbidities: [
            ...comorbidities,
            ...(otherComorbidity ? [otherComorbidity] : []),
          ],
          currentProfessionals,
          schoolInfo,
          otherProfessionals,
          familyRoutine: familyRoutine || undefined,
          expectations: expectations || undefined,
          consentGiven,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        alert(res.error || "Erro ao enviar o formulário. Tente novamente.");
        return;
      }
      setSubmitted(true);
    },
    onError: () => alert("Erro ao enviar o formulário. Verifique sua conexão e tente novamente."),
  });

  const form = formQuery.data;
  const payload = form?.ok ? (form.payload as { child_name?: string }) : null;

  const canProceed = (): boolean => {
    if (section === 0) return childFullName.trim().length >= 2 && childBirthdate.length > 0;
    if (section === 1) return guardians.some((g) => g.nome.trim() && g.parentesco.trim());
    if (section === 10) return consentGiven;
    return true;
  };

  if (formQuery.isLoading) {
    return (
      <PageShell clinicName="">
        <div className="flex items-center justify-center gap-2 text-gray-400 py-12">
          <Loader2 size={20} className="animate-spin" /> Carregando...
        </div>
      </PageShell>
    );
  }

  if (!form?.ok) {
    return (
      <PageShell clinicName="">
        <div className="text-center py-8">
          <AlertTriangle size={32} color="#EF4444" className="mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900 mb-1">Link inválido</h2>
          <p className="text-sm text-gray-500">Este link não existe ou foi removido.</p>
        </div>
      </PageShell>
    );
  }

  if (form.expired) {
    return (
      <PageShell clinicName="">
        <div className="text-center py-8">
          <AlertTriangle size={32} color="#D97706" className="mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900 mb-1">Link expirado</h2>
          <p className="text-sm text-gray-500">Este link expirou. Entre em contato com a clínica para receber um novo.</p>
        </div>
      </PageShell>
    );
  }

  if (form.used || submitted) {
    return (
      <PageShell clinicName="">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} color="#16A34A" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Cadastro enviado!</h2>
          <p className="text-sm text-gray-500">
            Obrigado por preencher o cadastro. Nossa equipe vai analisar as informações e entrar em contato em breve.
          </p>
        </div>
      </PageShell>
    );
  }

  const progress = ((section + 1) / SECTIONS.length) * 100;

  return (
    <PageShell clinicName="Clínica">
      {/* Progresso */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Etapa {section + 1} de {SECTIONS.length}: {SECTIONS[section]}</span>
          <span>{Math.round(progress)}% concluído</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full">
          <div className="h-2 bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {payload?.child_name ?? "Cadastro"} · Etapa {section + 1} de {SECTIONS.length}
        </p>
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col gap-5 min-h-[300px]">
        {section === 0 && (
          <S1Crianca
            childFullName={childFullName} setChildFullName={setChildFullName}
            childCpf={childCpf} setChildCpf={setChildCpf}
            childBirthdate={childBirthdate} setChildBirthdate={setChildBirthdate}
          />
        )}
        {section === 1 && (
          <S2Responsaveis guardians={guardians} setGuardians={setGuardians} />
        )}
        {section === 2 && (
          <S3Endereco address={address} setAddress={setAddress} />
        )}
        {section === 3 && (
          <S4Emergencia emergencyContacts={emergencyContacts} setEmergencyContacts={setEmergencyContacts} />
        )}
        {section === 4 && (
          <S5Financeiro
            paymentType={paymentType} setPaymentType={setPaymentType}
            insuranceData={insuranceData} setInsuranceData={setInsuranceData}
          />
        )}
        {section === 5 && (
          <S6Diagnostico
            diagnosisFamilyReport={diagnosisFamilyReport} setDiagnosisFamilyReport={setDiagnosisFamilyReport}
            comorbidities={comorbidities} setComorbidities={setComorbidities}
            otherComorbidity={otherComorbidity} setOtherComorbidity={setOtherComorbidity}
            COMORBIDITY_OPTIONS={COMORBIDITY_OPTIONS}
          />
        )}
        {section === 6 && (
          <S7Equipe currentProfessionals={currentProfessionals} setCurrentProfessionals={setCurrentProfessionals} />
        )}
        {section === 7 && (
          <S8Escola schoolInfo={schoolInfo} setSchoolInfo={setSchoolInfo} />
        )}
        {section === 8 && (
          <S9OutrosProfissionais otherProfessionals={otherProfessionals} setOtherProfessionals={setOtherProfessionals} />
        )}
        {section === 9 && (
          <S10Rotina
            familyRoutine={familyRoutine} setFamilyRoutine={setFamilyRoutine}
            expectations={expectations} setExpectations={setExpectations}
          />
        )}
        {section === 10 && (
          <S11Consentimento consentGiven={consentGiven} setConsentGiven={setConsentGiven} />
        )}
      </div>

      {/* Navegação */}
      <div className="flex gap-3 mt-8">
        {section > 0 && (
          <button
            onClick={() => setSection((s) => s - 1)}
            className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-medium text-gray-600"
            style={{ border: "0.5px solid #E5E7EB" }}
          >
            <ChevronLeft size={15} /> Anterior
          </button>
        )}

        {section < SECTIONS.length - 1 ? (
          <button
            onClick={() => setSection((s) => s + 1)}
            disabled={!canProceed()}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#4F46E5" }}
          >
            Salvar e continuar <ChevronRight size={15} />
          </button>
        ) : (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !consentGiven}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#4F46E5" }}
          >
            {submitMutation.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <CheckCircle2 size={16} />}
            Enviar cadastro
          </button>
        )}
      </div>

      <button
        onClick={() => {/* salvar e continuar depois — sem implementação de draft nesta fase */}}
        className="w-full text-center text-xs text-gray-400 mt-3 hover:text-gray-600"
      >
        Salvar e continuar depois
      </button>
    </PageShell>
  );
}

// ─── Seções do Form 3 ────────────────────────────────────────────────────────

function S1Crianca({ childFullName, setChildFullName, childCpf, setChildCpf, childBirthdate, setChildBirthdate }: {
  childFullName: string; setChildFullName: (v: string) => void;
  childCpf: string; setChildCpf: (v: string) => void;
  childBirthdate: string; setChildBirthdate: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Dados da criança</h2>
      <p className="text-xs text-gray-500">Seção 1 de 11 — identidade da criança</p>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nome completo *</label>
        <input
          value={childFullName}
          onChange={(e) => setChildFullName(e.target.value)}
          placeholder="Nome completo"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data de nascimento *</label>
        <input
          type="date"
          value={childBirthdate}
          onChange={(e) => setChildBirthdate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">CPF (opcional)</label>
        <input
          value={childCpf}
          onChange={(e) => setChildCpf(e.target.value)}
          placeholder="000.000.000-00"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>
    </div>
  );
}

function S2Responsaveis({ guardians, setGuardians }: {
  guardians: Guardian[]; setGuardians: (v: Guardian[]) => void;
}) {
  const PARENTESCO = ["Mãe", "Pai", "Avó/Avô", "Tutor legal", "Outro"];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Responsáveis</h2>
      <p className="text-xs text-gray-500">Seção 2 de 11 — informações dos responsáveis legais</p>

      {guardians.map((g, i) => (
        <div key={i} className="p-4 rounded-xl flex flex-col gap-3" style={{ border: "0.5px solid #E5E7EB" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Responsável {i + 1}</span>
            {i > 0 && (
              <button onClick={() => setGuardians(guardians.filter((_, j) => j !== i))}
                className="text-red-400"><Trash2 size={14} /></button>
            )}
          </div>

          <input
            value={g.nome}
            onChange={(e) => { const u = [...guardians]; u[i] = { ...u[i], nome: e.target.value }; setGuardians(u); }}
            placeholder="Nome completo"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            {PARENTESCO.map((p) => (
              <button key={p}
                onClick={() => { const u = [...guardians]; u[i] = { ...u[i], parentesco: p }; setGuardians(u); }}
                className={`py-2 rounded-lg text-sm transition-colors ${
                  g.parentesco === p ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                {p}
              </button>
            ))}
          </div>

          <input
            value={g.cpf ?? ""}
            onChange={(e) => { const u = [...guardians]; u[i] = { ...u[i], cpf: e.target.value }; setGuardians(u); }}
            placeholder="CPF"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            type="email"
            value={g.email ?? ""}
            onChange={(e) => { const u = [...guardians]; u[i] = { ...u[i], email: e.target.value }; setGuardians(u); }}
            placeholder="E-mail"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={g.telefone ?? ""}
            onChange={(e) => { const u = [...guardians]; u[i] = { ...u[i], telefone: e.target.value }; setGuardians(u); }}
            placeholder="Telefone / WhatsApp"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
        </div>
      ))}

      {guardians.length < 3 && (
        <button
          onClick={() => setGuardians([...guardians, { nome: "", cpf: "", parentesco: "", email: "", telefone: "" }])}
          className="text-sm text-indigo-600 flex items-center gap-1"
        >
          <Plus size={13} /> Adicionar responsável
        </button>
      )}
    </div>
  );
}

function S3Endereco({ address, setAddress }: {
  address: AddressData; setAddress: (v: AddressData) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Endereço residencial</h2>
      <p className="text-xs text-gray-500">Seção 3 de 11</p>

      {[
        ["cep", "CEP", "00000-000"],
        ["logradouro", "Logradouro", "Rua, Av., etc."],
        ["numero", "Número", "123"],
        ["complemento", "Complemento", "Apto, Bloco... (opcional)"],
        ["bairro", "Bairro", ""],
        ["cidade", "Cidade", ""],
        ["estado", "Estado (UF)", "PE"],
      ].map(([key, label, placeholder]) => (
        <div key={key}>
          <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
          <input
            value={(address as Record<string, string | undefined>)[key] ?? ""}
            onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
            placeholder={placeholder}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
          />
        </div>
      ))}
    </div>
  );
}

function S4Emergencia({ emergencyContacts, setEmergencyContacts }: {
  emergencyContacts: EmergencyContact[]; setEmergencyContacts: (v: EmergencyContact[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Contatos de emergência</h2>
      <p className="text-xs text-gray-500">Seção 4 de 11</p>

      {emergencyContacts.map((c, i) => (
        <div key={i} className="p-4 rounded-xl flex flex-col gap-3" style={{ border: "0.5px solid #E5E7EB" }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Contato {i + 1}</span>
            {i > 0 && (
              <button onClick={() => setEmergencyContacts(emergencyContacts.filter((_, j) => j !== i))}
                className="text-red-400"><Trash2 size={14} /></button>
            )}
          </div>
          <input
            value={c.nome}
            onChange={(e) => { const u = [...emergencyContacts]; u[i] = { ...u[i], nome: e.target.value }; setEmergencyContacts(u); }}
            placeholder="Nome"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={c.parentesco}
            onChange={(e) => { const u = [...emergencyContacts]; u[i] = { ...u[i], parentesco: e.target.value }; setEmergencyContacts(u); }}
            placeholder="Parentesco (ex: Avó)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={c.telefone}
            onChange={(e) => { const u = [...emergencyContacts]; u[i] = { ...u[i], telefone: e.target.value }; setEmergencyContacts(u); }}
            placeholder="Telefone"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
        </div>
      ))}
      {emergencyContacts.length < 3 && (
        <button
          onClick={() => setEmergencyContacts([...emergencyContacts, { nome: "", parentesco: "", telefone: "" }])}
          className="text-sm text-indigo-600 flex items-center gap-1"
        >
          <Plus size={13} /> Adicionar contato
        </button>
      )}
    </div>
  );
}

function S5Financeiro({ paymentType, setPaymentType, insuranceData, setInsuranceData }: {
  paymentType: string; setPaymentType: (v: "convenio" | "particular" | "misto") => void;
  insuranceData: InsuranceData; setInsuranceData: (v: InsuranceData) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Informações financeiras e de convênio</h2>
      <p className="text-xs text-gray-500">Seção 5 de 11</p>

      <div className="flex flex-col gap-2">
        {[
          { value: "convenio", label: "Convênio / Plano de saúde" },
          { value: "particular", label: "Pagamento particular" },
          { value: "misto", label: "Misto (parte convênio, parte particular)" },
        ].map((opt) => (
          <button key={opt.value}
            onClick={() => setPaymentType(opt.value as "convenio" | "particular" | "misto")}
            className={`py-3 px-4 rounded-xl text-sm font-medium text-left transition-colors ${
              paymentType === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {(paymentType === "convenio" || paymentType === "misto") && (
        <div className="flex flex-col gap-3 mt-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Plano de saúde</label>
            <input
              value={insuranceData.plano ?? ""}
              onChange={(e) => setInsuranceData({ ...insuranceData, plano: e.target.value })}
              placeholder="Ex: Unimed, Bradesco Saúde..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Número do beneficiário</label>
            <input
              value={insuranceData.numero_beneficiario ?? ""}
              onChange={(e) => setInsuranceData({ ...insuranceData, numero_beneficiario: e.target.value })}
              placeholder="Nº da carteirinha"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nome do titular</label>
            <input
              value={insuranceData.titular ?? ""}
              onChange={(e) => setInsuranceData({ ...insuranceData, titular: e.target.value })}
              placeholder="Se diferente da criança"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">CPF do titular (opcional)</label>
            <input
              value={insuranceData.cpf_titular ?? ""}
              onChange={(e) => setInsuranceData({ ...insuranceData, cpf_titular: e.target.value })}
              placeholder="000.000.000-00"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function S6Diagnostico({ diagnosisFamilyReport, setDiagnosisFamilyReport, comorbidities, setComorbidities, otherComorbidity, setOtherComorbidity, COMORBIDITY_OPTIONS }: {
  diagnosisFamilyReport: string; setDiagnosisFamilyReport: (v: string) => void;
  comorbidities: string[]; setComorbidities: (v: string[]) => void;
  otherComorbidity: string; setOtherComorbidity: (v: string) => void;
  COMORBIDITY_OPTIONS: string[];
}) {
  const CID_OPTIONS = [
    "F84.0 — Autismo infantil",
    "F84.1 — Autismo atípico",
    "F84.5 — Síndrome de Asperger",
    "F84.8 — Outros TGDs",
    "Outro",
  ];

  const [cid, setCid] = useState("");
  const [diagnosticador, setDiagnosticador] = useState("");
  const [dataDiagnostico, setDataDiagnostico] = useState("");
  const [temLaudo, setTemLaudo] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Diagnóstico e comorbidades</h2>
      <p className="text-xs text-gray-500">Seção 6 de 11 — informações clínicas do diagnóstico</p>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">CID principal *</label>
        <select
          value={cid}
          onChange={(e) => { setCid(e.target.value); setDiagnosisFamilyReport(e.target.value); }}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        >
          <option value="">Selecionar...</option>
          {CID_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Comorbidades</label>
        <div className="flex flex-wrap gap-2">
          {COMORBIDITY_OPTIONS.slice(0, -1).map((opt) => (
            <button key={opt}
              onClick={() => setComorbidities(
                comorbidities.includes(opt)
                  ? comorbidities.filter((c) => c !== opt)
                  : [...comorbidities, opt]
              )}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                comorbidities.includes(opt) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
              }`}>
              {opt}
            </button>
          ))}
          <button
            onClick={() => setComorbidities(
              comorbidities.includes("Outro")
                ? comorbidities.filter((c) => c !== "Outro")
                : [...comorbidities, "Outro"]
            )}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              comorbidities.includes("Outro") ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
            }`}>
            Outro
          </button>
        </div>
        {comorbidities.includes("Outro") && (
          <input
            value={otherComorbidity}
            onChange={(e) => setOtherComorbidity(e.target.value)}
            placeholder="Especifique a comorbidade"
            className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Profissional que diagnosticou</label>
        <input
          value={diagnosticador}
          onChange={(e) => setDiagnosticador(e.target.value)}
          placeholder="Dr(a). Nome / Especialidade"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data do diagnóstico</label>
        <input
          type="month"
          value={dataDiagnostico}
          onChange={(e) => setDataDiagnostico(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Tem laudo disponível?</label>
        <div className="flex flex-col gap-2">
          {["Sim, tenho o laudo", "Sim, mas não tenho em mãos", "Não tenho laudo formal"].map((opt) => (
            <button key={opt}
              onClick={() => setTemLaudo(opt)}
              className={`py-2.5 px-4 rounded-xl text-sm text-left transition-colors ${
                temLaudo === opt ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
              }`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function S7Equipe({ currentProfessionals, setCurrentProfessionals }: {
  currentProfessionals: { nome: string; especialidade: string; contato: string }[];
  setCurrentProfessionals: (v: typeof currentProfessionals) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Equipe multidisciplinar atual</h2>
      <p className="text-xs text-gray-500">Seção 7 de 11 — profissionais que acompanham atualmente</p>

      {currentProfessionals.map((p, i) => (
        <div key={i} className="p-4 rounded-xl flex flex-col gap-2" style={{ border: "0.5px solid #E5E7EB" }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Profissional {i + 1}</span>
            <button onClick={() => setCurrentProfessionals(currentProfessionals.filter((_, j) => j !== i))}
              className="text-red-400"><Trash2 size={14} /></button>
          </div>
          <input
            value={p.nome}
            onChange={(e) => { const u = [...currentProfessionals]; u[i] = { ...u[i], nome: e.target.value }; setCurrentProfessionals(u); }}
            placeholder="Nome"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={p.especialidade}
            onChange={(e) => { const u = [...currentProfessionals]; u[i] = { ...u[i], especialidade: e.target.value }; setCurrentProfessionals(u); }}
            placeholder="Especialidade (ex: Fonoaudiologia)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={p.contato}
            onChange={(e) => { const u = [...currentProfessionals]; u[i] = { ...u[i], contato: e.target.value }; setCurrentProfessionals(u); }}
            placeholder="Contato (opcional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
        </div>
      ))}

      <button
        onClick={() => setCurrentProfessionals([...currentProfessionals, { nome: "", especialidade: "", contato: "" }])}
        className="text-sm text-indigo-600 flex items-center gap-1"
      >
        <Plus size={13} /> Adicionar profissional
      </button>

      {currentProfessionals.length === 0 && (
        <p className="text-sm text-gray-400 italic">Nenhum profissional cadastrado — pode deixar em branco se não houver.</p>
      )}
    </div>
  );
}

function S8Escola({ schoolInfo, setSchoolInfo }: {
  schoolInfo: { nome?: string; serie?: string; periodo?: string; temsuporte?: boolean };
  setSchoolInfo: (v: typeof schoolInfo) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Situação escolar</h2>
      <p className="text-xs text-gray-500">Seção 8 de 11</p>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Nome da escola</label>
        <input
          value={schoolInfo.nome ?? ""}
          onChange={(e) => setSchoolInfo({ ...schoolInfo, nome: e.target.value })}
          placeholder="Nome da escola (opcional)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Série / ano</label>
        <input
          value={schoolInfo.serie ?? ""}
          onChange={(e) => setSchoolInfo({ ...schoolInfo, serie: e.target.value })}
          placeholder="Ex: 2º ano do Fundamental"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Período</label>
        <div className="flex gap-2">
          {["Manhã", "Tarde", "Integral"].map((p) => (
            <button key={p}
              onClick={() => setSchoolInfo({ ...schoolInfo, periodo: p })}
              className={`flex-1 py-2.5 rounded-xl text-sm transition-colors ${
                schoolInfo.periodo === p ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
              }`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="suporte"
          checked={schoolInfo.temsuporte ?? false}
          onChange={(e) => setSchoolInfo({ ...schoolInfo, temsuporte: e.target.checked })}
          className="w-5 h-5 rounded"
        />
        <label htmlFor="suporte" className="text-sm text-gray-700">Tem professor auxiliar / suporte escolar</label>
      </div>
    </div>
  );
}

function S9OutrosProfissionais({ otherProfessionals, setOtherProfessionals }: {
  otherProfessionals: { nome: string; especialidade: string }[];
  setOtherProfessionals: (v: typeof otherProfessionals) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Outros profissionais de referência</h2>
      <p className="text-xs text-gray-500">Seção 9 de 11 — médicos, neurologistas, psiquiatras, etc.</p>

      {otherProfessionals.map((p, i) => (
        <div key={i} className="p-4 rounded-xl flex flex-col gap-2" style={{ border: "0.5px solid #E5E7EB" }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Profissional {i + 1}</span>
            <button onClick={() => setOtherProfessionals(otherProfessionals.filter((_, j) => j !== i))}
              className="text-red-400"><Trash2 size={14} /></button>
          </div>
          <input
            value={p.nome}
            onChange={(e) => { const u = [...otherProfessionals]; u[i] = { ...u[i], nome: e.target.value }; setOtherProfessionals(u); }}
            placeholder="Nome"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
          <input
            value={p.especialidade}
            onChange={(e) => { const u = [...otherProfessionals]; u[i] = { ...u[i], especialidade: e.target.value }; setOtherProfessionals(u); }}
            placeholder="Especialidade (ex: Neuropediatria)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
          />
        </div>
      ))}

      <button
        onClick={() => setOtherProfessionals([...otherProfessionals, { nome: "", especialidade: "" }])}
        className="text-sm text-indigo-600 flex items-center gap-1"
      >
        <Plus size={13} /> Adicionar profissional
      </button>
    </div>
  );
}

function S10Rotina({ familyRoutine, setFamilyRoutine, expectations, setExpectations }: {
  familyRoutine: string; setFamilyRoutine: (v: string) => void;
  expectations: string; setExpectations: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Rotina e expectativas</h2>
      <p className="text-xs text-gray-500">Seção 10 de 11 — contexto familiar</p>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Rotina familiar</label>
        <textarea
          value={familyRoutine}
          onChange={(e) => setFamilyRoutine(e.target.value)}
          rows={4}
          placeholder="Descreva a rotina da criança e da família — horários, atividades, desafios do dia a dia..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Expectativas com o atendimento</label>
        <textarea
          value={expectations}
          onChange={(e) => setExpectations(e.target.value)}
          rows={3}
          placeholder="O que a família espera alcançar com o acompanhamento terapêutico?"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none"
        />
      </div>
    </div>
  );
}

function S11Consentimento({ consentGiven, setConsentGiven }: {
  consentGiven: boolean; setConsentGiven: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-900">Consentimento</h2>
      <p className="text-xs text-gray-500">Seção 11 de 11 — leitura e aceite obrigatórios</p>

      <div className="p-4 rounded-xl text-sm text-gray-600 leading-relaxed"
        style={{ background: "#F0F4FF", border: "0.5px solid #C7D2FE" }}>
        <p className="font-semibold text-gray-800 mb-2">Termo de consentimento LGPD</p>
        <p className="mb-2">
          Os dados informados neste cadastro são tratados pela clínica exclusivamente para finalidades relacionadas ao atendimento terapêutico da criança.
        </p>
        <p className="mb-2">
          Dados de saúde são considerados dados sensíveis pela Lei Geral de Proteção de Dados (LGPD, Art. 11) e só serão compartilhados com a equipe diretamente responsável pelo atendimento.
        </p>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento entrando em contato com a clínica.
        </p>
      </div>

      <button
        onClick={() => setConsentGiven(!consentGiven)}
        className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all ${
          consentGiven
            ? "bg-green-50 border-2 border-green-500"
            : "border-2 border-gray-200 hover:border-indigo-300"
        }`}
      >
        <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center mt-0.5 ${
          consentGiven ? "bg-green-500" : "bg-white border-2 border-gray-300"
        }`}>
          {consentGiven && <CheckCircle2 size={14} color="white" />}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            Declaro que li e concordo com o tratamento dos dados acima.
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Este aceite fica registrado com data e hora (LGPD Art. 8º).
          </p>
        </div>
      </button>

      {!consentGiven && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle size={12} /> O consentimento é obrigatório para enviar o cadastro.
        </p>
      )}
    </div>
  );
}

// ─── Shell da página mobile-first ────────────────────────────────────────────
function PageShell({ children, clinicName }: { children: React.ReactNode; clinicName: string }) {
  return (
    <div className="min-h-screen" style={{ background: "#F6F7FB" }}>
      <header className="h-14 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)" }}>
        <span className="text-white font-bold text-lg">TEAmo <span className="font-normal opacity-80">clínica</span></span>
        {clinicName && <span className="text-white/70 text-xs">{clinicName}</span>}
      </header>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "0.5px solid #E5E7EB" }}>
          <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Cadastro completo</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
