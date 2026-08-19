// ─── Página de descadastro de campanha ───────────────────────────────────────
// Some no rodapé de todo e-mail de campanha. Sem confirmação extra: quem clicou
// já decidiu — pedir "tem certeza?" só atrapalha quem quer sair rápido.

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, CheckCircle2 } from "lucide-react";
import { unsubscribeServer } from "@/lib/unsubscribe.functions";

export const Route = createFileRoute("/descadastro/$token")({
  head: () => ({ meta: [{ title: "Descadastro — TEAmo" }] }),
  component: DescadastroPage,
});

function DescadastroPage() {
  const { token } = Route.useParams();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    unsubscribeServer({ data: { token } })
      .then((r) => setStatus(r.ok ? "done" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="text-xl font-extrabold">
          <span className="text-primary">TEA</span>
          <span className="text-accent">mo</span>
        </span>

        {status === "loading" && (
          <div className="mt-6 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Processando...
          </div>
        )}

        {status === "done" && (
          <div className="mt-6">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Pronto — você não vai mais receber este e-mail do TEAmo.
            </p>
          </div>
        )}

        {status === "error" && (
          <p className="mt-6 text-sm text-muted-foreground">
            Não conseguimos processar agora. Pode responder qualquer e-mail nosso
            pedindo para remover seu contato.
          </p>
        )}
      </div>
    </main>
  );
}
