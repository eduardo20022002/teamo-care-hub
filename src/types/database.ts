import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Child = Tables<"children">;
export type ChildInsert = TablesInsert<"children">;
export type AuditLog = Tables<"audit_logs">;

export type AuthEventType =
  | "auth.signup_success"
  | "auth.login_success"
  | "auth.login_failure"
  | "auth.logout"
  | "auth.session_expired";
