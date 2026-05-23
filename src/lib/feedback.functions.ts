// Server-only: funções de feedback de usuários.
// Nunca importar diretamente no cliente — apenas via useMutation/useQuery.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "@/server/rate-limit";
import { logger } from "@/lib/logger";

// Destino das notificações de feedback — não é segredo (é o endereço de entrega,
// não uma credencial). Pode ser movido para env var futuramente.
const ADMIN_EMAIL = "eduardo.meirelles@ufpe.br";
const RESEND_FROM = "TEAmo <onboarding@resend.dev>";

const RATING_LABELS: Record<1 | 2 | 3, string> = {
  1: "😔 Difícil",
  2: "😊 Ok",
  3: "🤩 Incrível",
};

// ─── Tipos exportados ────────────────────────────────────────────────────────

export interface FeedbackItem {
  id: string;
  rating: 1 | 2 | 3;
  message: string | null;
  createdAt: string;
  userEmail: string;
}

// ─── Schema de input ─────────────────────────────────────────────────────────

const submitSchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  message: z.string().max(1000).optional(),
});

// ─── Helper: envio de e-mail (fire-and-forget) ───────────────────────────────

async function sendFeedbackNotification(params: {
  userEmail: string;
  rating: 1 | 2 | 3;
  message: string | null;
  createdAt: string;
}): Promise<void> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    logger.error("feedback.email_keys_missing", { failureCode: "missing_env" });
    return;
  }

  const ratingLabel = RATING_LABELS[params.rating];
  const messageHtml = params.message
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;">${escapeHtml(params.message)}</p>`
    : `<p style="margin:0 0 8px;font-size:13px;color:#6C757D;font-style:italic;">Sem mensagem.</p>`;

  const dateBR = new Date(params.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#3B5BDB;">TEAmo</h1>
        <p style="margin:0 0 20px;font-size:12px;color:#6C757D;">Novo feedback recebido</p>

        <div style="display:flex;align-items:center;gap:10px;background:#F4F5FA;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
          <span style="font-size:28px;">${ratingLabel.split(" ")[0]}</span>
          <div>
            <p style="margin:0;font-size:15px;font-weight:600;color:#212529;">${ratingLabel.split(" ").slice(1).join(" ")}</p>
            <p style="margin:0;font-size:12px;color:#6C757D;">de ${escapeHtml(params.userEmail)}</p>
          </div>
        </div>

        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6C757D;text-transform:uppercase;letter-spacing:.5px;">Mensagem</p>
        ${messageHtml}

        <p style="margin:24px 0 0;font-size:12px;color:#ADB5BD;">Recebido em ${dateBR}</p>
      </div>
      <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">
        TEAmo · Acesse <a href="https://teamo-care-hub.vercel.app/feedbacks" style="color:#3B5BDB;">/feedbacks</a> para ver todos
      </p>
    </div>
  </body>
</html>`;

  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [ADMIN_EMAIL],
        subject: `[TEAmo Feedback] ${ratingLabel} — ${dateBR}`,
        html,
      }),
    });
    if (!res.ok) {
      logger.error("feedback.email_send_failed", { failureCode: `resend_${res.status}` });
    }
  } catch (e) {
    logger.error("feedback.email_send_exception", {
      failureCode: e instanceof Error ? e.message.slice(0, 80) : "unknown",
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── submitFeedbackServer ────────────────────────────────────────────────────

export const submitFeedbackServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Rate limiting por usuário (10 por minuto)
    const rl = rateLimit(`feedback:${userId}`, 10, 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente em breve.", { status: 429 });
    }

    const { error } = await supabaseAdmin.from("feedback").insert({
      user_id: userId,
      rating: data.rating,
      message: data.message ?? null,
    });

    if (error) {
      logger.error("feedback.insert_failed", { failureCode: error.code ?? "unknown" });
      throw new Response("Não foi possível salvar o feedback.", { status: 500 });
    }

    // Busca e-mail para notificação — fire-and-forget (não bloqueia resposta)
    void (async () => {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser?.user?.email) {
          await sendFeedbackNotification({
            userEmail: authUser.user.email,
            rating: data.rating,
            message: data.message ?? null,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        logger.error("feedback.notification_exception", {
          failureCode: e instanceof Error ? e.message.slice(0, 80) : "unknown",
        });
      }
    })();

    return { ok: true as const };
  });

// ─── listFeedbackServer (admin-only) ─────────────────────────────────────────

export const listFeedbackServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Verifica se o usuário é admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_admin) {
      throw new Response("Proibido.", { status: 403 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("feedback")
      .select("id, rating, message, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error || !rows) {
      logger.error("feedback.list_failed", { failureCode: error?.code ?? "unknown" });
      return { items: [] as FeedbackItem[] };
    }

    // Busca e-mails em paralelo — N+1 aceitável para volume baixo de feedback
    const items: FeedbackItem[] = await Promise.all(
      rows.map(async (row) => {
        let userEmail = "desconhecido";
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          userEmail = authUser?.user?.email ?? "desconhecido";
        } catch {
          // silencioso — mostra "desconhecido" se falhar
        }
        return {
          id: row.id,
          rating: row.rating as 1 | 2 | 3,
          message: row.message,
          createdAt: row.created_at,
          userEmail,
        };
      }),
    );

    return { items };
  });
