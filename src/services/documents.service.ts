import { supabase } from "@/integrations/supabase/client";
import {
  deleteChildAttachment,
  deleteRecordAttachment,
  uploadChildAttachment,
} from "./attachments.service";
import type { ChildAttachment, RecordAttachment } from "@/types/database";

export type DocumentSource = "child" | "record";

export interface UnifiedDocument {
  id: string;
  source: DocumentSource;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  child_id: string;
  child_name: string;
  record_id?: string;
  record_category?: string;
  record_date?: string;
}

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

type ChildAttachmentRow = ChildAttachment & {
  child: { id: string; name: string } | null;
};

type RecordAttachmentRow = RecordAttachment & {
  record:
    | {
        id: string;
        category: string;
        record_date: string;
        child: { id: string; name: string } | null;
      }
    | null;
};

export async function listAllDocuments(): Promise<UnifiedDocument[]> {
  const [childRes, recordRes] = await Promise.all([
    supabase
      .from("child_attachments")
      .select("*, child:children(id, name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("record_attachments")
      .select(
        "*, record:attendance_records(id, category, record_date, child:children(id, name))",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (childRes.error) throw new Error(mapError(childRes.error.message));
  if (recordRes.error) throw new Error(mapError(recordRes.error.message));

  const childDocs: UnifiedDocument[] = ((childRes.data ?? []) as unknown as ChildAttachmentRow[])
    .filter((row) => !!row.child)
    .map((row) => ({
      id: row.id,
      source: "child" as const,
      storage_path: row.storage_path,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
      child_id: row.child_id,
      child_name: row.child!.name,
    }));

  const recordDocs: UnifiedDocument[] = ((recordRes.data ?? []) as unknown as RecordAttachmentRow[])
    .filter((row) => !!row.record && !!row.record.child)
    .map((row) => ({
      id: row.id,
      source: "record" as const,
      storage_path: row.storage_path,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
      child_id: row.record!.child!.id,
      child_name: row.record!.child!.name,
      record_id: row.record!.id,
      record_category: row.record!.category,
      record_date: row.record!.record_date,
    }));

  return [...childDocs, ...recordDocs].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}

export async function deleteUnifiedDocument(doc: UnifiedDocument): Promise<void> {
  if (doc.source === "child") {
    await deleteChildAttachment({ id: doc.id, storage_path: doc.storage_path });
  } else {
    await deleteRecordAttachment({ id: doc.id, storage_path: doc.storage_path });
  }
}

export async function addChildDocuments(
  userId: string,
  childId: string,
  files: File[],
): Promise<{ success: number; failed: { name: string; error: string }[] }> {
  let success = 0;
  const failed: { name: string; error: string }[] = [];
  for (const file of files) {
    try {
      await uploadChildAttachment(userId, childId, file);
      success++;
    } catch (e) {
      failed.push({ name: file.name, error: (e as Error).message });
    }
  }
  return { success, failed };
}

/** Normaliza string para busca: lower-case + remove acentos. */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
