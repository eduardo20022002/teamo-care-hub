import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Link2,
  Mail,
  RefreshCcw,
  Search,
  Share2,
  Stethoscope,
  TrendingUp,
  Users,
  WifiOff,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getBusinessHealthServer,
  getUserBehaviorServer,
  getTechnicalHealthServer,
  listCaregiversServer,
  listTherapistsServer,
  getDiagnosticsStatsServer,
} from "@/lib/analytics.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import type {
  BusinessHealthData,
  UserBehaviorData,
  TechnicalHealthData,
  UserListRow,
  DiagnosticStat,
} from "@/server/analytics.server";

export const Route = createFileRoute("/_auth/painel")({
  head: () => ({ meta: [{ title: "Painel Admin — TEAmo" }] }),
  component: PainelPage,
});

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#EEF1FF]">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
        <p className="text-xs text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent = "#4F46E5",
  tint = "#EEF1FF",
  icon,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  tint?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const cls =
    "rounded-2xl border bg-white p-4 text-left w-full transition-all" +
    (onClick ? " cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "");
  const inner = (
    <>
      <div className="mb-2 flex items-center gap-2">
        {icon && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: tint }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#6B7280]">{sub}</p>}
      {onClick && (
        <p className="mt-1.5 text-[10px] font-medium text-primary opacity-70">Ver lista →</p>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
    >
      {inner}
    </button>
  ) : (
    <div
      className={cls}
      style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
    >
      {inner}
    </div>
  );
}

function UserListDialog({
  open,
  onOpenChange,
  title,
  list,
  isLoading,
  icon,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  list: UserListRow[];
  isLoading: boolean;
  icon: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const filtered = list.filter(
    (u) =>
      !search ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title} <span className="ml-1 text-sm font-normal text-[#9CA3AF]">({list.length})</span>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" strokeWidth={1.75} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F6F7FB] pl-9 pr-4 text-sm outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,70,229,0.10)]"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#9CA3AF]">
            {search ? "Nenhum resultado para a busca." : "Nenhum usuário cadastrado."}
          </p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[#F1F2F6] rounded-xl border border-[#EEF0F4]">
            {filtered.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0F172A]">
                    {u.full_name || <span className="italic text-[#9CA3AF]">Sem nome</span>}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-[#6B7280]">
                    <Mail className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    {u.email || "—"}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-[#9CA3AF]">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GrowthChip({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return <span className="text-xs text-[#9CA3AF]">—</span>;
  const pct = Math.round(((current - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: up ? "#DCFCE7" : "#FFE4E6",
        color: up ? "#15803D" : "#E11D48",
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#4B5563]">{label}</span>
        <span className="font-semibold text-[#0F172A]">
          {value} <span className="font-normal text-[#9CA3AF]">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F2F6]">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

const MODULE_LABELS: Record<string, string> = {
  registros: "Registros",
  documentos: "Documentos",
  agenda: "Agenda",
  profissionais: "Profissionais",
  compartilhamento: "Compartilhamento",
};
const MODULE_COLORS: Record<string, string> = {
  registros: "#D97706",
  documentos: "#4F46E5",
  agenda: "#EC4899",
  profissionais: "#16A34A",
  compartilhamento: "#7C3AED",
};

// ─── Seção 1: Saúde Técnica ───────────────────────────────────────────────────

function TechnicalHealthSection({ data }: { data: TechnicalHealthData }) {
  const statusColors = {
    operational: { bg: "#DCFCE7", text: "#15803D", dot: "#16A34A", label: "Operacional" },
    degraded: { bg: "#FEF3C7", text: "#92400E", dot: "#D97706", label: "Degradado" },
    unknown: { bg: "#F4F5FA", text: "#6B7280", dot: "#9CA3AF", label: "Desconhecido" },
  };
  const sColor = statusColors[data.supabaseStatus];

  return (
    <section className="mb-10">
      <SectionHeader
        icon={<Activity className="h-5 w-5 text-[#4F46E5]" strokeWidth={1.75} />}
        title="Saúde Técnica"
        subtitle="Erros, Web Vitals e disponibilidade — últimos 7 dias"
      />

      {/* Status Supabase */}
      <div
        className="mb-4 flex items-center gap-3 rounded-2xl border p-4"
        style={{ background: sColor.bg, borderColor: sColor.dot + "33" }}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: sColor.dot, boxShadow: `0 0 0 3px ${sColor.dot}33` }}
        />
        <div>
          <p className="text-sm font-semibold" style={{ color: sColor.text }}>
            Supabase — {sColor.label}
          </p>
          <p className="text-xs" style={{ color: sColor.text + "CC" }}>
            status.supabase.com verificado agora
          </p>
        </div>
      </div>

      {/* Web Vitals */}
      {data.webVitals.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Web Vitals — p75
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.webVitals.map((v) => {
              const thresholds: Record<string, [number, number]> = {
                LCP: [2500, 4000],
                INP: [200, 500],
                CLS: [0.1, 0.25],
              };
              const [good, poor] = thresholds[v.metric] ?? [0, 0];
              const color =
                v.p75 <= good ? "#16A34A" : v.p75 <= poor ? "#D97706" : "#E11D48";
              return (
                <div
                  key={`${v.route}-${v.metric}`}
                  className="rounded-xl border bg-white p-3"
                  style={{ borderColor: "#EEF0F4" }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
                    {v.metric}
                  </p>
                  <p className="text-lg font-bold text-[#0F172A]">
                    {v.p75}
                    <span className="ml-0.5 text-xs font-normal text-[#9CA3AF]">{v.unit}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[#9CA3AF]">{v.route}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Erros JS */}
      {data.jsErrors.length > 0 ? (
        <div className="mb-4 rounded-2xl border bg-white" style={{ borderColor: "#EEF0F4" }}>
          <div className="border-b px-4 py-3" style={{ borderColor: "#EEF0F4" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Erros JavaScript — por rota
            </p>
          </div>
          {data.jsErrors.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
              style={{ borderColor: "#F1F2F6" }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#E11D48]" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#0F172A]">{e.route ?? "(sem rota)"}</p>
                <p className="truncate text-[11px] text-[#6B7280]">{e.message ?? "—"}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#FFE4E6] px-2 py-0.5 text-xs font-semibold text-[#E11D48]">
                {e.count}×
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border bg-[#DCFCE7] p-4" style={{ borderColor: "#BBF7D0" }}>
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#16A34A]" strokeWidth={1.75} />
          <p className="text-sm font-medium text-[#15803D]">Nenhum erro JS nos últimos 7 dias.</p>
        </div>
      )}

      {/* Taxa de erro por tipo */}
      {data.errorRate.length > 0 && (
        <div className="mt-4 rounded-2xl border bg-white" style={{ borderColor: "#EEF0F4" }}>
          <div className="border-b px-4 py-3" style={{ borderColor: "#EEF0F4" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Tipos de erro — 7d vs 24h
            </p>
          </div>
          {data.errorRate.map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b px-4 py-3 last:border-0"
              style={{ borderColor: "#F1F2F6" }}
            >
              <span className="text-xs font-medium text-[#4B5563]">{e.event_type}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#9CA3AF]">7d: <strong className="text-[#0F172A]">{e.count}</strong></span>
                <span className="text-xs text-[#9CA3AF]">24h: <strong className="text-[#E11D48]">{e.last24h}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Seção 2: Comportamento dos Usuários ────────────────────────────────────

function UserBehaviorSection({ data }: { data: UserBehaviorData }) {
  const maxModule = Math.max(...data.moduleAdoption.map((m) => m.opens), 1);
  const allZero =
    data.moduleAdoption.every((m) => m.opens === 0 && m.actions === 0) &&
    data.topEvents.length === 0;

  return (
    <section className="mb-10">
      <SectionHeader
        icon={<BarChart2 className="h-5 w-5 text-[#4F46E5]" strokeWidth={1.75} />}
        title="Comportamento dos Usuários"
        subtitle="Adoção de módulos e funis — últimos 30 dias"
      />

      {allZero && (
        <div className="mb-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#E5E7EB] p-6 text-center">
          <BarChart2 className="h-8 w-8 text-[#D1D5DB]" strokeWidth={1.5} />
          <p className="text-sm font-medium text-[#6B7280]">Nenhum dado de uso nos últimos 30 dias.</p>
          <p className="text-xs text-[#9CA3AF]">Os dados acumulam conforme o app for utilizado pelos usuários.</p>
        </div>
      )}

      {/* Adoção por módulo */}
      <div className="mb-4 rounded-2xl border bg-white" style={{ borderColor: "#EEF0F4" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "#EEF0F4" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Adoção por módulo
          </p>
        </div>
        <div className="space-y-4 px-4 py-4">
          {data.moduleAdoption.map((m) => (
            <div key={m.module}>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="text-xs font-semibold"
                  style={{ color: MODULE_COLORS[m.module] ?? "#4F46E5" }}
                >
                  {MODULE_LABELS[m.module] ?? m.module}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {m.opens} aberturas · {m.actions} ações
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F2F6]">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.round((m.opens / maxModule) * 100)}%`,
                    background: MODULE_COLORS[m.module] ?? "#4F46E5",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Funil de compartilhamento OTP */}
      <div className="mb-4 rounded-2xl border bg-white" style={{ borderColor: "#EEF0F4" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "#EEF0F4" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Funil de compartilhamento OTP
          </p>
        </div>
        <div className="space-y-3 px-4 py-4">
          <FunnelBar label="Links criados" value={data.otpFunnel.created} total={data.otpFunnel.created} color="#7C3AED" />
          <FunnelBar label="OTP solicitado" value={data.otpFunnel.otpRequested} total={data.otpFunnel.created} color="#4F46E5" />
          <FunnelBar label="OTP validado (acesso concluído)" value={data.otpFunnel.otpSucceeded} total={data.otpFunnel.created} color="#16A34A" />
          <FunnelBar label="Expirados sem acesso" value={data.otpFunnel.expiredUnused} total={data.otpFunnel.created} color="#E11D48" />
        </div>
      </div>

      {/* Top eventos */}
      {data.topEvents.length > 0 && (
        <div className="rounded-2xl border bg-white" style={{ borderColor: "#EEF0F4" }}>
          <div className="border-b px-4 py-3" style={{ borderColor: "#EEF0F4" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Eventos mais frequentes
            </p>
          </div>
          {data.topEvents.slice(0, 8).map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b px-4 py-2.5 last:border-0"
              style={{ borderColor: "#F1F2F6" }}
            >
              <span className="text-xs font-medium text-[#4B5563]">{e.event_type}</span>
              <span className="text-xs font-semibold text-[#0F172A]">{e.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Seção 3: Saúde do Negócio ──────────────────────────────────────────────

function BusinessHealthSection({
  data,
  onCaregiversClick,
  onTherapistsClick,
}: {
  data: BusinessHealthData;
  onCaregiversClick: () => void;
  onTherapistsClick: () => void;
}) {
  const stickiness =
    data.activity.mau > 0
      ? Math.round((data.activity.dau / data.activity.mau) * 100)
      : 0;

  return (
    <section className="mb-10">
      <SectionHeader
        icon={<TrendingUp className="h-5 w-5 text-[#4F46E5]" strokeWidth={1.75} />}
        title="Saúde do Negócio"
        subtitle="Crescimento, atividade e volume acumulado"
      />

      {/* Totais */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
        Totais acumulados
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Cuidadores"
          value={data.totals.caregivers}
          icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
          accent="#4F46E5"
          tint="#EEF1FF"
          onClick={onCaregiversClick}
        />
        <MetricCard
          label="Profissionais"
          value={data.totals.professionals}
          icon={<Stethoscope className="h-4 w-4" strokeWidth={1.75} />}
          accent="#16A34A"
          tint="#DCFCE7"
          onClick={onTherapistsClick}
        />
        <MetricCard
          label="Crianças"
          value={data.totals.children}
          icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
          accent="#EC4899"
          tint="#FDF2F8"
        />
        <MetricCard
          label="Vínculos ativos"
          value={data.links.childrenWithProfessional}
          icon={<Link2 className="h-4 w-4" strokeWidth={1.75} />}
          accent="#7C3AED"
          tint="#F3E8FF"
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Registros"
          value={data.totals.records}
          icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
          accent="#D97706"
          tint="#FEF3C7"
        />
        <MetricCard
          label="Documentos"
          value={data.totals.documents}
          icon={<Layers className="h-4 w-4" strokeWidth={1.75} />}
          accent="#4F46E5"
          tint="#EEF1FF"
        />
        <MetricCard
          label="Eventos agenda"
          value={data.totals.events}
          icon={<Clock className="h-4 w-4" strokeWidth={1.75} />}
          accent="#EC4899"
          tint="#FDF2F8"
        />
        <MetricCard
          label="Links OTP"
          value={data.totals.shares}
          icon={<Share2 className="h-4 w-4" strokeWidth={1.75} />}
          accent="#7C3AED"
          tint="#F3E8FF"
        />
      </div>

      {/* Convites pendentes */}
      {data.links.pendingInvites > 0 && (
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl border p-4"
          style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}
        >
          <Mail className="h-5 w-5 shrink-0 text-[#D97706]" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">
              {data.links.pendingInvites} {data.links.pendingInvites === 1 ? "convite pendente" : "convites pendentes"} de compartilhamento
            </p>
            <p className="text-xs text-[#6B7280]">Aguardando aceite pelo co-cuidador</p>
          </div>
        </div>
      )}

      {/* DAU / WAU / MAU */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
        Usuários ativos
      </p>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <MetricCard label="DAU" value={data.activity.dau} sub="Últimas 24h" />
        <MetricCard label="WAU" value={data.activity.wau} sub="Últimos 7 dias" />
        <MetricCard label="MAU" value={data.activity.mau} sub="Últimos 30 dias" />
      </div>
      <div
        className="mb-4 flex items-center justify-between rounded-2xl border bg-white p-4"
        style={{ borderColor: "#EEF0F4" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Stickiness (DAU/MAU)</p>
          <p className="mt-1 text-2xl font-bold text-[#0F172A]">{stickiness}%</p>
        </div>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-base font-bold"
          style={{
            background: stickiness >= 20 ? "#DCFCE7" : stickiness >= 10 ? "#FEF3C7" : "#FFE4E6",
            color: stickiness >= 20 ? "#15803D" : stickiness >= 10 ? "#92400E" : "#E11D48",
          }}
        >
          {stickiness}%
        </div>
      </div>

      {/* Crescimento */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
        Crescimento de cuidadores
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "#EEF0F4" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Esta semana</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-bold text-[#0F172A]">{data.growth.caregiversThisWeek}</p>
            <GrowthChip current={data.growth.caregiversThisWeek} prev={data.growth.caregiversLastWeek} />
          </div>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">vs. semana anterior: {data.growth.caregiversLastWeek}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "#EEF0F4" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Este mês</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-bold text-[#0F172A]">{data.growth.caregiversThisMonth}</p>
            <GrowthChip current={data.growth.caregiversThisMonth} prev={data.growth.caregiversLastMonth} />
          </div>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">vs. mês anterior: {data.growth.caregiversLastMonth}</p>
        </div>
      </div>

      {/* Churn */}
      <div
        className="flex items-center gap-3 rounded-2xl border p-4"
        style={{
          borderColor: data.churn.inactiveOver30d > 0 ? "#FECDD3" : "#EEF0F4",
          background: data.churn.inactiveOver30d > 0 ? "#FFF1F2" : "#F8FAFF",
        }}
      >
        {data.churn.inactiveOver30d > 0 ? (
          <WifiOff className="h-5 w-5 shrink-0 text-[#E11D48]" strokeWidth={1.75} />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#16A34A]" strokeWidth={1.75} />
        )}
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">
            {data.churn.inactiveOver30d} {data.churn.inactiveOver30d === 1 ? "usuário inativo" : "usuários inativos"} há +30 dias
          </p>
          <p className="text-xs text-[#6B7280]">Sem nenhuma sessão nos últimos 30 dias</p>
        </div>
      </div>
    </section>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function PainelPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Dialog state
  const [caregiversOpen, setCaregiversOpen] = useState(false);
  const [therapistsOpen, setTherapistsOpen] = useState(false);

  // Verificação de admin: busca is_admin do perfil
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["painel-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Guard: redirect se não for admin
  useEffect(() => {
    if (!profileLoading && profile !== undefined && !profile?.is_admin) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, profileLoading, navigate]);

  // Helper: obtém cabeçalhos de auth para ServerFns
  const getAuthHeaders = async () => {
    const { data } = await supabaseClient.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: businessData, isLoading: bizLoading, refetch: refetchBiz } = useQuery({
    queryKey: ["admin-business-health"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      return getBusinessHealthServer({ headers } as any);
    },
    enabled: !!profile?.is_admin,
    staleTime: 60_000,
    retry: false,
  });

  const { data: behaviorData, isLoading: behaviorLoading, refetch: refetchBehavior } = useQuery({
    queryKey: ["admin-user-behavior"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      return getUserBehaviorServer({ headers } as any);
    },
    enabled: !!profile?.is_admin,
    staleTime: 60_000,
    retry: false,
  });

  const { data: techData, isLoading: techLoading, refetch: refetchTech } = useQuery({
    queryKey: ["admin-technical-health"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      return getTechnicalHealthServer({ headers } as any);
    },
    enabled: !!profile?.is_admin,
    staleTime: 60_000,
    retry: false,
  });

  // Queries lazy — só carregam quando os dialogs são abertos
  const { data: caregiversList = [], isLoading: caregiversLoading } = useQuery({
    queryKey: ["admin-caregivers"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      return listCaregiversServer({ headers } as any);
    },
    enabled: !!profile?.is_admin && caregiversOpen,
    staleTime: 60_000,
    retry: false,
  });

  const { data: therapistsList = [], isLoading: therapistsLoading } = useQuery({
    queryKey: ["admin-therapists"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      return listTherapistsServer({ headers } as any);
    },
    enabled: !!profile?.is_admin && therapistsOpen,
    staleTime: 60_000,
    retry: false,
  });

  const { data: diagnosticsStats = [] } = useQuery<DiagnosticStat[]>({
    queryKey: ["admin-diagnostics-stats"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      return getDiagnosticsStatsServer({ headers } as any);
    },
    enabled: !!profile?.is_admin,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const isLoading = profileLoading || bizLoading || behaviorLoading || techLoading;

  const handleRefresh = () => {
    void refetchBiz();
    void refetchBehavior();
    void refetchTech();
  };

  if (profileLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      </AppShell>
    );
  }

  if (!profile?.is_admin) {
    return null; // redirect em andamento
  }

  const maxDiag = Math.max(...diagnosticsStats.map((d) => d.count), 1);

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Painel</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Observabilidade · visível apenas para administradores
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} strokeWidth={1.75} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {techData && <TechnicalHealthSection data={techData} />}
          {behaviorData && <UserBehaviorSection data={behaviorData} />}
          {businessData && (
            <BusinessHealthSection
              data={businessData}
              onCaregiversClick={() => setCaregiversOpen(true)}
              onTherapistsClick={() => setTherapistsOpen(true)}
            />
          )}

          {/* Diagnósticos mais informados */}
          {diagnosticsStats.length > 0 && (
            <section className="mb-10">
              <SectionHeader
                icon={<Activity className="h-5 w-5 text-[#4F46E5]" strokeWidth={1.75} />}
                title="Diagnósticos mais informados"
                subtitle="Comorbidades registradas pelos responsáveis no onboarding"
              />
              <div className="rounded-2xl border bg-white" style={{ borderColor: "#EEF0F4" }}>
                <div className="space-y-4 px-4 py-4">
                  {diagnosticsStats.map((d) => (
                    <div key={d.diagnosis}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold capitalize text-[#374151]">
                          {d.diagnosis.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF]">{d.count} {d.count === 1 ? "criança" : "crianças"}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F2F6]">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.round((d.count / maxDiag) * 100)}%`,
                            background: "#7C3AED",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Dialogs de listagem */}
      <UserListDialog
        open={caregiversOpen}
        onOpenChange={setCaregiversOpen}
        title="Cuidadores cadastrados"
        list={caregiversList as UserListRow[]}
        isLoading={caregiversLoading}
        icon={<Users className="h-4 w-4 text-[#4F46E5]" strokeWidth={1.75} />}
      />
      <UserListDialog
        open={therapistsOpen}
        onOpenChange={setTherapistsOpen}
        title="Profissionais cadastrados"
        list={therapistsList as UserListRow[]}
        isLoading={therapistsLoading}
        icon={<Stethoscope className="h-4 w-4 text-[#16A34A]" strokeWidth={1.75} />}
      />
    </AppShell>
  );
}
