import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Users2, Clock, MapPin, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/auth-headers";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { listGroupsServer, createGroupServer } from "@/lib/clinic-groups.functions";
import { listClinicRoomsServer as listRoomsServer } from "@/lib/clinic-agenda.functions";
import type { ClinicGroup } from "@/types/clinic-groups";
import { GROUP_STATUS_LABELS, GROUP_STATUS_COLORS, DAY_NAMES_SHORT } from "@/types/clinic-groups";

export const Route = createFileRoute("/_auth/clinica/grupos")({
  head: () => ({ meta: [{ title: "Grupos ABA — Clínica TEAmo" }] }),
  component: ClinicGruposPage,
});

const VBMAPP_LEVELS = [1, 2, 3];
const DAY_BUTTONS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];
const AGE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18];

function GroupCard({ group }: { group: ClinicGroup }) {
  const statusColor = GROUP_STATUS_COLORS[group.status];
  const activeCount = group.member_count ?? 0;
  const initials = (name: string) => name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const memberColors = ["bg-indigo-100 text-indigo-700", "bg-pink-100 text-pink-700", "bg-green-100 text-green-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700", "bg-blue-100 text-blue-700"];

  const scheduleText = (() => {
    const dayName = DAY_NAMES_SHORT[group.day_of_week] ?? "—";
    const time = group.start_time.slice(0, 5);
    return `${dayName} · ${time}h`;
  })();

  return (
    <div className="bg-white rounded-xl p-5 flex flex-col gap-4" style={{ border: "0.5px solid #E5E7EB" }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}` }}
        >
          {GROUP_STATUS_LABELS[group.status]}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-indigo-100 inline-flex items-center justify-center text-indigo-600 font-bold text-[8px]">
            {(group.therapist_name ?? "—")[0]}
          </span>
          {group.therapist_name}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={11} />
          {scheduleText}
          <MapPin size={11} className="ml-1" />
          {group.room_name}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {Array.from({ length: activeCount }).map((_, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${memberColors[i % memberColors.length]} ring-2 ring-white`}
            >
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
        <span className="text-xs font-semibold text-gray-500">
          {activeCount}/{group.capacity_max}
        </span>
      </div>

      {group.status !== "encerrado" && activeCount < group.capacity_max && (
        <div className="text-xs text-indigo-600 font-medium">
          {group.capacity_max - activeCount} vaga{group.capacity_max - activeCount !== 1 ? "s" : ""} disponível
        </div>
      )}

      <Link
        to="/clinica/grupos/$groupId"
        params={{ groupId: group.id }}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
        style={{ border: "1px solid #C7D2FE" }}
      >
        Gerenciar grupo
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

interface CreateGroupForm {
  name: string;
  therapistUserId: string;
  roomId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  capacityMax: number;
  vbmappLevelMin: number;
  vbmappLevelMax: number;
  ageMin: number;
  ageMax: number;
  allowFactorB: boolean;
}

const DEFAULT_FORM: CreateGroupForm = {
  name: "",
  therapistUserId: "",
  roomId: "",
  dayOfWeek: 1,
  startTime: "10:00",
  durationMinutes: 60,
  capacityMax: 4,
  vbmappLevelMin: 1,
  vbmappLevelMax: 2,
  ageMin: 3,
  ageMax: 7,
  allowFactorB: false,
};

function ClinicGruposPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateGroupForm>(DEFAULT_FORM);

  const getClinic = useServerFn(getMyClinicServer);
  const listGroups = useServerFn(listGroupsServer);
  const createGroup = useServerFn(createGroupServer);
  const listRooms = useServerFn(listRoomsServer);

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const clinicId = clinicQuery.data?.clinic?.id ?? "";

  const groupsQuery = useQuery({
    queryKey: ["clinicGroups", clinicId],
    queryFn: async () => listGroups({ data: { clinicId }, headers: await authHeaders() }),
    enabled: !!clinicId,
    staleTime: 15_000,
  });

  const roomsQuery = useQuery({
    queryKey: ["clinicRooms", clinicId],
    queryFn: async () => listRooms({ data: { clinicId }, headers: await authHeaders() }),
    enabled: !!clinicId && showCreateModal,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      createGroup({
        data: {
          clinicId,
          name:             form.name,
          therapistUserId:  form.therapistUserId || user!.id,
          roomId:           form.roomId,
          dayOfWeek:        form.dayOfWeek,
          startTime:        form.startTime,
          durationMinutes:  form.durationMinutes,
          capacityMax:      form.capacityMax,
          matchingCriteria: {
            vbmapp_level_min: form.vbmappLevelMin,
            vbmapp_level_max: form.vbmappLevelMax,
            age_min:          form.ageMin,
            age_max:          form.ageMax,
            allow_factor_b:   form.allowFactorB,
          },
        },
        headers: await authHeaders(),
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error || "Erro ao criar grupo"); return; }
      toast.success("Grupo criado com sucesso!");
      void queryClient.invalidateQueries({ queryKey: ["clinicGroups"] });
      setShowCreateModal(false);
      setForm(DEFAULT_FORM);
    },
  });

  const groups: ClinicGroup[] = groupsQuery.data?.ok ? groupsQuery.data.groups : [];
  const ativos = groups.filter((g) => g.status === "ativo").length;
  const formando = groups.filter((g) => g.status === "formando").length;

  const rooms = roomsQuery.data?.ok ? roomsQuery.data.rooms : [];

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Grupos ABA</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {ativos > 0 || formando > 0
              ? `${ativos} ativo${ativos !== 1 ? "s" : ""} · ${formando} formando`
              : "Composição de grupos, matching e gestão de vagas"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} />
          Criar novo grupo
        </button>
      </div>

      {/* Grid de grupos */}
      {groupsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          Carregando grupos...
        </div>
      ) : groups.length === 0 ? (
        <div
          className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <Users2 size={28} color="#4F46E5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nenhum grupo criado</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Crie o primeiro grupo ABA da clínica para começar a gerenciar composições com matching automático por nível VB-MAPP, faixa etária e Fator B.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            Criar primeiro grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {/* Modal: Criar novo grupo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Criar novo grupo ABA</h2>
              <p className="text-sm text-gray-500 mt-0.5">Configure o grupo e os critérios de admissão</p>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Nome e terapeuta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-700">Nome do grupo</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Grupo Manhã 2026-A"
                    className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-700">Sala</label>
                  <select
                    value={form.roomId}
                    onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                    className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">Selecionar sala</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Capacidade */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">Capacidade máxima</label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5, 6].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, capacityMax: cap }))}
                      className={[
                        "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                        form.capacityMax === cap
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-200 text-gray-700 hover:border-indigo-300",
                      ].join(" ")}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade horária */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700">Grade horária</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DAY_BUTTONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, dayOfWeek: day.value }))}
                      className={[
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        form.dayOfWeek === day.value
                          ? "bg-indigo-600 text-white"
                          : "border border-gray-200 text-gray-700 hover:border-indigo-300",
                      ].join(" ")}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-40"
                />
              </div>

              {/* Critérios de admissão */}
              <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Critérios de admissão</span>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-700">Nível VB-MAPP permitido</label>
                  <div className="flex items-center gap-2">
                    {VBMAPP_LEVELS.map((lvl) => {
                      const inRange = lvl >= form.vbmappLevelMin && lvl <= form.vbmappLevelMax;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            if (inRange) {
                              // toggle off
                              if (form.vbmappLevelMin === lvl && form.vbmappLevelMax === lvl) return;
                              if (form.vbmappLevelMin === lvl) setForm((f) => ({ ...f, vbmappLevelMin: lvl + 1 }));
                              else setForm((f) => ({ ...f, vbmappLevelMax: lvl - 1 }));
                            } else {
                              // expand range
                              if (lvl < form.vbmappLevelMin) setForm((f) => ({ ...f, vbmappLevelMin: lvl }));
                              else setForm((f) => ({ ...f, vbmappLevelMax: lvl }));
                            }
                          }}
                          className={[
                            "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            inRange
                              ? "bg-indigo-600 text-white"
                              : "border border-gray-200 text-gray-500 hover:border-indigo-300",
                          ].join(" ")}
                        >
                          Nível {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-700">Faixa etária — de</label>
                    <select
                      value={form.ageMin}
                      onChange={(e) => setForm((f) => ({ ...f, ageMin: Number(e.target.value) }))}
                      className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {AGE_OPTIONS.filter((a) => a <= form.ageMax).map((a) => (
                        <option key={a} value={a}>{a} anos</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-700">até</label>
                    <select
                      value={form.ageMax}
                      onChange={(e) => setForm((f) => ({ ...f, ageMax: Number(e.target.value) }))}
                      className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {AGE_OPTIONS.filter((a) => a >= form.ageMin).map((a) => (
                        <option key={a} value={a}>{a} anos</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-gray-700">Permitir Fator B ativo</span>
                    <span className="text-[10px] text-gray-400">Comportamento-desafio grave presente</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, allowFactorB: !f.allowFactorB }))}
                    className={[
                      "relative w-10 h-5 rounded-full transition-colors",
                      form.allowFactorB ? "bg-indigo-600" : "bg-gray-200",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        form.allowFactorB ? "translate-x-5" : "translate-x-0.5",
                      ].join(" ")}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowCreateModal(false); setForm(DEFAULT_FORM); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!form.name || !form.roomId || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? "Criando..." : "Criar grupo e ver candidatos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
