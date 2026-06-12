import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Share2,
  MessageSquare,
  Send,
  ExternalLink,
  Clock,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  getParentProfessionalAccessDetailServer,
  listParentProfessionalMessagesServer,
  sendParentProfessionalMessageServer,
} from "@/lib/parent-professional.functions";
import { useAuth } from "@/hooks/useAuth";
import { formatAge } from "@/lib/formatters";
import { buildPublicShareUrl } from "@/services/sharing.service";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/acompanhamentos_/$accessId")({
  head: () => ({ meta: [{ title: "Acompanhamento — TEAmo" }] }),
  component: AcompanhamentoDetailPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function AcompanhamentoDetailPage() {
  const { accessId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"content" | "messages">("content");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const detailQuery = useQuery({
    queryKey: ["parent-professional-detail", accessId],
    queryFn: () => getParentProfessionalAccessDetailServer({ data: { accessId } }),
    enabled: !!user,
  });

  const messagesQuery = useQuery({
    queryKey: ["parent-professional-messages", accessId],
    queryFn: () => listParentProfessionalMessagesServer({ data: { accessId } }),
    enabled: !!user && activeTab === "messages",
    refetchInterval: activeTab === "messages" ? 15000 : false,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      sendParentProfessionalMessageServer({ data: { accessId, content } }),
    onSuccess: () => {
      setMessageText("");
      qc.invalidateQueries({ queryKey: ["parent-professional-messages", accessId] });
      qc.invalidateQueries({ queryKey: ["my-parent-accesses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQuery.data]);

  const detail = detailQuery.data;

  if (detailQuery.isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Loader2 size={28} color={TEAL} className="animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell>
        <div className="flex flex-col items-center py-16 text-center gap-3">
          <p className="text-muted-foreground">Acompanhamento não encontrado.</p>
          <Link to="/acompanhamentos" className="text-sm font-medium text-primary hover:underline">
            Voltar à lista
          </Link>
        </div>
      </AppShell>
    );
  }

  const firstName = detail.childName.split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto max-w-[520px]">
        {/* Back */}
        <div className="mb-5">
          <Link
            to="/acompanhamentos"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Acompanhamentos
          </Link>
        </div>

        {/* Child card */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-5 flex items-center gap-3"
          style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
            style={{ background: TEAL_BORDER, color: TEAL }}
          >
            {detail.childName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[17px] font-extrabold text-[#0F172A] leading-tight">
              {detail.childName}
            </p>
            <p className="text-[13px] text-[#6B7280]">
              Família {detail.parentName}
              {detail.birthDate ? ` · ${formatAge(detail.birthDate)}` : ""}
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mb-5 flex gap-1 rounded-xl bg-[#F3F4F8] p-1">
          {(["content", "messages"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 text-sm font-semibold transition-colors"
              style={
                activeTab === tab
                  ? {
                      background: "#fff",
                      color: "#0F172A",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                    }
                  : { color: "#6B7280" }
              }
            >
              {tab === "content" ? (
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {tab === "content" ? "Conteúdo" : "Recados"}
            </button>
          ))}
        </div>

        {/* Content tab */}
        {activeTab === "content" && (
          detail.shares.length === 0 ? (
            <div
              className="flex flex-col items-center rounded-[20px] p-8 text-center"
              style={{ background: TEAL_SOFT, border: `1px solid ${TEAL_BORDER}` }}
            >
              <div
                className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-[18px]"
                style={{ background: TEAL_BORDER }}
              >
                <Share2 size={26} strokeWidth={1.6} color={TEAL} />
              </div>
              <h3 className="text-[16px] font-bold text-[#0F172A]">
                Nenhum conteúdo compartilhado
              </h3>
              <p className="mt-1 text-sm text-[#6B7280]">
                A família {detail.parentName} ainda não criou compartilhamentos ativos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {detail.shares.length} {detail.shares.length === 1 ? "link ativo" : "links ativos"}
              </p>
              {detail.shares.map((s: any) => (
                <a
                  key={s.id}
                  href={buildPublicShareUrl(s.link_token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[#EEF0F4] bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0F172A]">
                      <Share2 size={13} strokeWidth={1.75} color={TEAL} />
                      Compartilhamento de {firstName}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                      <Clock size={10} strokeWidth={1.75} />
                      Expira {formatDateTime(s.expires_at)}
                    </p>
                  </div>
                  <ExternalLink size={16} strokeWidth={1.75} className="flex-shrink-0 text-muted-foreground" />
                </a>
              ))}
              <p className="text-[11px] text-[#9CA3AF] text-center pt-1">
                O link pode pedir um código de 6 dígitos enviado por e-mail para confirmar o acesso.
              </p>
            </div>
          )
        )}

        {/* Messages tab */}
        {activeTab === "messages" && (
          <div className="flex flex-col gap-4">
            {messagesQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} color={TEAL} className="animate-spin" />
              </div>
            ) : (messagesQuery.data?.messages ?? []).length === 0 ? (
              <div
                className="flex flex-col items-center rounded-[20px] p-8 text-center"
                style={{ background: TEAL_SOFT, border: `1px solid ${TEAL_BORDER}` }}
              >
                <div
                  className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-[18px]"
                  style={{ background: TEAL_BORDER }}
                >
                  <MessageSquare size={26} strokeWidth={1.6} color={TEAL} />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A]">Sem recados ainda</h3>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Envie um recado para a família {detail.parentName} sobre {firstName}.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto px-1 pb-1">
                {(messagesQuery.data?.messages ?? []).map((m: any) => {
                  const isMe = m.author_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className="max-w-[80%] rounded-2xl px-4 py-2.5"
                        style={
                          isMe
                            ? { background: TEAL, color: "#fff" }
                            : { background: "#F3F4F8", color: "#0F172A" }
                        }
                      >
                        {!isMe && (
                          <p className="text-[11px] font-semibold mb-0.5" style={{ color: TEAL }}>
                            {detail.parentName}
                          </p>
                        )}
                        <p className="text-[14px] leading-relaxed break-words">{m.content}</p>
                        <p
                          className="text-[10px] mt-1"
                          style={{ color: isMe ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}
                        >
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="flex items-end gap-2 pt-2 border-t border-[#EEF0F4]">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (messageText.trim()) sendMessage.mutate(messageText.trim());
                  }
                }}
                placeholder={`Escrever recado para a família ${detail.parentName}…`}
                rows={2}
                maxLength={1000}
                className="flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
              />
              <button
                type="button"
                onClick={() => {
                  if (messageText.trim()) sendMessage.mutate(messageText.trim());
                }}
                disabled={!messageText.trim() || sendMessage.isPending}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
                style={{ background: TEAL }}
              >
                {sendMessage.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
