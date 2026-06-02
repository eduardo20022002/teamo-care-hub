// ServerFns relacionadas à conta do usuário.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── deleteAccountServer ──────────────────────────────────────────────────────
// Exclui permanentemente a conta do usuário autenticado.
// supabaseAdmin.auth.admin.deleteUser apaga o registro em auth.users;
// as tabelas com ON DELETE CASCADE (profiles, children, attendance_records, etc.)
// são limpas automaticamente pelo banco.
// Audit: a exclusão é irreversível — não há soft-delete.

export const deleteAccountServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;

    // Defesa em profundidade: remove o perfil explicitamente antes do deleteUser.
    // O FK com ON DELETE CASCADE já faria isso, mas garantir aqui evita
    // que o e-mail fique "preso" se o cascade demorar ou falhar silenciosamente.
    await (supabaseAdmin as any)
      .from("profiles")
      .delete()
      .eq("id", userId);

    // Remove o usuário do auth.users — cascade apaga children, attendance_records,
    // care_invites, care_access, therapist_invites, therapist_parent_access, etc.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw new Response(
        `Não foi possível excluir a conta: ${error.message}`,
        { status: 500 },
      );
    }

    return { ok: true };
  });
