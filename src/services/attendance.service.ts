import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  AttendanceRecord,
  AttendanceRecordInsert,
  AttendanceRecordUpdate,
} from "@/types/database";
import type {
  AttendanceRecordInput,
  DiaryRecordInput,
  RecordType,
  RecordShift,
} from "@/lib/validation";
import { deleteAllRecordAttachments } from "./attachments.service";

export interface AttendanceRecordWithRelations extends AttendanceRecord {
  child: { id: string; name: string } | null;
  professional: { id: string; name: string } | null;
}

/** Extended type that includes the new diary fields (added via migration). */
export interface DiaryRecordWithRelations extends AttendanceRecordWithRelations {
  record_type: RecordType | null;
  shift: RecordShift | null;
  title: string | null;
  type_data: Json;
}

const SELECT_WITH_RELATIONS =
  "*, child:children(id, name), professional:professionals(id, name)";

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function listAttendanceRecords(opts?: {
  from?: string;
  to?: string;
}): Promise<AttendanceRecordWithRelations[]> {
  const now = new Date();
  const from =
    opts?.from ??
    new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  const to = opts?.to ?? now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance_records")
    .select(SELECT_WITH_RELATIONS)
    .is("record_type", null)
    .gte("record_date", from)
    .lte("record_date", to)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as AttendanceRecordWithRelations[];
}

function toPayload(input: AttendanceRecordInput) {
  return {
    child_id: input.child_id,
    professional_id: input.professional_id ?? null,
    professional_name: input.professional_name.trim(),
    category: input.category,
    content: input.content.trim(),
    record_date: input.record_date,
  };
}

export async function createAttendanceRecord(
  userId: string,
  input: AttendanceRecordInput,
): Promise<AttendanceRecord> {
  const payload: AttendanceRecordInsert = {
    user_id: userId,
    ...toPayload(input),
  };
  const { data, error } = await supabase
    .from("attendance_records")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data;
}

export async function updateAttendanceRecord(
  id: string,
  input: AttendanceRecordInput,
): Promise<AttendanceRecord> {
  const payload: AttendanceRecordUpdate = toPayload(input);
  const { data, error } = await supabase
    .from("attendance_records")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data;
}

export async function deleteAttendanceRecord(id: string): Promise<void> {
  // Cascata manual: limpa anexos (Storage + tabela) antes de remover o registro
  await deleteAllRecordAttachments(id);
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", id);
  if (error) throw new Error(mapError(error.message));
}

// ───────────────────────────────────────────────
// Diário tipado do cuidador
// ───────────────────────────────────────────────

export async function listDiaryRecords(opts?: {
  from?: string;
  to?: string;
}): Promise<DiaryRecordWithRelations[]> {
  const now = new Date();
  const from =
    opts?.from ??
    new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  const to = opts?.to ?? now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance_records")
    .select(SELECT_WITH_RELATIONS)
    .not("record_type", "is", null)
    .gte("record_date", from)
    .lte("record_date", to)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as DiaryRecordWithRelations[];
}

export async function createDiaryRecord(
  userId: string,
  input: DiaryRecordInput,
): Promise<DiaryRecordWithRelations> {
  const payload = {
    user_id: userId,
    child_id: input.child_id,
    record_type: input.record_type,
    shift: input.shift ?? null,
    title: input.title?.trim() ?? null,
    content: input.content?.trim() ?? "",
    type_data: input.type_data ?? {},
    record_date: input.record_date,
    // legacy required fields — not used in diary mode
    professional_name: "",
    professional_id: null,
    category: "orientacao",
  };
  const { data, error } = await supabase
    .from("attendance_records")
    .insert(payload as unknown as AttendanceRecordInsert)
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw new Error(mapError(error.message));
  return data as unknown as DiaryRecordWithRelations;
}

export async function updateDiaryRecord(
  id: string,
  input: DiaryRecordInput,
): Promise<DiaryRecordWithRelations> {
  const payload = {
    shift: input.shift ?? null,
    title: input.title?.trim() ?? null,
    content: input.content?.trim() ?? "",
    type_data: input.type_data ?? {},
    record_date: input.record_date,
  };
  const { data, error } = await supabase
    .from("attendance_records")
    .update(payload as unknown as AttendanceRecordUpdate)
    .eq("id", id)
    .select(SELECT_WITH_RELATIONS)
    .single();
  if (error) throw new Error(mapError(error.message));
  return data as unknown as DiaryRecordWithRelations;
}
