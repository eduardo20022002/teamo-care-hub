import { Bell, X } from "lucide-react";
import { AGENDA_BRAND, ALERT_TONE, TYPE_STYLES } from "@/lib/agenda/tokens";
import { TypeIcon } from "./icons";
import type { AgendaEventType } from "@/types/agenda";

type NotifTone = "neutral" | "sage" | "warm" | "rose";

interface NotifItem {
  id: string;
  time: string; // ex.: "agora" / "14:00" / "ontem 18:30"
  title: string;
  body: string;
  tone: NotifTone;
  type?: AgendaEventType;
  cta?: string;
  onCta?: () => void;
  group: "Hoje" | "Ontem" | "Mais antigas";
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: NotifItem[];
  onMarkAllRead?: () => void;
}

const TONE_TINTS: Record<NotifTone, { tint: string; icon: string }> = {
  neutral: { tint: "#F4F5FA", icon: "#6B7280" },
  sage: { tint: AGENDA_BRAND.tint, icon: AGENDA_BRAND.col },
  warm: { tint: ALERT_TONE.background, icon: ALERT_TONE.bodyColor },
  rose: { tint: "#FDF2F8", icon: "#EC4899" },
};

export function NotificationsDrawer({
  open,
  onClose,
  items,
  onMarkAllRead,
}: Props) {
  if (!open) return null;
  const grouped: Record<"Hoje" | "Ontem" | "Mais antigas", NotifItem[]> = {
    Hoje: [],
    Ontem: [],
    "Mais antigas": [],
  };
  items.forEach((it) => grouped[it.group].push(it));

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-drawer-title"
        className="absolute left-0 right-0 top-0 flex max-h-[88vh] flex-col rounded-b-3xl bg-white px-4 pb-[18px] pt-3 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[9px]"
              style={{ background: AGENDA_BRAND.tint }}
            >
              <Bell size={16} strokeWidth={1.7} color={AGENDA_BRAND.col} />
            </div>
            <h2
              id="notif-drawer-title"
              className="text-[17px] font-extrabold"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              Notificações
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {onMarkAllRead && items.length > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="bg-transparent px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:underline"
                style={{ color: AGENDA_BRAND.col }}
              >
                Marcar como vistas
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar drawer"
              className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#F4F5FA] transition-colors hover:bg-[#E5E7EB]"
            >
              <X size={16} strokeWidth={2} color="#6B7280" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-1">
          {items.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
              style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
            >
              Sem notificações por ora.
            </div>
          ) : (
            (["Hoje", "Ontem", "Mais antigas"] as const).map((g) =>
              grouped[g].length > 0 ? (
                <div key={g} className="flex flex-col gap-2.5">
                  <div
                    className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: "#9CA3AF" }}
                  >
                    {g}
                  </div>
                  {grouped[g].map((it) => {
                    const tones = TONE_TINTS[it.tone];
                    return (
                      <div
                        key={it.id}
                        className="flex gap-3 rounded-2xl border bg-white p-3.5"
                        style={{ borderColor: "#EEF0F4" }}
                      >
                        <div
                          className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
                          style={{ background: tones.tint }}
                        >
                          {it.type ? (
                            <TypeIcon
                              type={it.type}
                              size={18}
                              color={TYPE_STYLES[it.type].col}
                            />
                          ) : (
                            <Bell
                              size={18}
                              strokeWidth={1.7}
                              color={tones.icon}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div
                              className="text-[13.5px] font-extrabold"
                              style={{
                                color: "#0F172A",
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {it.title}
                            </div>
                            <div
                              className="flex-shrink-0 text-[11px] font-semibold"
                              style={{ color: "#9CA3AF" }}
                            >
                              {it.time}
                            </div>
                          </div>
                          <div
                            className="mt-1 text-[12.5px] leading-snug"
                            style={{ color: "#6B7280" }}
                          >
                            {it.body}
                          </div>
                          {it.cta && (
                            <button
                              type="button"
                              onClick={() => {
                                it.onCta?.();
                                onClose();
                              }}
                              className="mt-2.5 inline-flex h-8 items-center rounded-[9px] px-3 text-[12px] font-bold text-white transition-transform hover:-translate-y-px"
                              style={{ background: tones.icon }}
                            >
                              {it.cta}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null,
            )
          )}
        </div>
      </div>
    </div>
  );
}
