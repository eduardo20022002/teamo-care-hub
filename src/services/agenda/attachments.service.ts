import { supabase } from "@/integrations/supabase/client";
import type { AgendaObservationAttachment } from "@/types/agenda";

const BUCKET = "attachments";
const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

// MIME types específicos pra observações (mais permissivo que record_attachments
// porque inclui áudio e vídeo, conforme a UI de "Foto / Áudio / Arquivo").
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

const MAX_BYTES = 10 * 1024 * 1024;

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
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const slug =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "arquivo";
  return ext ? `${slug}.${ext}` : slug;
}

function buildPath(
  userId: string,
  observationId: string,
  fileName: string,
): string {
  const safeName = slugifyName(fileName);
  const uid =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `agenda-observations/${userId}/${observationId}/${uid}-${safeName}`;
}

function kindForMime(mime: string): AgendaObservationAttachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

export function validateObservationFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
    return {
      ok: false,
      error: "Formato não suportado. Use foto, áudio, vídeo ou PDF.",
    };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Arquivo acima do limite de 10 MB." };
  }
  return { ok: true };
}

export async function listObservationAttachments(
  observationId: string,
): Promise<AgendaObservationAttachment[]> {
  if (DEV_BYPASS) return [];
  const { data, error } = await supabase
    .from("agenda_observation_attachments")
    .select("*")
    .eq("observation_id", observationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as AgendaObservationAttachment[];
}

export async function uploadObservationAttachment(
  userId: string,
  observationId: string,
  file: File,
  durationSeconds?: number,
): Promise<AgendaObservationAttachment> {
  if (DEV_BYPASS) {
    throw new Error(
      "Modo preview: anexos não são persistidos sem sessão real.",
    );
  }
  const validation = validateObservationFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const storagePath = buildPath(userId, observationId, file.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(mapError(upErr.message));

  const payload = {
    user_id: userId,
    observation_id: observationId,
    storage_path: storagePath,
    filename: file.name,
    size_bytes: file.size,
    mime_type: file.type,
    kind: kindForMime(file.type),
    duration_seconds: durationSeconds ?? null,
  };

  const { data, error } = await supabase
    .from("agenda_observation_attachments")
    .insert(payload)
    .select()
    .single();

  if (error) {
    // best-effort cleanup
    try {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    } catch {
      /* noop */
    }
    throw new Error(mapError(error.message));
  }
  return data as unknown as AgendaObservationAttachment;
}

export async function deleteObservationAttachment(
  attachment: Pick<AgendaObservationAttachment, "id" | "storage_path">,
): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
  } catch {
    /* noop */
  }
  const { error } = await supabase
    .from("agenda_observation_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw new Error(mapError(error.message));
}
