/**
 * PatientDashboard — exibe o dashboard de evolução terapêutica de um paciente.
 * Usado pelo terapeuta (evolucao_.$childId) e pelos pais (meu-terapeuta_.$accessId_.evolucao).
 */
import { useState } from "react";
import {
  Target,
  Trophy,
  CalendarCheck2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import {
  MILESTONE_AREAS,
  MILESTONE_AREA_LABELS,
  MILESTONE_AREA_COLORS,
  MILESTONE_AREA_BG,
} from "@/lib/validation";
import { formatAge, formatDateBR } from "@/lib/formatters";
import type { DashboardData } from "@/services/therapist-dashboard.service";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

const PT_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const ENGAGEMENT_NUMERIC: Record<string, number> = {
  baixo: 1,
  medio: 2,
  alto: 3,
};
const ENGAGEMENT_LABELS: Record<number, string> = {
  1: "Baixo",
  2: "Médio",
  3: "Alto",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthLabel(yyyyMM: string): string {
  const [, mm] = yyyyMM.split("-");
  return PT_MONTHS[(parseInt(mm ?? "1") - 1)] ?? yyyyMM;
}

function formatDayMonth(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Sub-componentes internos ─────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
  color = TEAL,
  bg = TEAL_SOFT,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl border p-4"
      style={{ borderColor: TEAL_BORDER, background: bg }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: color + "20" }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-[22px] font-extrabold leading-none" style={{ color: "#0F172A" }}>
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color }}>
            {sub}
          </p>
        )}
        <p className="mt-1 text-[12px] font-medium" style={{ color: "#6B7280" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 text-[15px] font-extrabold"
      style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
    >
      {children}
    </h2>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border py-8 text-[13px]"
      style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
    >
      {text}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface PatientDashboardProps {
  data: DashboardData;
  isParentView?: boolean;
  onNavigateToMilestones?: () => void;
}

export function PatientDashboard({
  data,
  isParentView = false,
  onNavigateToMilestones,
}: PatientDashboardProps) {
  const [showAllAchieved, setShowAllAchieved] = useState(false);

  // ── Métricas de resumo ────────────────────────────────────────────────────
  const totalMilestones = MILESTONE_AREAS.reduce(
    (acc, a) => acc + data.milestonesByArea[a].total,
    0,
  );
  const achievedMilestonesCount = MILESTONE_AREAS.reduce(
    (acc, a) => acc + data.milestonesByArea[a].atingido,
    0,
  );
  const totalSessions = data.sessionsByMonth.reduce(
    (acc, s) => acc + s.happened + s.missed,
    0,
  );
  const happenedSessions = data.sessionsByMonth.reduce(
    (acc, s) => acc + s.happened,
    0,
  );
  const attendanceRate =
    totalSessions > 0
      ? Math.round((happenedSessions / totalSessions) * 100)
      : null;

  // ── Dados do radar ────────────────────────────────────────────────────────
  const radarData = MILESTONE_AREAS.map((area) => {
    const stats = data.milestonesByArea[area];
    return {
      subject: MILESTONE_AREA_LABELS[area],
      value:
        stats.total > 0
          ? Math.round((stats.atingido / stats.total) * 100)
          : 0,
      atingido: stats.atingido,
      total: stats.total,
    };
  });
  const hasAnyMilestone = totalMilestones > 0;

  // ── Dados do gráfico de barras ─────────────────────────────────────────────
  const barData = data.sessionsByMonth.map((s) => ({
    month: formatMonthLabel(s.month),
    Realizadas: s.happened,
    Faltadas: s.missed,
  }));
  const hasSessionData = data.sessionsByMonth.some(
    (s) => s.happened > 0 || s.missed > 0,
  );

  // ── Dados do gráfico de engajamento ───────────────────────────────────────
  const lineData = data.engagementHistory.map((e) => ({
    date: formatDayMonth(e.date),
    nivel: ENGAGEMENT_NUMERIC[e.level] ?? 2,
    titulo: e.title,
    nivelLabel: e.level === "baixo" ? "Baixo" : e.level === "alto" ? "Alto" : "Médio",
  }));
  const hasEngagement = lineData.length >= 2;

  // ── Linha do tempo de marcos ──────────────────────────────────────────────
  const achievedSlice = showAllAchieved
    ? data.achievedMilestones
    : data.achievedMilestones.slice(0, 5);

  return (
    <div className="flex flex-col gap-7 pb-10">
      {/* ── Header do paciente ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border px-5 py-4"
        style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
      >
        <p
          className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: TEAL }}
        >
          {isParentView ? "Evolução do tratamento" : "Dashboard de evolução"}
        </p>
        <h1
          className="text-[22px] font-extrabold leading-tight"
          style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
        >
          {data.child.name}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
          {formatAge(data.child.birth_date)}
          {!isParentView && (
            <span> · Últimos 6 meses de dados</span>
          )}
        </p>
      </div>

      {/* ── 1. Métricas rápidas ────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Resumo</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<Trophy size={18} strokeWidth={1.7} />}
            label="Marcos atingidos"
            value={`${achievedMilestonesCount}`}
            sub={totalMilestones > 0 ? `de ${totalMilestones} total` : undefined}
          />
          <MetricCard
            icon={<Target size={18} strokeWidth={1.7} />}
            label="Metas atingidas"
            value={`${data.goalStats.achieved}`}
            sub={data.goalStats.total > 0 ? `de ${data.goalStats.total} total` : undefined}
          />
          <MetricCard
            icon={<CalendarCheck2 size={18} strokeWidth={1.7} />}
            label="Sessões realizadas (6m)"
            value={`${happenedSessions}`}
            sub={totalSessions > 0 ? `de ${totalSessions} agendadas` : undefined}
          />
          <MetricCard
            icon={<TrendingUp size={18} strokeWidth={1.7} />}
            label="Comparecimento (6m)"
            value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
            sub={
              attendanceRate !== null
                ? attendanceRate >= 80
                  ? "Ótimo"
                  : attendanceRate >= 60
                  ? "Regular"
                  : "Atenção"
                : "Sem dados"
            }
            color={
              attendanceRate === null
                ? "#9CA3AF"
                : attendanceRate >= 80
                ? "#16A34A"
                : attendanceRate >= 60
                ? "#D97706"
                : "#DC2626"
            }
            bg={
              attendanceRate === null
                ? "#F9FAFB"
                : attendanceRate >= 80
                ? "#F0FDF4"
                : attendanceRate >= 60
                ? "#FFFBEB"
                : "#FFF1F2"
            }
          />
        </div>
      </section>

      {/* ── 2. Radar das 6 áreas ──────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Radar de desenvolvimento</SectionTitle>
          {!isParentView && onNavigateToMilestones && (
            <button
              type="button"
              onClick={onNavigateToMilestones}
              className="flex items-center gap-1 text-[12px] font-semibold"
              style={{ color: TEAL }}
            >
              Ver marcos
              <ExternalLink size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        {!hasAnyMilestone ? (
          <EmptyState
            text={
              isParentView
                ? "Nenhum marco compartilhado ainda."
                : "Nenhum marco criado ainda. Adicione marcos na seção de evolução."
            }
          />
        ) : (
          <>
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
            >
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 16, right: 24, bottom: 8, left: 24 }}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fontSize: 10.5, fill: "#6B7280", fontWeight: 600 }}
                    />
                    <Radar
                      name="Atingido (%)"
                      dataKey="value"
                      stroke={TEAL}
                      fill={TEAL}
                      fillOpacity={0.22}
                      strokeWidth={2}
                    />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => {
                        const { atingido, total } = props.payload ?? {};
                        return [
                          `${value}% (${atingido ?? 0} de ${total ?? 0} marcos)`,
                          "Progresso",
                        ];
                      }}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #E5E7EB",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px]" style={{ color: "#9CA3AF" }}>
              % de marcos atingidos por área de desenvolvimento
            </p>
          </>
        )}
      </section>

      {/* ── 3. Progressão por área ─────────────────────────────────────────── */}
      {hasAnyMilestone && (
        <section>
          <SectionTitle>Progressão por área</SectionTitle>
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            <div className="flex flex-col divide-y divide-[#F3F4F6] px-4 py-3">
              {MILESTONE_AREAS.map((area) => {
                const { total, atingido, em_progresso, pausado } =
                  data.milestonesByArea[area];
                const color = MILESTONE_AREA_COLORS[area];
                const bg = MILESTONE_AREA_BG[area];
                if (total === 0) return null;
                return (
                  <div key={area} className="flex items-center gap-3 py-2.5">
                    {/* Badge da área */}
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-extrabold"
                      style={{ background: bg, color }}
                    >
                      {MILESTONE_AREA_LABELS[area].slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: "#374151" }}
                        >
                          {MILESTONE_AREA_LABELS[area]}
                        </span>
                        <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
                          {atingido}/{total}
                        </span>
                      </div>
                      {/* Barra multi-segmento */}
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                        {atingido > 0 && (
                          <div
                            style={{
                              width: `${(atingido / total) * 100}%`,
                              background: "#16A34A",
                            }}
                          />
                        )}
                        {em_progresso > 0 && (
                          <div
                            style={{
                              width: `${(em_progresso / total) * 100}%`,
                              background: TEAL,
                            }}
                          />
                        )}
                        {pausado > 0 && (
                          <div
                            style={{
                              width: `${(pausado / total) * 100}%`,
                              background: "#D1D5DB",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legenda */}
            <div
              className="flex items-center gap-4 border-t px-4 py-2.5"
              style={{ borderColor: "#F3F4F6" }}
            >
              {[
                { color: "#16A34A", label: "Atingido" },
                { color: TEAL, label: "Em progresso" },
                { color: "#D1D5DB", label: "Pausado" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-[11px]" style={{ color: "#6B7280" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Comparecimento por mês ─────────────────────────────────────── */}
      <section>
        <SectionTitle>Comparecimento às sessões</SectionTitle>
        {!hasSessionData ? (
          <EmptyState text="Nenhuma sessão registrada nos últimos 6 meses." />
        ) : (
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 16, right: 16, left: -8, bottom: 4 }}
                  barCategoryGap="30%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip
                    cursor={{ fill: "#F3F4F6" }}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  <Bar dataKey="Realizadas" fill={TEAL} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Faltadas" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* ── 5. Engajamento nas sessões ────────────────────────────────────── */}
      <section>
        <SectionTitle>Engajamento nas sessões</SectionTitle>
        {!hasEngagement ? (
          <EmptyState text="Dados insuficientes. Registre o engajamento nas sessões para ver o gráfico." />
        ) : (
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineData}
                  margin={{ top: 16, right: 16, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0.5, 3.5]}
                    ticks={[1, 2, 3]}
                    tickFormatter={(v) => ENGAGEMENT_LABELS[v] ?? ""}
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <ReferenceLine y={2} stroke="#E5E7EB" strokeDasharray="4 2" />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [
                      `${ENGAGEMENT_LABELS[value] ?? value}`,
                      props.payload?.titulo ?? "Engajamento",
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #E5E7EB",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="nivel"
                    stroke={TEAL}
                    strokeWidth={2}
                    dot={{ fill: TEAL, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="px-4 pb-3 text-center text-[11px]" style={{ color: "#9CA3AF" }}>
              Nível de engajamento: Baixo · Médio · Alto
            </p>
          </div>
        )}
      </section>

      {/* ── 6. Marcos atingidos — linha do tempo ──────────────────────────── */}
      {data.achievedMilestones.length > 0 && (
        <section>
          <SectionTitle>Marcos atingidos</SectionTitle>
          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
          >
            <ul className="flex flex-col divide-y divide-[#F3F4F6]">
              {achievedSlice.map((m) => {
                const color = MILESTONE_AREA_COLORS[m.area as keyof typeof MILESTONE_AREA_COLORS] ?? TEAL;
                const bg = MILESTONE_AREA_BG[m.area as keyof typeof MILESTONE_AREA_BG] ?? TEAL_SOFT;
                const areaLabel = MILESTONE_AREA_LABELS[m.area as keyof typeof MILESTONE_AREA_LABELS] ?? m.area;
                return (
                  <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                    <div
                      className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13.5px] font-semibold leading-snug"
                        style={{ color: "#0F172A" }}
                      >
                        {m.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                          style={{ background: bg, color }}
                        >
                          {areaLabel}
                        </span>
                        <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
                          {formatDateBR(m.achieved_at)}
                        </span>
                      </div>
                    </div>
                    <Trophy size={14} strokeWidth={1.7} className="mt-0.5 flex-shrink-0" style={{ color: "#F59E0B" }} />
                  </li>
                );
              })}
            </ul>

            {data.achievedMilestones.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllAchieved((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 border-t py-3 text-[12.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
                style={{ borderColor: "#F3F4F6", color: TEAL }}
              >
                {showAllAchieved ? (
                  <>
                    <ChevronUp size={14} strokeWidth={2} />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} strokeWidth={2} />
                    Ver mais ({data.achievedMilestones.length - 5} restantes)
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Estado vazio geral */}
      {!hasAnyMilestone && !hasSessionData && !hasEngagement && (
        <div
          className="rounded-2xl border px-5 py-10 text-center"
          style={{ borderColor: "#E5E7EB" }}
        >
          <TrendingUp size={32} strokeWidth={1.4} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-[14px] font-semibold" style={{ color: "#374151" }}>
            {isParentView
              ? "Ainda não há dados de evolução disponíveis."
              : "Adicione marcos e realize sessões para visualizar o dashboard."}
          </p>
        </div>
      )}
    </div>
  );
}
