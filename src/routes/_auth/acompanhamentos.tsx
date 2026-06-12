import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, Loader2, MessageSquare, Share2, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { listMyParentInvitedChildrenServer } from "@/lib/parent-professional.functions";
import { useAuth } from "@/hooks/useAuth";
import { formatAge } from "@/lib/formatters";

export const Route = createFileRoute("/_auth/acompanhamentos")({
  head: () => ({ meta: [{ title: "Acompanhamentos — TEAmo" }] }),
  component: AcompanhamentosPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

function AcompanhamentosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-parent-accesses"],
    queryFn: () => listMyParentInvitedChildrenServer({ data: {} }),
    enabled: !!user,
  });

  const items = data?.items ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-[520px]">
        {/* Back */}
        <div className="mb-5">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar ao início
          </Link>
        </div>

        {/* Header */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-6 flex items-start gap-3"
          style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: TEAL_BORDER }}
          >
            <Users size={20} strokeWidth={1.7} color={TEAL} />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#0F172A] leading-tight">
              Acompanhamentos
            </h1>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Famílias que te convidaram para acompanhar o desenvolvimento de suas crianças.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} color={TEAL} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div
            className="flex flex-col items-center rounded-[20px] p-8 text-center"
            style={{ background: TEAL_SOFT, border: `1px solid ${TEAL_BORDER}` }}
          >
            <div
              className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[22px]"
              style={{ background: TEAL_BORDER }}
            >
              <Users size={32} strokeWidth={1.6} color={TEAL} />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              Nenhuma família te convidou ainda
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-[#6B7280]">
              Quando uma família te convidar pelo TEAmo, a criança aparecerá aqui para você
              acompanhar registros e trocar recados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.accessId}
                type="button"
                onClick={() =>
                  navigate({ to: "/acompanhamentos/$accessId" as any, params: { accessId: item.accessId } })
                }
                className="w-full rounded-[16px] border border-[#EEF0F4] bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
                    style={{ background: TEAL_SOFT, color: TEAL }}
                  >
                    {item.childName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[16px] font-bold text-[#0F172A] truncate">
                        {item.childName}
                      </p>
                      <ChevronRight size={18} className="flex-shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <p className="text-[13px] text-[#6B7280]">
                      Família {item.parentName}
                      {item.birthDate ? ` · ${formatAge(item.birthDate)}` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-[12px] text-[#6B7280]">
                        <Share2 size={12} strokeWidth={1.75} />
                        {item.sharesCount} {item.sharesCount === 1 ? "compartilhamento" : "compartilhamentos"}
                      </span>
                      {item.unreadCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ background: TEAL }}
                        >
                          <MessageSquare size={11} strokeWidth={2} />
                          {item.unreadCount} {item.unreadCount === 1 ? "recado" : "recados"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
