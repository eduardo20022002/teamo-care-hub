import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Building2, MapPin, Loader2, CheckCircle2, Link2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getMyClinicServer, updateClinicServer } from "@/lib/clinic.functions";
import { authHeaders } from "@/lib/auth-headers";
import { nameToSlug } from "@/lib/slugify";
import { CLINIC_SERVICES } from "@/types/clinic";
import type { ClinicAddress } from "@/types/clinic";

function sanitizeSlug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-").replace(/^-+/, "");
}

export const Route = createFileRoute("/_auth/clinica/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações — Clínica TEAmo" }],
  }),
  component: ClinicConfigPage,
});

// ─── CNPJ formatter (same as onboarding) ─────────────────────────────────────
function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function ClinicConfigPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const getClinic    = useServerFn(getMyClinicServer);
  const updateClinic = useServerFn(updateClinicServer);

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const clinic  = clinicQuery.data?.clinic;
  const myRole  = clinicQuery.data?.role ?? "therapist";
  const canEdit = myRole === "coordinator";

  const [name,      setName]      = useState<string>("");
  const [cnpj,      setCnpj]      = useState<string>("");
  const [address,   setAddress]   = useState<ClinicAddress>({});
  const [services,  setServices]  = useState<string[]>([]);
  const [slug,      setSlug]      = useState<string>("");
  const [saved,     setSaved]     = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  // Initialize form when clinic loads
  useState(() => {
    if (clinic) {
      setName(clinic.name);
      setCnpj(clinic.cnpj ?? "");
      setAddress(clinic.address as ClinicAddress);
      setServices(clinic.services ?? []);
      setSlug(clinic.slug ?? "");
    }
  });

  // Sync when clinic data changes
  if (clinic && name === "" && clinic.name) {
    setName(clinic.name);
    setCnpj(clinic.cnpj ?? "");
    setAddress(clinic.address as ClinicAddress);
    setServices(clinic.services ?? []);
    setSlug(clinic.slug ?? nameToSlug(clinic.name));
  }

  const publicUrl = slug.length >= 2 && typeof window !== "undefined"
    ? `${window.location.origin}/fila-espera/${slug}`
    : null;

  const isSlugSaved = !!clinic?.slug && clinic.slug === slug;

  const handleCopySlugUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setSlugCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setSlugCopied(false), 2000);
  };

  const mutation = useMutation({
    mutationFn: async () =>
      updateClinic({
        data: {
          clinicId: clinic!.id,
          patch: {
            name:     name.trim(),
            cnpj:     cnpj.trim() || undefined,
            address,
            services,
            slug:     slug.trim() || undefined,
          },
        },
        headers: await authHeaders(),
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Não foi possível salvar. Tente novamente.");
        return;
      }
      toast.success("Configurações salvas.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      qc.invalidateQueries({ queryKey: ["myClinic"] });
    },
    onError: () => toast.error("Não foi possível salvar. Tente novamente."),
  });

  const toggleService = (s: string) => {
    setServices(
      services.includes(s) ? services.filter((x) => x !== s) : [...services, s],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!clinic) return;
    mutation.mutate();
  };

  if (clinicQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!clinic) return null;

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações da clínica</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clinic.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Section: Dados da clínica */}
        <div
          className="bg-white rounded-xl p-6 flex flex-col gap-5"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Building2 size={16} color="#4F46E5" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Dados da clínica</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-name" className="text-sm font-medium text-gray-700">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                id="cfg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                maxLength={120}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-cnpj" className="text-sm font-medium text-gray-700">
                CNPJ <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                id="cfg-cnpj"
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                disabled={!canEdit}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Section: Link público — Form 1 */}
        <div
          className="bg-white rounded-xl p-6 flex flex-col gap-5"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Link2 size={16} color="#16A34A" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Link público (Form 1)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Compartilhe este link para receber solicitações de vaga na fila de espera</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-slug" className="text-sm font-medium text-gray-700">
              Identificador da clínica (slug)
            </label>
            <p className="text-xs text-gray-400">
              Somente letras minúsculas, números e hífen. Ex: <code className="bg-gray-100 px-1 rounded">clinica-esperanca</code>
            </p>
            <div className="flex items-center gap-0 mt-1">
              <span
                className="px-3 py-2.5 text-sm text-gray-400 rounded-l-lg flex-shrink-0"
                style={{ border: "1px solid #E5E7EB", borderRight: "none", background: "#F9FAFB" }}
              >
                {typeof window !== "undefined" ? window.location.origin : "https://teamotech.online"}/fila-espera/
              </span>
              <input
                id="cfg-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                disabled={!canEdit}
                maxLength={60}
                placeholder="minha-clinica"
                className="flex-1 rounded-r-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            {!clinic?.slug && slug.length >= 2 && (
              <p className="text-xs text-amber-600 mt-1">
                Sugerido a partir do nome da clínica · pode editar
              </p>
            )}
          </div>

          {publicUrl && (
            <>
              {!isSlugSaved && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-amber-700"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
                >
                  <span>⚠</span>
                  Slug ainda não ativo — salve as configurações para ativar este link.
                </div>
              )}
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  background: isSlugSaved ? "#F0FDF4" : "#F9FAFB",
                  border: `1px solid ${isSlugSaved ? "#BBF7D0" : "#E5E7EB"}`,
                }}
              >
                <span
                  className={`text-xs flex-1 truncate font-mono ${isSlugSaved ? "text-green-800" : "text-gray-400"}`}
                >
                  {publicUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopySlugUrl}
                  disabled={!isSlugSaved}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: slugCopied ? "#16A34A" : "white",
                    color: slugCopied ? "white" : "#16A34A",
                    border: `1px solid ${slugCopied ? "#16A34A" : "#86EFAC"}`,
                  }}
                >
                  {slugCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {slugCopied ? "Copiado!" : "Copiar link"}
                </button>
                <a
                  href={isSlugSaved ? publicUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={!isSlugSaved ? (e) => e.preventDefault() : undefined}
                  className={`text-xs font-semibold flex-shrink-0 ${isSlugSaved ? "text-green-700 hover:underline" : "text-gray-300 cursor-not-allowed pointer-events-none"}`}
                >
                  Abrir →
                </a>
              </div>
            </>
          )}

          {!publicUrl && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <span>⚠</span>
              Configure o slug acima e salve para ativar o Form 1 público.
            </p>
          )}
        </div>

        {/* Section: Endereço */}
        <div
          className="bg-white rounded-xl p-6 flex flex-col gap-5"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <MapPin size={16} color="#7C3AED" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Endereço</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label htmlFor="cfg-street" className="text-xs text-gray-500">Logradouro</label>
              <input
                id="cfg-street"
                type="text"
                value={address.street ?? ""}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                disabled={!canEdit}
                placeholder="Rua, Avenida..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-number" className="text-xs text-gray-500">Número</label>
              <input
                id="cfg-number"
                type="text"
                value={address.number ?? ""}
                onChange={(e) => setAddress({ ...address, number: e.target.value })}
                disabled={!canEdit}
                placeholder="123"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-complement" className="text-xs text-gray-500">Complemento</label>
              <input
                id="cfg-complement"
                type="text"
                value={address.complement ?? ""}
                onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                disabled={!canEdit}
                placeholder="Sala 12..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-city" className="text-xs text-gray-500">Cidade</label>
              <input
                id="cfg-city"
                type="text"
                value={address.city ?? ""}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                disabled={!canEdit}
                placeholder="Recife"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cfg-state" className="text-xs text-gray-500">Estado</label>
              <select
                id="cfg-state"
                value={address.state ?? ""}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                disabled={!canEdit}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors bg-white disabled:bg-gray-50"
              >
                <option value="">Selecione</option>
                {BR_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section: Modalidades */}
        <div
          className="bg-white rounded-xl p-6 flex flex-col gap-5"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <h2 className="text-sm font-semibold text-gray-900">Modalidades oferecidas</h2>
          <div className="flex flex-col gap-2">
            {CLINIC_SERVICES.map((service) => {
              const selected = services.includes(service);
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => canEdit && toggleService(service)}
                  disabled={!canEdit}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all disabled:opacity-60"
                  style={{
                    border: `1.5px solid ${selected ? "#4F46E5" : "#E5E7EB"}`,
                    background: selected ? "#EEF2FF" : "#FAFAFA",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      borderColor: selected ? "#4F46E5" : "#D1D5DB",
                      background: selected ? "#4F46E5" : "white",
                    }}
                  >
                    {selected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
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

        {/* Save button */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: saved ? "#16A34A" : "#4F46E5" }}
            >
              {mutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" />Salvando...</>
              ) : saved ? (
                <><CheckCircle2 size={15} />Salvo!</>
              ) : (
                <><Save size={15} />Salvar alterações</>
              )}
            </button>
          </div>
        )}

        {!canEdit && (
          <p className="text-sm text-center text-gray-400">
            Somente coordenadores podem editar as configurações da clínica.
          </p>
        )}
      </form>
    </div>
  );
}
