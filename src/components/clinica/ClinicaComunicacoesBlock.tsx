// Bloco de histórico de comunicações reutilizável na ficha do paciente (Fase 6)
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { authHeaders } from "@/lib/auth-headers";
import { listPatientCommunicationsServer } from "@/lib/clinic-communication.functions";
import {
  COMM_TYPE_LABELS,
  COMM_STATUS_LABELS,
  COMM_STATUS_CLASSES,
  COMM_TYPE_CLASSES,
  type ClinicCommunication,
  type CommStatus,
} from "@/types/clinic-communication";

interface Props {
  clinicId: string;
  patientProfileId: string;
}

function StatusIcon({ status }: { status: CommStatus }) {
  if (status === "confirmado")     return <CheckCircle2 size={13} className="text-green-600" />;
  if (status === "sem_resposta")   return <AlertCircle size={13} className="text-yellow-600" />;
  if (status === "prazo_expirado") return <XCircle size={13} className="text-red-600" />;
  return <Clock size={13} className="text-blue-500" />;
}

function formatDateTimeBR(iso: string): string {
  try {
    const d = new Date(iso);
    const day   = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year  = d.getFullYear();
    const h     = String(d.getHours()).padStart(2, "0");
    const min   = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${h}:${min}`;
  } catch {
    return iso;
  }
}

function CommRow({ comm }: { comm: ClinicCommunication }) {
  const typeClass  = COMM_TYPE_CLASSES[comm.comm_type]    ?? "bg-gray-100 text-gray-700";
  const statusClass = COMM_STATUS_CLASSES[comm.status]   ?? "bg-gray-50 text-gray-500";

  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
      <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
        <div>{formatDateTimeBR(comm.sent_at)}</div>
      </td>
      <td className="py-3 px-3">
        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${typeClass}`}>
          {COMM_TYPE_LABELS[comm.comm_type]}
        </span>
      </td>
      <td className="py-3 px-3 text-xs text-gray-500 hidden sm:table-cell">
        E-mail
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <StatusIcon status={comm.status} />
          <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusClass}`}>
            {COMM_STATUS_LABELS[comm.status]}
          </span>
          {comm.status === "confirmado" && comm.confirmed_at && (
            <span className="text-[10px] text-gray-400 hidden lg:inline">
              em {formatDateTimeBR(comm.confirmed_at)}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ClinicaComunicacoesBlock({ clinicId, patientProfileId }: Props) {
  const listComms = useServerFn(listPatientCommunicationsServer);

  const query = useQuery({
    queryKey: ["patient-communications", clinicId, patientProfileId],
    queryFn: async () =>
      listComms({ data: { clinicId, patientProfileId }, headers: await authHeaders() }),
    staleTime: 30_000,
  });

  const comms = query.data?.ok ? query.data.communications : [];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900">Comunicações com a família</h3>
        </div>
        {query.isLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : comms.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <MessageSquare size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">Nenhuma comunicação registrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Data / Hora
                </th>
                <th className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Tipo
                </th>
                <th className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                  Canal
                </th>
                <th className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {comms.map((c) => (
                <CommRow key={c.id} comm={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
