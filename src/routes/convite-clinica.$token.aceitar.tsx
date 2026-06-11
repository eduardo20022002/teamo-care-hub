import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2, CheckCircle2, XCircle, Clock, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getClinicInviteServer, acceptClinicInviteServer } from "@/lib/clinic.functions";
import { authHeaders } from "@/lib/auth-headers";
import { CLINIC_MEMBER_ROLE_LABELS } from "@/types/clinic";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const HEADER_GRADIENT = "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)";

export const Route = createFileRoute("/convite-clinica/$token/aceitar")({
  head: () => ({
    meta: [{ title: "Aceitar convite — TEAmo Clínica" }],
  }),
  component: AcceptClinicInvitePage,
});

function AcceptClinicInvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const getInvite    = useServerFn(getClinicInviteServer);
  const acceptInvite = useServerFn(acceptClinicInviteServer);

  // Load invite info
  const inviteQuery = useQuery({
    queryKey: ["clinicInvite", token],
    queryFn: async () => getInvite({ data: { token }, headers: await authHeaders() }),
    enabled: !!user && !loading,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => acceptInvite({ data: { token }, headers: await authHeaders() }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error || "Não foi possível aceitar o convite. Tente novamente.");
        return;
      }
      setAccepted(true);
      toast.success("Convite aceito com sucesso!");
    },
    onError: () => toast.error("Não foi possível aceitar o convite. Tente novamente."),
  });

  // Store token for post-login redirect
  useEffect(() => {
    if (!loading && !user) {
      try {
        sessionStorage.setItem("teamo:pendingClinicInvite", token);
      } catch { /* ok */ }
    }
  }, [loading, user, token]);

  // If user just logged in and has a pending clinic invite, auto-accept
  useEffect(() => {
    if (!user || loading) return;
    const pending = typeof window !== "undefined"
      ? sessionStorage.getItem("teamo:pendingClinicInvite")
      : null;
    if (pending === token) {
      try { sessionStorage.removeItem("teamo:pendingClinicInvite"); } catch { /* ok */ }
    }
  }, [user, loading, token]);

  if (loading) return <LoadingSpinner label="Carregando..." />;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#F6F7FB" }}>
        <header
          className="flex items-center px-6 gap-3 shrink-0"
          style={{ height: 56, background: HEADER_GRADIENT }}
        >
          <Building2 size={20} color="white" />
          <span className="text-white font-bold text-base">TEAmo Clínica</span>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-8 flex flex-col items-center gap-5 text-center"
            style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
              <Building2 size={28} color="#4F46E5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Você foi convidado!</h2>
              <p className="text-sm text-gray-500 mt-1.5">
                Faça login ou crie uma conta para aceitar o convite para a clínica.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Link
                to="/login"
                search={{ clinicInvite: token }}
                className="flex items-center justify-center w-full px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Entrar na minha conta
              </Link>
              <Link
                to="/cadastro"
                className="flex items-center justify-center w-full px-5 py-2.5 rounded-lg border border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold transition-colors"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inviteData = inviteQuery.data;
  const isLoading  = inviteQuery.isLoading;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F6F7FB" }}>
      <header
        className="flex items-center px-6 gap-3 shrink-0"
        style={{ height: 56, background: HEADER_GRADIENT }}
      >
        <Building2 size={20} color="white" />
        <span className="text-white font-bold text-base">TEAmo Clínica</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-sm bg-white rounded-2xl p-8 flex flex-col items-center gap-5 text-center"
          style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
        >
          {isLoading ? (
            <>
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <p className="text-sm text-gray-500">Verificando convite...</p>
            </>
          ) : accepted ? (
            <>
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={32} color="#16A34A" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Convite aceito!</h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  Você agora é membro de{" "}
                  <strong>{inviteData?.clinicName ?? "a clínica"}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/clinica" })}
                className="w-full px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Ir para a clínica
              </button>
            </>
          ) : inviteData?.expired ? (
            <>
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock size={32} color="#D97706" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Convite expirado</h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  Este convite não é mais válido. Solicite um novo convite ao coordenador da clínica.
                </p>
              </div>
            </>
          ) : inviteData?.used ? (
            <>
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={32} color="#16A34A" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Convite já utilizado</h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  Este convite já foi aceito. Você já é membro da clínica.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/clinica" })}
                className="w-full px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Ir para a clínica
              </button>
            </>
          ) : !inviteData?.invite ? (
            <>
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle size={32} color="#DC2626" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Convite não encontrado</h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  O link de convite é inválido ou não existe. Verifique o link e tente novamente.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
                <Building2 size={32} color="#4F46E5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Convite para {inviteData.clinicName}
                </h2>
                <p className="text-sm text-gray-500 mt-1.5">
                  Você foi convidado como{" "}
                  <strong className="text-gray-700">
                    {CLINIC_MEMBER_ROLE_LABELS[inviteData.invite.role]}
                  </strong>.
                </p>
              </div>

              {acceptMutation.isError && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-700 w-full"
                  style={{ background: "#FEF2F2", border: "0.5px solid #FCA5A5" }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  Não foi possível aceitar. Tente novamente.
                </div>
              )}

              <button
                type="button"
                disabled={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
                className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {acceptMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" />Aceitando...</>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Aceitar convite
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400">
                Ao aceitar, você confirma que pertence a esta clínica.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
