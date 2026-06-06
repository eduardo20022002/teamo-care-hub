// ServerFns relacionadas à conta do usuário.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── deleteAccountServer ──────────────────────────────────────────────────────
// Exclui permanentemente a conta do usuário autenticado.
// Exige re-autenticação (senha) antes de deletar — impede deleção via sessão
// sequestrada sem conhecimento da senha.
// O audit log é gravado ANTES do deleteUser para preservar o userId.

export const deleteAccountServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: z.string().min(1, "Informe a senha.") }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context as any;

    // 1. Busca o e-mail do usuário para re-autenticação
    const { data: userRecord, error: userFetchError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (userFetchError || !userRecord?.user?.email) {
      throw new Response("Não foi possível verificar a identidade.", { status: 400 });
    }

    // 2. Re-autentica com a senha fornecida — garante que o titular da conta confirma
    const supabaseAnon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { error: reAuthError } = await supabaseAnon.auth.signInWithPassword({
      email: userRecord.user.email,
      password: data.password,
    });
    if (reAuthError) {
      throw new Response("Senha incorreta. A conta não foi excluída.", { status: 401 });
    }

    // 3. Audit log ANTES do deleteUser — após a exclusão o userId deixa de existir
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      event_type: "auth.logout",
      metadata: { reason: "account_deleted_by_user" },
    });

    // 4. Remove perfil explicitamente (defesa em profundidade antes do cascade)
    await (supabaseAdmin as any).from("profiles").delete().eq("id", userId);

    // 5. Remove o usuário do auth.users — cascade apaga children, attendance_records,
    //    care_invites, care_access, therapist_invites, therapist_parent_access, etc.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      throw new Response(
        `Não foi possível excluir a conta: ${error.message}`,
        { status: 500 },
      );
    }

    return { ok: true };
  });
