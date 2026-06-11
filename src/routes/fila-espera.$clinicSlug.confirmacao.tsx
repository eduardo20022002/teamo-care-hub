import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Heart, Hash, Contact } from "lucide-react";
import { getPublicClinicBySlugServer } from "@/lib/queue.functions";

export const Route = createFileRoute("/fila-espera/$clinicSlug/confirmacao")({
  validateSearch: z.object({ protocolo: z.string().optional() }),
  head: () => ({
    meta: [{ title: "Solicitação enviada — TEAmo" }],
  }),
  component: ConfirmacaoPage,
});

function ConfirmacaoPage() {
  const { clinicSlug } = Route.useParams();
  const { protocolo } = Route.useSearch();

  const { data } = useQuery({
    queryKey: ["publicClinic", clinicSlug],
    queryFn: () => getPublicClinicBySlugServer({ data: { slug: clinicSlug } }),
    staleTime: 60_000,
  });

  const clinicName = data?.name ?? null;

  const salvarContato = () => {
    if (!clinicName) return;
    const url = typeof window !== "undefined" ? `${window.location.origin}/fila-espera/${clinicSlug}` : "";
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${clinicName}`,
      `ORG:${clinicName}`,
      url ? `URL:${url}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");
    const blob = new Blob([vcard], { type: "text/vcard" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${clinicName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.vcf`;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="min-h-screen" style={{ background: "#F6F7FB" }}>
      {/* Header */}
      <header
        className="h-14 flex items-center px-4"
        style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)" }}
      >
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">
            {clinicName ? `${clinicName} · TEAmo` : "TEAmo"}
          </span>
        </div>
      </header>

      <main className="px-4 py-12 max-w-md mx-auto flex flex-col items-center text-center">
        {/* Ícone de sucesso */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "#F0FDF4" }}
        >
          <CheckCircle2 size={40} className="text-green-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Solicitação enviada!
        </h1>
        {clinicName && (
          <p className="text-sm text-indigo-600 font-medium mb-3">{clinicName}</p>
        )}
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Recebemos as informações e sua criança está na fila de espera.
          A equipe entrará em contato pelo e-mail informado quando houver uma vaga disponível.
        </p>

        {/* Número de protocolo */}
        {protocolo && (
          <div
            className="w-full rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{ background: "#EEF2FF", border: "1.5px solid #C7D2FE" }}
          >
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Hash size={18} className="text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="text-xs text-indigo-500 font-medium">Número de protocolo</p>
              <p className="text-lg font-bold text-indigo-800 tracking-widest">{protocolo}</p>
              <p className="text-xs text-indigo-500 mt-0.5">Guarde este número para acompanhar seu caso</p>
            </div>
          </div>
        )}

        {/* Checklist */}
        <div
          className="w-full rounded-xl p-5 text-left mb-8"
          style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
        >
          <p className="text-sm font-semibold text-gray-700 mb-3">O que acontece agora?</p>
          <ol className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              {clinicName
                ? `A ${clinicName} analisará seu caso e definirá a prioridade.`
                : "A clínica analisará as informações e definirá a prioridade do caso."}
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              Você receberá contato quando surgir uma vaga disponível para agendar a avaliação.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              Se precisar atualizar informações, entre em contato com a clínica informando
              {protocolo ? ` o protocolo ${protocolo}.` : " seu e-mail de cadastro."}
            </li>
          </ol>
        </div>

        {/* Salvar contato da clínica */}
        {clinicName && (
          <button
            type="button"
            onClick={salvarContato}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-indigo-600 bg-white transition-colors hover:bg-indigo-50"
            style={{ border: "1.5px solid #C7D2FE" }}
          >
            <Contact size={16} /> Salvar contato da clínica
          </button>
        )}
      </main>
    </div>
  );
}
