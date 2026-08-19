// Edge Function · campaign-dispatch
//
// Motor do ciclo de vida por comportamento. Roda 1x/dia e é IDEMPOTENTE: não sabe
// "de que dia" é — pergunta ao banco em que estágio cada pessoa está e o que ela
// está devendo. Isso faz uma única função cobrir aquisição (quem nem tem conta)
// e ativação/reativação (quem já tem), sem job separado por fase.
//
// Ordem de execução (importa):
//   1. campaign_sync_stages() — vincula leads que viraram conta e move estágios.
//      Roda ANTES do envio para ninguém receber cobrança de um estágio que já superou.
//   2. campaign_lifecycle_due — quem está devendo toque, respeitando régua,
//      cooldown global de 3 dias e teto de 8 no ciclo de vida.
//   3. Resend → campaign_record_touch() por destinatário.
//
// Envio ao estágio `lead` é decidido POR PESSOA, pela coluna auto_send:
//   - lista fria (sem consentimento) → auto_send=false: só rastreia e devolve em
//     `leads_pendentes_envio_manual`, para Eduardo enviar do endereço pessoal.
//     Disparar lista fria pelo noreply@teamotech.online arriscaria a reputação do
//     domínio que também envia o transacional do produto (verificação, convites).
//   - formulário público (consentiu ao preencher) → auto_send=true: envia normal.
//
// Deploy:
//   supabase functions deploy campaign-dispatch --project-ref oguqnqdqqqzvfrdztykz

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CRON_TOKEN = Deno.env.get("CAMPAIGN_CRON_TOKEN")!;

const RESEND_FROM = "TEAmo <noreply@teamotech.online>";
const APP_URL = "https://teamotech.online";
// Campanhas fixas + as de captação inbound (inbound-YYYY-MM), descobertas em runtime.
const CAMPANHAS_FIXAS = ["reativacao-base-2026-08", "aquisicao-lista-2026-08"];
const MAX_PER_RUN = 20;

type Stage = "lead" | "signed_up" | "explorer" | "dormant";
type Variant = "parent" | "therapist" | "lead";

// ─── Layout ───────────────────────────────────────────────────────────────────

function layout(bodyHtml: string, ctaLabel: string, ctaHref: string, unsubUrl: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;overflow:hidden;">
      <div style="height:6px;background-color:#4F46E5;background-image:linear-gradient(90deg,#4F46E5 0%,#EC4899 100%);"></div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;">
          <span style="color:#4F46E5;">TEA</span><span style="color:#EC4899;">mo</span>
        </h1>
        <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Acompanhamento terapêutico para crianças com TEA</p>
        ${bodyHtml}
        <div style="text-align:center;margin:28px 0;">
          <a href="${ctaHref}" style="display:inline-block;background-color:#4F46E5;background-image:linear-gradient(90deg,#4F46E5 0%,#7C3AED 100%);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
            ${ctaLabel}
          </a>
        </div>
        <p style="margin:0;font-size:13px;color:#6C757D;">
          Qualquer dúvida, é só responder este e-mail — sou eu mesmo, Eduardo, quem lê.
        </p>
      </div>
      <div style="padding:0 28px 20px;">
        <p style="margin:0;font-size:11px;color:#ADB5BD;">
          Não quer mais receber estes e-mails? <a href="${unsubUrl}" style="color:#ADB5BD;text-decoration:underline;">Descadastrar</a>
        </p>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · acompanhamento terapêutico</p>
  </div>
</body></html>`;
}

const P = (t: string) =>
  `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">${t}</p>`;
const LEAD_IN = (t: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${t}</p>`;
const LIST = (items: string[]) =>
  `<ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.9;color:#374151;">${
    items.map((i) => `<li>${i}</li>`).join("")
  }</ul>`;

// ─── Conteúdo: estágio → índice do toque → variante ───────────────────────────

type Tpl = { subject: string; body: string; cta: string; href: string };

const SIGNUP = `${APP_URL}/cadastro`;

function content(stage: Stage, idx: number, variant: Variant): Tpl | null {
  const key = `${stage}:${idx}`;

  switch (key) {
    // ── lead: ainda não tem conta ──────────────────────────────────────────
    case "lead:1":
      return {
        subject: "Um app para organizar o cuidado de quem você ama",
        cta: "Conhecer o TEAmo",
        href: SIGNUP,
        body: LEAD_IN("Oi!") +
          P("Sou o Eduardo, criador do TEAmo — um app que ajuda famílias e profissionais a acompanharem juntos o desenvolvimento de crianças com TEA.") +
          P("A ideia é simples: reunir num lugar só o que hoje fica espalhado entre cadernos, grupos de WhatsApp e a memória de cada um — evolução, conquistas e o combinado entre quem cuida."),
      };
    case "lead:2":
      return {
        subject: "O que dá para acompanhar pelo TEAmo",
        cta: "Criar minha conta",
        href: SIGNUP,
        body: LEAD_IN("Oi!") +
          P("Escrevi outro dia sobre o TEAmo. Em resumo, o que ele organiza:") +
          LIST([
            "<strong>Evolução</strong> registrada ao longo do tempo, não só na memória",
            "<strong>Conquistas</strong> que ficam documentadas conforme acontecem",
            "Família e profissionais <strong>vendo a mesma coisa</strong>, sem retrabalho",
          ]) +
          P("Criar conta é gratuito e leva menos de 2 minutos."),
      };
    case "lead:3":
      return {
        subject: "Última mensagem — e obrigado",
        cta: "Conhecer o TEAmo",
        href: SIGNUP,
        body: LEAD_IN("Oi!") +
          P("Esta é minha última mensagem sobre o TEAmo — não quero ocupar sua caixa de entrada.") +
          P("Se fizer sentido um dia, o app está lá e é gratuito para começar. E se quiser me contar o que faria sentido para a sua realidade, é só responder: eu leio tudo."),
      };

    // ── signed_up: criou conta, mas nunca entrou ───────────────────────────
    case "signed_up:1":
      return {
        subject: "Falta só entrar pela primeira vez",
        cta: "Entrar no TEAmo",
        href: APP_URL,
        body: LEAD_IN("Oi!") +
          P("Sua conta no TEAmo está criada, mas você ainda não entrou nenhuma vez.") +
          P("Se o e-mail de confirmação não chegou, dá para pedir outro na tela de acesso — ou é só responder aqui que eu resolvo para você."),
      };
    case "signed_up:2":
      return {
        subject: "Posso ajudar a destravar seu acesso?",
        cta: "Entrar no TEAmo",
        href: APP_URL,
        body: LEAD_IN("Oi!") +
          P("Sua conta continua esperando o primeiro acesso — e se algo travou no caminho, eu queria saber.") +
          P("Me responde contando o que aconteceu? Pode ser o e-mail de confirmação que não chegou, senha, qualquer coisa. Eu resolvo pessoalmente."),
      };

    // ── explorer: entrou, mas não fez a ação-chave ─────────────────────────
    case "explorer:1":
      return variant === "therapist"
        ? {
          subject: "Sua primeira sessão registrada no TEAmo",
          cta: "Registrar uma sessão",
          href: APP_URL,
          body: LEAD_IN("Oi!") +
            P("Você entrou no TEAmo, mas ainda não registrou nenhuma sessão — e é aí que o app começa a valer a pena.") +
            P("Ao registrar uma vez, a família já enxerga o que foi trabalhado, sem você precisar mandar resumo à parte depois."),
        }
        : {
          subject: "Faltou o primeiro passo no TEAmo",
          cta: "Terminar meu cadastro",
          href: APP_URL,
          body: LEAD_IN("Oi!") +
            P("Você entrou no TEAmo, mas o cadastro ficou pela metade — e é rapidinho terminar.") +
            P("Depois de concluir, você passa a acompanhar de perto cada passo e cada conquista de quem você ama, tudo em um só lugar."),
        };
    case "explorer:2":
      return variant === "therapist"
        ? {
          subject: "Menos tempo escrevendo relatório, mais tempo com o paciente",
          cta: "Voltar para o TEAmo",
          href: APP_URL,
          body: LEAD_IN("Oi de novo!") +
            P("Sei que a agenda de atendimentos não para — só queria mostrar o que o TEAmo tira das suas costas:") +
            LIST([
              "Registra a <strong>sessão uma vez só</strong> — a família já vê automaticamente",
              "<strong>Marcos de evolução</strong> ficam documentados, sem planilha à parte",
              "Menos tempo escrevendo resumo pra reunião, mais tempo com o paciente",
            ]),
        }
        : {
          subject: "Leva 2 minutos para deixar tudo pronto",
          cta: "Terminar meu cadastro",
          href: APP_URL,
          body: LEAD_IN("Oi de novo!") +
            P("Sei que a rotina é corrida — mas terminar o cadastro leva uns 2 minutos, e é o que destrava o TEAmo:") +
            LIST([
              "Registrar quem você acompanha",
              "Acompanhar <strong>marcos e conquistas</strong> ao longo do tempo",
              "Guardar tudo organizado em um só lugar, no celular",
            ]),
        };

    // ── dormant: já usou de verdade, mas sumiu ─────────────────────────────
    case "dormant:1":
      return variant === "therapist"
        ? {
          subject: "Continue cuidando dos seus pacientes",
          cta: "Voltar para o TEAmo",
          href: APP_URL,
          body: LEAD_IN("Oi!") +
            P("Faz um tempo que você não entra no TEAmo — e o cuidado dos seus pacientes não pode esperar.") +
            P("O TEAmo existe para ajudar você a registrar cada sessão, acompanhar a evolução e manter as famílias conectadas ao processo terapêutico, tudo em um só lugar."),
        }
        : {
          subject: "Continue cuidando de quem você ama",
          cta: "Voltar para o TEAmo",
          href: APP_URL,
          body: LEAD_IN("Oi!") +
            P("Faz um tempo que você não entra no TEAmo — e o cuidado de quem você ama não pode esperar.") +
            P("O TEAmo existe para ajudar você a acompanhar de perto cada passo, cada conquista e cada detalhe do cuidado, tudo em um só lugar, na palma da mão."),
        };
    case "dormant:2":
      return variant === "therapist"
        ? {
          subject: "Menos tempo escrevendo relatório, mais tempo com o paciente",
          cta: "Voltar para o TEAmo",
          href: APP_URL,
          body: LEAD_IN("Oi de novo!") +
            P("Sei que a agenda de atendimentos não para — só queria mostrar rapidinho o que o TEAmo tira das suas costas:") +
            LIST([
              "Registra a <strong>sessão uma vez só</strong> — a família já vê automaticamente",
              "<strong>Marcos de evolução</strong> ficam documentados, sem planilha à parte",
              "Menos tempo escrevendo resumo pra reunião, mais tempo com o paciente",
            ]),
        }
        : {
          subject: "O que muda quando você acompanha pelo TEAmo",
          cta: "Voltar para o TEAmo",
          href: APP_URL,
          body: LEAD_IN("Oi de novo!") +
            P("Sei que a rotina é corrida — só queria mostrar rapidinho o que muda quando você acompanha pelo TEAmo:") +
            LIST([
              "Você vê cada <strong>sessão registrada</strong>, com o que foi trabalhado",
              "<strong>Marcos de evolução</strong> aparecem conforme são alcançados",
              "Tudo direto do celular, sem esperar a reunião mensal",
            ]),
        };
    case "dormant:3":
      return {
        subject: "Sem pressa — só queria saber se posso ajudar",
        cta: "Voltar para o TEAmo",
        href: APP_URL,
        body: LEAD_IN("Oi!") +
          P("Sem pressa nenhuma — só queria saber se ficou alguma dúvida ou se algo te travou na hora de entrar no TEAmo.") +
          P("Se quiser, responde este e-mail me contando o que rolou. Eu leio pessoalmente e adoraria ajudar — ou só entender melhor o que faltou."),
      };

    default:
      return null;
  }
}

// ─── Envio ────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string, unsubUrl: string) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html,
        // Header padrão (RFC 8058): Gmail/Outlook mostram "Cancelar inscrição"
        // no próprio cliente, sem precisar abrir o e-mail — reduz denúncia de spam.
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, error: `Resend ${res.status}: ${JSON.stringify(payload).slice(0, 200)}` };
    }
    return { ok: true as const, id: (payload as { id?: string }).id ?? null };
  } catch (e) {
    clearTimeout(tid);
    const msg = (e as Error).name === "AbortError" ? "timeout" : (e as Error).message;
    return { ok: false as const, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!CRON_TOKEN || req.headers.get("x-campaign-token") !== CRON_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "true";
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Campanhas inbound nascem sozinhas (uma por mês, ao primeiro formulário
  // preenchido), então são descobertas em vez de listadas à mão.
  const { data: inbound } = await supabase
    .from("campaign_sends")
    .select("campaign")
    .like("campaign", "inbound-%");
  const CAMPAIGNS = [
    ...CAMPANHAS_FIXAS,
    ...new Set((inbound ?? []).map((r: { campaign: string }) => r.campaign)),
  ];

  const transitions: unknown[] = [];
  const sent: unknown[] = [];
  const failed: unknown[] = [];
  const wouldSend: unknown[] = [];
  const leadsPendentes: unknown[] = [];

  for (const campaign of CAMPAIGNS) {
    // 1. Vincula conversões e move estágios antes de qualquer envio.
    const { data: moved, error: syncErr } = await supabase
      .rpc("campaign_sync_stages", { p_campaign: campaign });
    if (syncErr) {
      return Response.json({ ok: false, step: "sync_stages", campaign, error: syncErr.message }, { status: 500 });
    }
    for (const t of (moved ?? []) as unknown[]) transitions.push({ campaign, ...(t as object) });

    // 2. Quem está devendo toque.
    const { data: due, error: dueErr } = await supabase
      .from("campaign_lifecycle_due")
      .select("email, stage, variant, next_touch_index, auto_send, lead_name, unsub_token")
      .eq("campaign", campaign)
      .eq("is_due", true)
      .limit(MAX_PER_RUN);
    if (dueErr) {
      return Response.json({ ok: false, step: "due", campaign, error: dueErr.message }, { status: 500 });
    }

    const rows = (due ?? []) as {
      email: string; stage: Stage; variant: Variant; next_touch_index: number;
      auto_send: boolean; lead_name: string | null; unsub_token: string;
    }[];

    for (const row of rows) {
      const tpl = content(row.stage, row.next_touch_index, row.variant);
      if (!tpl) {
        failed.push({ campaign, email: row.email, error: `sem template para ${row.stage}:${row.next_touch_index}` });
        continue;
      }

      // Lead sem consentimento (lista fria): rastreia mas não dispara.
      if (row.stage === "lead" && !row.auto_send) {
        leadsPendentes.push({
          campaign, email: row.email, toque: row.next_touch_index, assunto: tpl.subject,
        });
        continue;
      }

      if (dryRun) {
        wouldSend.push({
          campaign, email: row.email, stage: row.stage,
          variant: row.variant, toque: row.next_touch_index, assunto: tpl.subject,
        });
        continue;
      }

      const unsubUrl = `${APP_URL}/descadastro/${row.unsub_token}`;
      const result = await sendEmail(
        row.email, tpl.subject, layout(tpl.body, tpl.cta, tpl.href, unsubUrl), unsubUrl,
      );
      if (!result.ok) {
        failed.push({ campaign, email: row.email, stage: row.stage, error: result.error });
        continue;
      }

      const { error: recErr } = await supabase.rpc("campaign_record_touch", {
        p_campaign: campaign, p_email: row.email, p_resend_id: result.id,
      });
      if (recErr) {
        // E-mail saiu mas não registrou: precisa aparecer, senão repete amanhã.
        failed.push({ campaign, email: row.email, error: `enviado mas NÃO registrado: ${recErr.message}` });
        continue;
      }

      sent.push({ campaign, email: row.email, stage: row.stage, toque: row.next_touch_index, resend_id: result.id });
    }
  }

  return Response.json({
    ok: failed.length === 0,
    ranAt: new Date().toISOString(),
    dry_run: dryRun,
    campanhas: CAMPAIGNS,
    transicoes: transitions,
    ...(dryRun ? { would_send: wouldSend } : { sent_count: sent.length, sent }),
    leads_pendentes_envio_manual: leadsPendentes,
    failed_count: failed.length,
    failed,
  });
});
