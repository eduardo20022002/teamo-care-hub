import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Child = Tables<"children">;
export type ChildInsert = TablesInsert<"children">;
export type AuditLog = Tables<"audit_logs">;
export type Professional = Tables<"professionals">;
export type ProfessionalInsert = TablesInsert<"professionals">;
export type ProfessionalUpdate = TablesUpdate<"professionals">;
export type AttendanceRecord = Tables<"attendance_records">;
export type AttendanceRecordInsert = TablesInsert<"attendance_records">;
export type AttendanceRecordUpdate = TablesUpdate<"attendance_records">;
export type AttendanceCategory =
  | "orientacao"
  | "observacao_clinica"
  | "conduta"
  | "evolucao";

export type AuthEventType =
  | "auth.signup_success"
  | "auth.login_success"
  | "auth.login_failure"
  | "auth.logout"
  | "auth.session_expired";
