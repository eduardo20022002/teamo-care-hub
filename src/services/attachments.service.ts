import { supabase } from "@/integrations/supabase/client";
import { validateAttachmentFileAsync } from "@/lib/validation";
import type {
  ChildAttachment,
  ChildAttachmentInsert,
  RecordAttachment,
  RecordAttachmentInsert,
} from "@/types/database";

const BUCKET = "attachments";

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  if (/exceeded the maximum allowed size|payload too large/i.test(message)) {
    return "Arquivo acima do limite de 10 MB.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

function slugifyName(name: string): string {
  // Preserva extensão; normaliza o restante para chars seguros
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "arquivo";
  return ext ? `${slug}.${ext}` : slug;
}

function buildPath(
  scope: "records" | "children",
  userId: string,
  parentId: string,
  fileName: string,
): string {
  const safeName = slugifyName(fileName);
  const uid = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return `${scope}/${userId}/${parentId}/${uid}-${safeName}`;
}

// ===== Listagem =====

export async function listRecordAttachments(
  recordId: string,
): Promise<RecordAttachment[]> {
  const { data, error } = await supabase
    .from("record_attachments")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return data ?? [];
}

export async function listChildAttachments(
  childId: string,
): Promise<ChildAttachment[]> {
  const { data, error } = await supabase
    .from("child_attachments")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return data ?? [];
}

// ===== Contagem (para mostrar no card) =====

export async function countRecordAttachments(recordId: string): Promise<number> {
  const { count, error } = await supabase
    .from("record_attachments")
    .select("id", { count: "exact", head: true })
    .eq("record_id", recordId);
  if (error) throw new Error(mapError(error.message));
  return count ?? 0;
}

// ===== Upload =====

async function uploadToBucket(
  storagePath: string,
  file: File,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(mapError(error.message));
}

async function removeFromBucket(storagePath: string): Promise<void> {
  // Best-effort: não joga erro pra cima para não esconder o erro principal
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch {
    /* noop */
  }
}

export async function uploadRecordAttachment(
  userId: string,
  recordId: string,
  file: File,
): Promise<RecordAttachment> {
  const validation = await validateAttachmentFileAsync(file);
  if (!validation.ok) throw new Error(validation.error);

  const storagePath = buildPath("records", userId, recordId, file.name);
  await uploadToBucket(storagePath, file);

  const payload: RecordAttachmentInsert = {
    user_id: userId,
    record_id: recordId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };

  const { data, error } = await supabase
    .from("record_attachments")
    .insert(payload)
    .select()
    .single();

  if (error) {
    await removeFromBucket(storagePath);
    throw new Error(mapError(error.message));
  }
  return data;
}

export async function uploadChildAttachment(
  userId: string,
  childId: string,
  file: File,
  title?: string,
): Promise<ChildAttachment> {
  const validation = await validateAttachmentFileAsync(file);
  if (!validation.ok) throw new Error(validation.error);

  const storagePath = buildPath("children", userId, childId, file.name);
  await uploadToBucket(storagePath, file);

  const payload: ChildAttachmentInsert = {
    user_id: userId,
    child_id: childId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    ...(title?.trim() ? { title: title.trim() } : {}),
  };

  const { data, error } = await supabase
    .from("child_attachments")
    .insert(payload)
    .select()
    .single();

  if (error) {
    await removeFromBucket(storagePath);
    throw new Error(mapError(error.message));
  }
  return data;
}

// ===== Exclusão =====

export async function deleteRecordAttachment(
  attachment: Pick<RecordAttachment, "id" | "storage_path">,
): Promise<void> {
  await removeFromBucket(attachment.storage_path);
  const { error } = await supabase
    .from("record_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw new Error(mapError(error.message));
}

export async function deleteChildAttachment(
  attachment: Pick<ChildAttachment, "id" | "storage_path">,
): Promise<void> {
  await removeFromBucket(attachment.storage_path);
  const { error } = await supabase
    .from("child_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw new Error(mapError(error.message));
}

// ===== Exclusão em cascata: todos os anexos de um registro =====

export async function deleteAllRecordAttachments(
  recordId: string,
): Promise<void> {
  const { data: rows, error: selError } = await supabase
    .from("record_attachments")
    .select("storage_path")
    .eq("record_id", recordId);
  if (selError) throw new Error(mapError(selError.message));

  const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);

  if (paths.length > 0) {
    // Best-effort: falha no Storage não bloqueia limpeza no banco
    try {
      await supabase.storage.from(BUCKET).remove(paths);
    } catch {
      /* noop */
    }
  }

  const { error: delError } = await supabase
    .from("record_attachments")
    .delete()
    .eq("record_id", recordId);
  if (delError) throw new Error(mapError(delError.message));
}

// ===== URL assinada para visualizar/baixar =====

export async function getAttachmentSignedUrl(
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(mapError(error?.message ?? "Erro ao gerar link."));
  }
  return data.signedUrl;
}
