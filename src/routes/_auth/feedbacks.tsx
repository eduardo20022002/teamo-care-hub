import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { listFeedbackServer } from "@/lib/feedback.functions";
import type { FeedbackItem } from "@/lib/feedback.functions";

export const Route = createFileRoute("/_auth/feedbacks")({
  head: () => ({ meta: [{ title: "Feedbacks — TEAmo" }] }),
  component: FeedbacksPage,
});

const RATING_INFO: Record<1 | 2 | 3, { emoji: string; label: string; color: string; tint: string }> = {
  1: { emoji: "😔", label: "Difícil",   color: "#E11D48", tint: "#FFE4E6" },
  2: { emoji: "😊", label: "Ok",        color: "#D97706", tint: "#FEF3C7" },
  3: { emoji: "🤩", label: "Incrível",  color: "#16A34A", tint: "#DCFCE7" },
};

function formatDateBR(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const info = RATING_INFO[item.rating];
  return (
    <div
      className="rounded-[18px] border bg-white p-4"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
    >
      <div className="flex items-start gap-3">
        {/* Rating chip */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold flex-shrink-0"
          style={{ background: info.tint, color: info.color }}
        >
          {info.emoji} {info.label}
        </span>

        <div className="min-w-0 flex-1">
          {/* E-mail + data */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
            <span className="text-sm font-medium text-[#212529] truncate">{item.userEmail}</span>
            <span className="text-[11px] text-[#9CA3AF]">{formatDateBR(item.createdAt)}</span>
          </div>

          {/* Mensagem */}
          {item.message ? (
            <p className="text-sm text-[#4B5563] leading-relaxed">{item.message}</p>
          ) : (
            <p className="text-sm text-[#9CA3AF] italic">Sem mensagem.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbacksPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-feedbacks"],
    queryFn: () => listFeedbackServer(),
    retry: false,
  });

  // Acesso negado (403 ou não-admin)
  const isForbidden =
    error instanceof Error &&
    (error.message.includes("403") || error.message.toLowerCase().includes("proibido"));

  if (isForbidden) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">🔒</span>
          <h1 className="text-lg font-semibold text-[#212529] mb-1">Acesso restrito</h1>
          <p className="text-sm text-[#6B7280]">Esta página é exclusiva para administradores.</p>
        </div>
      </AppShell>
    );
  }

  const items = data?.items ?? [];

  // Contadores por rating
  const counts = items.reduce(
    (acc, item) => { acc[item.rating] = (acc[item.rating] ?? 0) + 1; return acc; },
    {} as Partial<Record<1 | 2 | 3, number>>,
  );

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#212529]">Feedbacks</h1>
        <p className="text-sm text-[#6B7280]">Visível apenas para administradores.</p>
      </div>

      {/* Resumo */}
      {items.length > 0 && (
        <div className="mb-6 flex gap-3 flex-wrap">
          {([1, 2, 3] as const).map((r) => {
            const info = RATING_INFO[r];
            const count = counts[r] ?? 0;
            if (!count) return null;
            return (
              <div
                key={r}
                className="flex items-center gap-2 rounded-[12px] px-3 py-2"
                style={{ background: info.tint }}
              >
                <span className="text-xl">{info.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: info.color }}>
                  {count} {info.label}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 rounded-[12px] bg-[#F4F5FA] px-3 py-2">
            <span className="text-sm font-semibold text-[#6B7280]">{items.length} total</span>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">💬</span>
          <h2 className="text-base font-semibold text-[#212529] mb-1">Nenhum feedback ainda</h2>
          <p className="text-sm text-[#6B7280]">Quando os usuários enviarem, aparecerão aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
