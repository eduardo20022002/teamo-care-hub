// ─── ServerFn do formulário público de interesse ─────────────────────────────
// submitInterestServer é PÚBLICA (sem auth): é a porta de entrada de quem ainda
// não é usuário. Por isso carrega as proteções de rota pública do projeto —
// rate limit por IP (regra 6 do CLAUDE.md) e honeypot contra bot.
//
// A pessoa capturada entra no mesmo motor de ciclo de vida das campanhas
// (campaign_sends, stage='lead'), então o follow-up automático e a detecção de
// "criou conta" já valem para ela sem código adicional.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";

const RESEND_FROM = "TEAmo <noreply@teamotech.online>";

function appBaseUrl(): string {
  return process.env.APP_URL ?? "https://teamotech.online";
}

const submitInterestSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  papel: z.enum(["parent", "therapist"]),
  mensagem: z.string().trim().max(1000).optional(),
  consentimento: z.literal(true, { message: "É preciso aceitar para continuar" }),
  // Honeypot: campo escondido no formulário. Humano não preenche; bot preenche.
  website: z.string().max(0).optional(),
});

// ─── E-mail de boas-vindas (imediato) ─────────────────────────────────────────

// NÃO interpola o `nome` livre do formulário: como o e-mail vai para um endereço
// ainda NÃO confirmado (posse não verificada), texto controlado pelo remetente no
// corpo seria vetor de abuso/assédio via nosso domínio. Saudação neutra. (issue #5)
function welcomeHtml(papel: "parent" | "therapist"): string {
  const linha = papel === "therapist"
    ? "Com o TEAmo você registra cada sessão uma vez só, acompanha a evolução dos seus pacientes e mantém as famílias conectadas ao processo — sem planilha à parte."
    : "Com o TEAmo você acompanha de perto cada passo, cada conquista e cada detalhe do cuidado de quem você ama, tudo em um só lugar.";

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;overflow:hidden;">
      <div style="height:6px;background-color:#4F46E5;background-image:linear-gradient(90deg,#4F46E5 0%,#EC4899 100%);"></div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;">
          <span style="color:#4F46E5;">TEA</span><span style="color:#EC4899;">mo</span>
        </h1>
        <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Acompanhamento terapêutico para crianças com TEA</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Oi! 👋</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
          Que bom ter você por aqui. Seu acesso ao TEAmo está liberado — é só criar sua conta pelo link abaixo.
        </p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#374151;">${linha}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${appBaseUrl()}/cadastro" style="display:inline-block;background-color:#4F46E5;background-image:linear-gradient(90deg,#4F46E5 0%,#7C3AED 100%);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
            Criar minha conta
          </a>
        </div>
        <p style="margin:0;font-size:13px;color:#6C757D;">
          Qualquer dúvida, é só responder este e-mail — sou eu mesmo, Eduardo, quem lê.
        </p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · acompanhamento terapêutico</p>
  </div>
</body></html>`;
}

async function sendWelcomeEmail(params: {
  to: string; papel: "parent" | "therapist";
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.to],
        subject: "Seu acesso ao TEAmo",
        html: welcomeHtml(params.papel),
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` };
    }
    const payload = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: payload.id };
  } catch (e) {
    clearTimeout(tid);
    if ((e as Error).name === "AbortError") return { ok: false, error: "Timeout ao enviar e-mail." };
    return { ok: false, error: (e as Error).message };
  }
}

// ─── ServerFn pública ─────────────────────────────────────────────────────────

export const submitInterestServer = createServerFn({ method: "POST" })
  .inputValidator((d) => submitInterestSchema.parse(d))
  .handler(async ({ data }): Promise<
    { ok: true; jaTemConta: boolean } | { ok: false; error: string }
  > => {
    // Honeypot: bot preencheu campo invisível. Responde "ok" para não ensinar o
    // bot qual sinal o barrou, mas não grava nada.
    if (data.website && data.website.length > 0) {
      return { ok: true, jaTemConta: false };
    }

    // Rate limit por IP: 5 envios a cada 30 min (mesma régua do Form 1 da fila).
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`interesse:${ip}`, 5, 30 * 60_000);
    if (!rl.allowed) {
      return {
        ok: false,
        error: `Muitas tentativas. Tente novamente em ${rl.retryAfterSeconds} segundos.`,
      };
    }

    // Rate limit também por e-mail-alvo: impede usar o formulário para disparar
    // repetidamente e-mails a um endereço de terceiro (o limite por IP sozinho é
    // contornável). Responde "ok" sem enviar, para não revelar se o e-mail existe.
    if (!rateLimit(`interesse:email:${data.email}`, 2, 24 * 60 * 60_000).allowed) {
      return { ok: true, jaTemConta: false };
    }

    // NOTA LGPD (issue #5): `campaign_capture_lead` grava consent_at, mas isto é
    // consentimento de OPT-IN SIMPLES — a posse do e-mail não é verificada aqui.
    // Double opt-in (confirmação por link antes de sequência de campanha) é o
    // follow-up planejado; enquanto isso, o e-mail de boas-vindas não expõe texto
    // livre do remetente e há rate limit por e-mail acima.
    const { data: captured, error } = await (supabaseAdmin as any).rpc("campaign_capture_lead", {
      p_email: data.email,
      p_name: data.nome,
      p_segmento: data.papel,
      p_source: "form-interesse",
      p_data: data.mensagem ? { mensagem: data.mensagem } : null,
    });

    if (error) {
      return { ok: false, error: "Não foi possível registrar agora. Tente novamente." };
    }

    const row = Array.isArray(captured) ? captured[0] : captured;
    const jaExistia: boolean = row?.ja_existia ?? false;
    const jaTemConta: boolean = row?.ja_tem_conta ?? false;

    // Só envia boas-vindas na primeira captação. Reenvio do formulário atualiza o
    // cadastro mas não dispara e-mail de novo — evita usar o formulário como
    // gatilho para spammar terceiros.
    if (!jaExistia) {
      const sent = await sendWelcomeEmail({
        to: data.email, papel: data.papel,
      });
      if (sent.ok && sent.id) {
        // Conta como o toque 1 do estágio lead: o follow-up automático continua
        // a partir daqui, sem repetir a mesma mensagem.
        await (supabaseAdmin as any).rpc("campaign_record_touch", {
          p_campaign: `inbound-${new Date().toISOString().slice(0, 7)}`,
          p_email: data.email,
          p_resend_id: sent.id,
        });
      }
      // Falha de e-mail não derruba a captação: o lead já está salvo e o motor
      // diário reenviará. O usuário não deve ver erro por isso.
    }

    return { ok: true, jaTemConta };
  });
