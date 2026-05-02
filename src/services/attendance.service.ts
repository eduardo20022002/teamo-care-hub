import { supabase } from "@/integrations/supabase/client";
import type {
  AttendanceRecord,
  AttendanceRecordInsert,
  AttendanceRecordUpdate,
} from "@/types/database";
import type { AttendanceRecordInput } from "@/lib/validation";

export interface AttendanceRecordWithRelations extends AttendanceRecord {
  child: { id: string; name: string } | null;
  professional: { id: string; name: string } | null;
}

const SELECT_WITH_RELATIONS =
  "*, child:children(id, name), professional:professionals(id, name)";

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function listAttendanceRecords(): Promise<
  AttendanceRecordWithRelations[]
> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select(SELECT_WITH_RELATIONS)
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
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", id);
  if (error) throw new Error(mapError(error.message));
}
