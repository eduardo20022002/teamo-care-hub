import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, Info } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/layout/BrandLogo";

export const Route = createFileRoute("/_auth/sobre")({
  head: () => ({
    meta: [{ title: "Sobre o TEAmo" }],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <div className="mb-5">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar ao início
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Info className="h-6 w-6 text-accent" strokeWidth={1.75} />
            Sobre o TEAmo
          </h1>
        </header>

        {/* Logo + version */}
        <div className="mb-5 flex flex-col items-center rounded-[22px] bg-card border border-border p-8 shadow-sm">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px]"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Heart className="h-8 w-8 text-white" strokeWidth={1.75} />
          </div>
          <BrandLogo className="text-3xl" />
          <p className="mt-2 text-sm text-muted-foreground">Versão 1.0.0</p>
        </div>

        {/* Description */}
        <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-foreground">O que é o TEAmo?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O TEAmo é um sistema de gestão de cuidados desenvolvido para famílias de crianças com
            Transtorno do Espectro Autista (TEA). Centralizamos registros clínicos, documentos,
            agenda terapêutica e a comunicação segura com profissionais de saúde em um único
            aplicativo.
          </p>
        </div>

        {/* TCC credits */}
        <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-foreground">Projeto acadêmico</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Instituição:</span> Universidade Federal
              de Pernambuco (UFPE)
            </p>
            <p>
              <span className="font-medium text-foreground">Tipo:</span> Trabalho de Conclusão de
              Curso (TCC) — 2026
            </p>
            <p>
              <span className="font-medium text-foreground">Desenvolvedor:</span> Eduardo Meirelles
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-foreground">Contato</h2>
          <p className="text-sm text-muted-foreground">
            Dúvidas, sugestões ou relatos de problemas:
          </p>
          <a
            href="mailto:suporte@teamotech.online"
            className="mt-1 block text-sm font-semibold text-primary hover:underline"
          >
            suporte@teamotech.online
          </a>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Feito com <Heart className="inline h-3 w-3 text-accent" /> para famílias TEA · 2026
        </p>
      </div>
    </AppShell>
  );
}
